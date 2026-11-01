import { describe,it,expect,vi } from 'vitest';
const state=vi.hoisted(()=>({unexpected:false}));
vi.mock('server-only',()=>({}));
vi.mock('@/lib/api',async()=>{const actual=await vi.importActual<typeof import('../../src/lib/api')>('@/lib/api');return {...actual,authenticated:async()=>({user:{id:'00000000-0000-4000-8000-000000000001'},supabase:{from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:null,error:null})})})})}})};});
vi.mock('@/lib/shopify/config',()=>({billingAvailable:()=>true,shopifyConfig:()=>({store:'blackwoodpublishing.myshopify.com'})}));
vi.mock('@/lib/shopify/storefront-token',async()=>{const actual=await vi.importActual<typeof import('../../src/lib/shopify/storefront-token')>('@/lib/shopify/storefront-token');return {...actual,getStorefrontToken:async()=>{if(state.unexpected)throw new Error('private fixture-credential');throw new actual.ShopifyAccessError('TOKEN_LOOKUP','SCHEMA');}};});
import { POST } from '../../src/app/api/billing/checkout/route';
const request=()=>new Request('https://app.test/api/billing/checkout',{method:'POST',headers:{Origin:'https://app.test'}});
describe('public checkout access errors',()=>{
 it('returns a fixed stage code to an authenticated buyer',async()=>{state.unexpected=false;const response=await POST(request());expect(response.status).toBe(502);expect((await response.json()).error).toContain('SF_TOKEN_LOOKUP_SCHEMA');});
 it('does not pass an unknown exception message into the browser',async()=>{state.unexpected=true;const response=await POST(request());expect(response.status).toBe(502);expect(await response.text()).not.toContain('fixture-credential');});
});
