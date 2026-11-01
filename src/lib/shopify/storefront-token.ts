import 'server-only';
import { createHash } from 'node:crypto';

type Credentials={store:string;token?:string;clientId?:string;clientSecret?:string};
type Fetcher=(url:string,options:RequestInit)=>Promise<Response>;
type TokenRecord={title?:string;accessToken?:string;accessScopes?:{handle:string}[]};
type Stage='AUTH'|'TOKEN_LOOKUP'|'TOKEN_CREATE';
export class ShopifyAccessError extends Error {
 constructor(stage:Stage,reason:string){
  const label={AUTH:'app authentication',TOKEN_LOOKUP:'Storefront token lookup',TOKEN_CREATE:'Storefront token creation'}[stage];
  super(`Shopify ${label} failed [SF_${stage}_${reason}].`);
 }
}
const TITLE='My Business Checker checkout';
const REQUIRED=['unauthenticated_read_product_listings','unauthenticated_read_selling_plans','unauthenticated_write_checkouts'];
const FIELDS='accessToken title accessScopes { handle }';
function usable(token:TokenRecord|undefined){return Boolean(token?.accessToken&&Array.isArray(token.accessScopes)&&REQUIRED.every(scope=>token.accessScopes?.some(item=>item.handle===scope)));}
function graphqlReason(errors:unknown){
 if(!Array.isArray(errors))return 'GRAPHQL';
 const codes=errors.map(error=>error&&typeof error==='object'&&'extensions' in error?(error.extensions as {code?:unknown})?.code:undefined);
 if(codes.some(code=>code==='undefinedField'||code==='undefinedType'||code==='argumentNotAccepted'||code==='GRAPHQL_VALIDATION_FAILED'))return 'SCHEMA';
 if(codes.includes('ACCESS_DENIED'))return 'PERMISSION';
 if(codes.includes('THROTTLED'))return 'THROTTLED';
 return 'GRAPHQL';
}

// Only fixed stage/status codes leave the server. Provider response messages,
// request bodies, headers and credential values are never returned to customers.
export function createStorefrontTokenResolver(fetcher:Fetcher=(url,options)=>fetch(url,options)){
 const cache=new Map<string,{expires:number;promise:Promise<string>}>();
 async function readJson(response:Response,stage:Stage){try{return await response.json();}catch{throw new ShopifyAccessError(stage,'INVALID_RESPONSE');}}
 async function call(stage:Stage,url:string,options:RequestInit){
  let response:Response;try{response=await fetcher(url,options);}catch{throw new ShopifyAccessError(stage,'NETWORK');}
  if(!response.ok)throw new ShopifyAccessError(stage,`HTTP_${response.status}`);
  return readJson(response,stage);
 }
 async function resolve(credentials:Credentials):Promise<string>{
  if(!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(credentials.store))throw new Error('Invalid Shopify store.');
  if(credentials.token)return credentials.token;
  if(!credentials.clientId||!credentials.clientSecret)throw new Error('Shopify app credentials are not configured.');
  const key=createHash('sha256').update(JSON.stringify([credentials.store,credentials.clientId,credentials.clientSecret])).digest('hex');
  const cached=cache.get(key);if(cached&&cached.expires>Date.now())return cached.promise;
  const promise=obtain(credentials);cache.set(key,{expires:Date.now()+5*60*1000,promise});
  try{return await promise;}catch(error){cache.delete(key);throw error;}
 }
 async function obtain(credentials:Credentials){
  const auth=await call('AUTH',`https://${credentials.store}/admin/oauth/access_token`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'client_credentials',client_id:credentials.clientId!,client_secret:credentials.clientSecret!}).toString(),cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(typeof auth?.access_token!=='string'||!auth.access_token)throw new ShopifyAccessError('AUTH','INVALID_RESPONSE');
  async function graphql(stage:Stage,query:string,variables?:Record<string,unknown>){
   const body=await call(stage,`https://${credentials.store}/admin/api/2026-10/graphql.json`,{method:'POST',headers:{'Content-Type':'application/json','X-Shopify-Access-Token':auth.access_token},body:JSON.stringify({query,variables}),cache:'no-store',signal:AbortSignal.timeout(15000)});
   if(body?.errors?.length)throw new ShopifyAccessError(stage,graphqlReason(body.errors));
   if(!body?.data)throw new ShopifyAccessError(stage,'INVALID_RESPONSE');return body.data;
  }
  async function existing(){
   const data=await graphql('TOKEN_LOOKUP',`query ExistingStorefrontTokens { storefrontAccessTokens(first:100) { edges { node { ${FIELDS} } } } }`);
   const edges=data.storefrontAccessTokens?.edges;if(!Array.isArray(edges))throw new ShopifyAccessError('TOKEN_LOOKUP','INVALID_RESPONSE');
   return (edges as {node:TokenRecord}[]).find(edge=>edge?.node?.title===TITLE&&usable(edge.node))?.node.accessToken;
  }
  const token=await existing();if(token)return token;
  const created=await graphql('TOKEN_CREATE',`mutation CreateStorefrontToken($input:StorefrontAccessTokenInput!) { storefrontAccessTokenCreate(input:$input) { storefrontAccessToken { ${FIELDS} } userErrors { message } } }`,{input:{title:TITLE}});
  const payload=created.storefrontAccessTokenCreate;
  if(!payload?.userErrors?.length&&usable(payload?.storefrontAccessToken))return payload.storefrontAccessToken.accessToken as string;
  const concurrent=await existing();if(concurrent)return concurrent;
  throw new ShopifyAccessError('TOKEN_CREATE','REQUIRED_SCOPES');
 }
 return resolve;
}
export const getStorefrontToken=createStorefrontTokenResolver();
