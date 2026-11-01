import { beforeEach,describe,it,expect,vi } from 'vitest';
const state=vi.hoisted(()=>({user:true,advanced:true,inserted:null as unknown,filters:[] as unknown[],savedRows:[{id:'00000000-0000-4000-8000-000000000003'}],operation:'',row:null as unknown}));
vi.mock('server-only',()=>({}));
vi.mock('@/lib/config',()=>({isSupabaseConfigured:()=>true}));
vi.mock('@/lib/supabase/server',()=>({createClient:async()=>({auth:{getUser:async()=>({data:{user:state.user?{id:'00000000-0000-4000-8000-000000000001'}:null},error:null})},from:(table:string)=>{
 if(table==='subscriptions')return {select:()=>({eq:()=>({maybeSingle:async()=>({data:{status:state.advanced?'active':'inactive',current_period_end:'2099-01-01T00:00:00Z'},error:null})})})};
 const builder={insert:(value:unknown)=>{state.inserted=value;state.operation='insert';return builder;},delete:()=>{state.operation='delete';return builder;},select:()=>state.operation==='delete'?Promise.resolve({data:state.savedRows,error:null}):builder,eq:(key:string,value:unknown)=>{state.filters.push([key,value]);return builder;},single:async()=>({data:state.savedRows[0],error:null}),maybeSingle:async()=>({data:state.row,error:null})};return builder;
}})}));
import { POST } from '../../src/app/api/calculations/route';
import { DELETE } from '../../src/app/api/calculations/[id]/route';
import { GET } from '../../src/app/api/calculations/[id]/report/route';
import { buildSnapshot } from '../../src/lib/reports/calculations';
const calculation={toolSlug:'business-mileage-calculator' as const,taxYear:'2026/27' as const,inputs:{miles:12000}};
const payload={title:'My plan',calculation,expectedRuleSetVersion:'draft-1',consent:true};
const request=(body:unknown=payload,origin='https://app.test')=>new Request('https://app.test/api/calculations',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)});
beforeEach(()=>{state.user=true;state.advanced=true;state.inserted=null;state.filters=[];state.operation='';state.savedRows=[{id:'00000000-0000-4000-8000-000000000003'}];state.row=null;});
describe('calculation APIs',()=>{
 it('requires same-origin requests and authentication',async()=>{expect((await POST(request(payload,'https://evil.test'))).status).toBe(403);state.user=false;expect((await POST(request())).status).toBe(401);});
 it('accepts the browser Host when an internal proxy URL uses localhost',async()=>{const proxied=new Request('http://localhost:3000/api/calculations',{method:'POST',headers:{Host:'127.0.0.1:3000',Origin:'http://127.0.0.1:3000','Content-Type':'application/json'},body:JSON.stringify(payload)});expect((await POST(proxied)).status).toBe(201);});
 it('requires paid access for new saves',async()=>{state.advanced=false;expect((await POST(request())).status).toBe(402);expect(state.inserted).toBeNull();});
 it('requires explicit consent and a supported current rule version',async()=>{expect((await POST(request({...payload,consent:false}))).status).toBe(400);expect((await POST(request({...payload,expectedRuleSetVersion:'old'}))).status).toBe(409);});
 it('rejects client-supplied result fields instead of trusting them',async()=>{expect((await POST(request({...payload,result:{allowance:999999}}))).status).toBe(400);});
 it('recalculates and saves under the authenticated user',async()=>{expect((await POST(request())).status).toBe(201);expect(state.inserted).toMatchObject({user_id:'00000000-0000-4000-8000-000000000001',result:{metrics:expect.arrayContaining([expect.objectContaining({key:'allowance',value:600000})])}});});
 it('deletes only owned records even after paid access ends',async()=>{state.advanced=false;const response=await DELETE(new Request('https://app.test/api/calculations/id',{method:'DELETE',headers:{Origin:'https://app.test'}}),{params:Promise.resolve({id:state.savedRows[0].id})});expect(response.status).toBe(204);expect(state.filters).toContainEqual(['user_id','00000000-0000-4000-8000-000000000001']);});
 it('returns not found for an inaccessible report',async()=>{expect((await GET(new Request('https://app.test/report'),{params:Promise.resolve({id:state.savedRows[0].id})})).status).toBe(404);});
 it('exports safe reports from owned snapshots after expiry',async()=>{state.advanced=false;state.row={title:'<script>bad</script>',inputs:calculation.inputs,result:buildSnapshot(calculation)};const response=await GET(new Request('https://app.test/report'),{params:Promise.resolve({id:state.savedRows[0].id})});expect(response.status).toBe(200);expect(response.headers.get('cache-control')).toBe('private, no-store');expect(await response.text()).not.toContain('<script>');expect(state.filters).toContainEqual(['user_id','00000000-0000-4000-8000-000000000001']);});
});
