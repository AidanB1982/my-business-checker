import { beforeEach,describe,it,expect,vi } from 'vitest';
const state=vi.hoisted(()=>({available:true,active:false,history:false,fetchCalls:[] as unknown[],inserted:null as unknown,cartPrice:'1.99'}));
vi.mock('server-only',()=>({}));
vi.mock('@/lib/api',async()=>{const actual=await vi.importActual<typeof import('../../src/lib/api')>('@/lib/api');return {...actual,authenticated:async()=>({user:{id:'00000000-0000-4000-8000-000000000001',email:'fixture@example.test'},supabase:{from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{status:state.active?'active':'inactive',current_period_end:'2099-01-01T00:00:00Z',billing_customer_id:state.history?'shopify:fixture':null},error:null})})})})}})};});
vi.mock('@/lib/shopify/config',()=>({billingAvailable:()=>state.available,shopifyConfig:()=>({store:'blackwoodpublishing.myshopify.com',token:'fixture-storefront-token',variant:'404',plan:'505'})}));
vi.mock('@/lib/supabase/admin',()=>({createAdmin:()=>({from:()=>({insert:async(value:unknown)=>{state.inserted=value;return {error:null};}})})}));
import { POST } from '../../src/app/api/billing/checkout/route';
const request=()=>new Request('https://app.test/api/billing/checkout',{method:'POST',headers:{Origin:'https://app.test'}});
beforeEach(()=>{state.available=true;state.active=false;state.history=false;state.fetchCalls=[];state.inserted=null;state.cartPrice='1.99';vi.stubGlobal('fetch',vi.fn(async(...args:unknown[])=>{state.fetchCalls.push(args);return new Response(JSON.stringify({data:{cartCreate:{cart:{checkoutUrl:'https://blackwoodpublishing.myshopify.com/checkout/fixture',cost:{totalAmount:{amount:state.cartPrice,currencyCode:'GBP'}},lines:{nodes:[{quantity:1,merchandise:{id:'gid://shopify/ProductVariant/404'},sellingPlanAllocation:{sellingPlan:{id:'gid://shopify/SellingPlan/505'}}}]}},userErrors:[]}}}),{status:200});}));});
describe('Shopify recurring cart',()=>{
 it('stays disabled until configuration is complete',async()=>{state.available=false;expect((await POST(request())).status).toBe(503);expect(state.fetchCalls).toEqual([]);});
 it('creates only the configured recurring £1.99 cart and an opaque link',async()=>{
  const response=await POST(request());expect(response.status).toBe(200);expect(state.inserted).toMatchObject({user_id:'00000000-0000-4000-8000-000000000001',variant_id:'404',token_hash:expect.stringMatching(/^[a-f0-9]{64}$/)});
  const options=(state.fetchCalls[0] as [unknown,{body:string}])[1];const body=JSON.parse(options.body);expect(body.variables.input.lines[0].sellingPlanId).toBe('gid://shopify/SellingPlan/505');expect(body.variables.input.attributes[0].value).not.toBe((state.inserted as {token_hash:string}).token_hash);
 });
 it('rejects a cart with the wrong charged amount',async()=>{state.cartPrice='2.99';expect((await POST(request())).status).toBe(502);});
 it('avoids duplicate contracts for active and previously linked accounts',async()=>{state.active=true;expect((await POST(request())).status).toBe(409);state.active=false;state.history=true;expect((await POST(request())).status).toBe(409);expect(state.fetchCalls).toEqual([]);});
});
