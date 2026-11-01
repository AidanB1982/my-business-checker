import { describe,it,expect,vi } from 'vitest';
vi.mock('server-only',()=>({}));
import { createStorefrontTokenResolver } from '../../src/lib/shopify/storefront-token';
const credentials={store:'blackwoodpublishing.myshopify.com',clientId:'fixture-client',clientSecret:'fixture-secret'};
const scopes=['unauthenticated_read_product_listings','unauthenticated_read_selling_plans','unauthenticated_write_checkouts'].map(handle=>({handle}));
const token={title:'My Business Checker checkout',accessToken:'fixture-storefront-access',accessScopes:scopes};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status});
describe('installed-app Storefront access',()=>{
 it('uses an explicit Storefront token without exchanging app credentials',async()=>{const fetcher=vi.fn();const resolve=createStorefrontTokenResolver(fetcher);expect(await resolve({...credentials,token:'existing-token'})).toBe('existing-token');expect(fetcher).not.toHaveBeenCalled();});
 it('exchanges client credentials, reuses the app token and coalesces concurrent calls',async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce(json({access_token:'fixture-admin-access'})).mockResolvedValueOnce(json({data:{storefrontAccessTokens:{edges:[{node:token}]}}}));
  const resolve=createStorefrontTokenResolver(fetcher);expect(await Promise.all([resolve(credentials),resolve(credentials)])).toEqual([token.accessToken,token.accessToken]);expect(fetcher).toHaveBeenCalledTimes(2);
  const [url,options]=fetcher.mock.calls[0];expect(url).toBe('https://blackwoodpublishing.myshopify.com/admin/oauth/access_token');expect(new URLSearchParams(options.body).get('grant_type')).toBe('client_credentials');
  expect(fetcher.mock.calls[1][1].headers['X-Shopify-Access-Token']).toBe('fixture-admin-access');
 });
 it('creates a scoped Storefront token only if an existing one was not found',async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce(json({access_token:'fixture-admin-access'})).mockResolvedValueOnce(json({data:{storefrontAccessTokens:{edges:[]}}})).mockResolvedValueOnce(json({data:{storefrontAccessTokenCreate:{storefrontAccessToken:token,userErrors:[]}}}));
  expect(await createStorefrontTokenResolver(fetcher)(credentials)).toBe(token.accessToken);expect(fetcher).toHaveBeenCalledTimes(3);expect(JSON.parse(fetcher.mock.calls[2][1].body).variables.input.title).toBe(token.title);
 });
 it('does not mistake a failed grant or a Client secret for Storefront access',async()=>{
  const fetcher=vi.fn().mockResolvedValue(json({error:'invalid_client'},401));const resolve=createStorefrontTokenResolver(fetcher);await expect(resolve(credentials)).rejects.toThrow(/authentication failed/);await expect(resolve(credentials)).rejects.toThrow();expect(fetcher).toHaveBeenCalledTimes(2);
 });
 it('fails closed when the installed scopes are insufficient',async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce(json({access_token:'fixture-admin-access'})).mockResolvedValueOnce(json({data:{storefrontAccessTokens:{edges:[]}}})).mockResolvedValueOnce(json({data:{storefrontAccessTokenCreate:{storefrontAccessToken:{...token,accessScopes:[]},userErrors:[]}}})).mockResolvedValueOnce(json({data:{storefrontAccessTokens:{edges:[]}}}));
  await expect(createStorefrontTokenResolver(fetcher)(credentials)).rejects.toThrow(/all three/);
 });
 it('can reuse a token provisioned by another instance during a creation race',async()=>{
  const fetcher=vi.fn().mockResolvedValueOnce(json({access_token:'fixture-admin-access'})).mockResolvedValueOnce(json({data:{storefrontAccessTokens:{edges:[]}}})).mockResolvedValueOnce(json({data:{storefrontAccessTokenCreate:{storefrontAccessToken:null,userErrors:[{message:'limit'}]}}})).mockResolvedValueOnce(json({data:{storefrontAccessTokens:{edges:[{node:token}]}}}));
  expect(await createStorefrontTokenResolver(fetcher)(credentials)).toBe(token.accessToken);
 });
 it('rejects missing credentials and untrusted destinations without requests',async()=>{const fetcher=vi.fn();const resolve=createStorefrontTokenResolver(fetcher);await expect(resolve({store:credentials.store})).rejects.toThrow(/not configured/);await expect(resolve({...credentials,store:'evil.example'})).rejects.toThrow(/Invalid Shopify store/);expect(fetcher).not.toHaveBeenCalled();});
});

describe('credential configuration does not bypass checkout gating',()=>{
 it('accepts a full installed-app credential pair only with the remaining billing configuration',async()=>{
  const {billingAvailable}=await import('../../src/lib/shopify/config');
  const values={SHOPIFY_STOREFRONT_ACCESS_TOKEN:'',SHOPIFY_CLIENT_ID:'fixture-client',SHOPIFY_CLIENT_SECRET:'fixture-secret',SHOPIFY_WEBHOOK_SECRET:'fixture-webhook',SUPABASE_SERVICE_ROLE_KEY:'fixture-admin',SHOPIFY_SUBSCRIPTION_READY:'true'};
  try{for(const [key,value] of Object.entries(values))vi.stubEnv(key,value);expect(billingAvailable()).toBe(true);vi.stubEnv('SHOPIFY_CLIENT_SECRET','');expect(billingAvailable()).toBe(false);vi.stubEnv('SHOPIFY_CLIENT_SECRET','fixture-secret');vi.stubEnv('SHOPIFY_SUBSCRIPTION_READY','false');expect(billingAvailable()).toBe(false);}finally{vi.unstubAllEnvs();}
 });
});
