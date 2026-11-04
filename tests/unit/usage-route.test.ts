import { beforeEach,it,expect,vi } from 'vitest';
const state=vi.hoisted(()=>({signed:true,anonymous:false,error:false,calls:[] as unknown[]}));
vi.mock('server-only',()=>({}));
vi.mock('@/lib/api',async()=>{const actual=await vi.importActual<typeof import('../../src/lib/api')>('@/lib/api');return {...actual,authenticated:async()=>{if(!state.signed)throw new actual.ApiError(401,'Sign in.');return {user:{id:'verified-user',is_anonymous:state.anonymous},supabase:{rpc:async(name:string,args:unknown)=>{state.calls.push([name,args]);return {error:state.error?{message:'private database detail'}:null};}}};}};});
import { POST,DELETE } from '../../src/app/api/usage/route';
const req=(body:unknown={page:'workspace',consent:true},origin='https://app.test')=>new Request('https://app.test/api/usage',{method:'POST',headers:{origin},body:JSON.stringify(body)});
beforeEach(()=>{state.signed=true;state.anonymous=false;state.error=false;state.calls=[];});
it('requires a same-origin signed-in request',async()=>{expect((await POST(req(undefined,'https://other.test'))).status).toBe(403);state.signed=false;expect((await POST(req())).status).toBe(401);expect((await DELETE(req())).status).toBe(401);expect(state.calls).toEqual([]);});
it('rejects anonymous sessions, missing consent, extra financial fields and arbitrary URLs',async()=>{
 state.anonymous=true;expect((await POST(req())).status).toBe(403);state.anonymous=false;
 for(const body of [{page:'workspace'},{page:'workspace',consent:false},{page:'workspace',consent:true,salary:50000},{page:'/tools/x?email=private',consent:true},{page:'workspace',consent:true,user_id:'other'},[],null])expect((await POST(req(body))).status).toBe(400);
 expect(state.calls).toEqual([]);
});
it('records only a fixed page label, leaving identity and timestamps to the database',async()=>{const response=await POST(req({page:'business-mileage-calculator',consent:true}));expect(response.status).toBe(204);expect(response.headers.get('Cache-Control')).toBe('private, no-store');expect(state.calls).toEqual([['record_app_activity',{p_page:'business-mileage-calculator'}]]);});
it('history deletion is limited to the authenticated caller by the database function',async()=>{expect((await DELETE(req())).status).toBe(204);expect(state.calls).toEqual([['delete_my_app_activity',undefined]]);});
it('does not expose database error details',async()=>{state.error=true;const response=await POST(req());expect(response.status).toBe(503);expect(await response.text()).not.toContain('private database detail');});
