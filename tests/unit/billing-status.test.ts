import { beforeEach,describe,it,expect,vi } from 'vitest';
const state=vi.hoisted(()=>({signedIn:true,error:false,subscription:null as null|{status:string;current_period_end:string},userId:''}));
vi.mock('server-only',()=>({}));
vi.mock('@/lib/api',async()=>{const actual=await vi.importActual<typeof import('../../src/lib/api')>('@/lib/api');return {...actual,authenticated:async()=>{if(!state.signedIn)throw new actual.ApiError(401,'Sign in to use your account.');return {user:{id:'fixture-user'},supabase:{from:()=>({select:()=>({eq:(column:string,id:string)=>{state.userId=id;return {maybeSingle:async()=>({data:state.subscription,error:state.error?{message:'private database details'}:null})};}})})}};}};});
import { GET } from '../../src/app/api/billing/status/route';
beforeEach(()=>{state.signedIn=true;state.error=false;state.subscription=null;state.userId='';});
describe('confirmed billing status',()=>{
 it('requires a signed-in account',async()=>{state.signedIn=false;expect((await GET()).status).toBe(401);});
 it('does not activate an unpaid account',async()=>{const response=await GET();expect(await response.json()).toEqual({advanced:false});expect(state.userId).toBe('fixture-user');expect(response.headers.get('Cache-Control')).toBe('private, no-store');});
 it('confirms only an active paid period',async()=>{state.subscription={status:'active',current_period_end:'2099-01-01T00:00:00Z'};expect(await (await GET()).json()).toEqual({advanced:true});state.subscription.current_period_end='2000-01-01T00:00:00Z';expect(await (await GET()).json()).toEqual({advanced:false});});
 it('does not expose database failures',async()=>{state.error=true;const response=await GET();expect(response.status).toBe(503);expect(await response.text()).not.toContain('private database details');});
});
