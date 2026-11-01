import 'server-only';
import { createHash } from 'node:crypto';

type Credentials={store:string;token?:string;clientId?:string;clientSecret?:string};
type Fetcher=(url:string,options:RequestInit)=>Promise<Response>;
type TokenRecord={title?:string;accessToken?:string;accessScopes?:{handle:string}[]};
const TITLE='My Business Checker checkout';
const REQUIRED=['unauthenticated_read_product_listings','unauthenticated_read_selling_plans','unauthenticated_write_checkouts'];
const FIELDS='accessToken title accessScopes { handle }';
function usable(token:TokenRecord|undefined){return Boolean(token?.accessToken&&REQUIRED.every(scope=>token.accessScopes?.some(item=>item.handle===scope)));}

// Only server code can use client credentials. Tokens are reused through the
// installed app's Admin API; they are never sent to the browser or written to Git.
export function createStorefrontTokenResolver(fetcher:Fetcher=(url,options)=>fetch(url,options)){
 const cache=new Map<string,{expires:number;promise:Promise<string>}>();
 async function resolve(credentials:Credentials):Promise<string>{
  if(!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(credentials.store))throw new Error('Invalid Shopify store.');
  if(credentials.token)return credentials.token;
  if(!credentials.clientId||!credentials.clientSecret)throw new Error('Shopify app credentials are not configured.');
  const key=createHash('sha256').update(JSON.stringify([credentials.store,credentials.clientId,credentials.clientSecret])).digest('hex');
  const cached=cache.get(key);if(cached&&cached.expires>Date.now())return cached.promise;
  const promise=obtain(credentials);
  cache.set(key,{expires:Date.now()+5*60*1000,promise});
  try{return await promise;}catch(error){cache.delete(key);throw error;}
 }
 async function obtain(credentials:Credentials){
  const response=await fetcher(`https://${credentials.store}/admin/oauth/access_token`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'client_credentials',client_id:credentials.clientId!,client_secret:credentials.clientSecret!}).toString(),cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw new Error('Shopify app authentication failed. Check the Client ID, secret, installation and app/store ownership.');
  const auth=await response.json();if(typeof auth.access_token!=='string'||!auth.access_token)throw new Error('Shopify did not return app access.');
  async function graphql(query:string,variables?:Record<string,unknown>){
   const result=await fetcher(`https://${credentials.store}/admin/api/2026-10/graphql.json`,{method:'POST',headers:{'Content-Type':'application/json','X-Shopify-Access-Token':auth.access_token},body:JSON.stringify({query,variables}),cache:'no-store',signal:AbortSignal.timeout(15000)});
   if(!result.ok)throw new Error('Shopify app access could not be used to obtain a Storefront token.');
   const body=await result.json();if(body.errors?.length||!body.data)throw new Error('Shopify could not provide Storefront access. Check the installed app scopes.');return body.data;
  }
  async function existing(){
   const data=await graphql(`query ExistingStorefrontTokens { storefrontAccessTokens(first:100) { edges { node { ${FIELDS} } } } }`);
   const edges=data.storefrontAccessTokens?.edges;
   if(!Array.isArray(edges))throw new Error('Shopify did not return Storefront access records.');
   return (edges as {node:TokenRecord}[]).find(edge=>edge.node.title===TITLE&&usable(edge.node))?.node.accessToken;
  }
  const token=await existing();if(token)return token;
  const created=await graphql(`mutation CreateStorefrontToken($input:StorefrontAccessTokenInput!) { storefrontAccessTokenCreate(input:$input) { storefrontAccessToken { ${FIELDS} } userErrors { message } } }`,{input:{title:TITLE}});
  const payload=created.storefrontAccessTokenCreate;
  if(!payload?.userErrors?.length&&usable(payload?.storefrontAccessToken))return payload.storefrontAccessToken.accessToken as string;
  // Another server instance may have provisioned the same app's token while
  // this request was running. Re-read before failing; never delete other tokens.
  const concurrent=await existing();if(concurrent)return concurrent;
  throw new Error('Shopify could not create a Storefront token with all three required scopes.');
 }
 return resolve;
}
export const getStorefrontToken=createStorefrontTokenResolver();
