import { beforeEach,it,expect,vi } from 'vitest';
const state=vi.hoisted(()=>({signed:true,paid:true,error:null as null|{message:string;code?:string},calls:[] as {name:string;args:Record<string,unknown>}[]}));
vi.mock('server-only',()=>({}));
vi.mock('@/lib/api',async()=>{
 const actual=await vi.importActual<typeof import('../../src/lib/api')>('@/lib/api');
 return {...actual,authenticated:async()=>{
  if(!state.signed)throw new actual.ApiError(401,'Sign in.');
  return {user:{id:'11111111-1111-4111-8111-111111111111'},supabase:{rpc:async(name:string,args:Record<string,unknown>)=>{
   state.calls.push({name,args});
   const data=name==='bookkeeping_read'?{book:{id:args.p_book,start_date:'2026-01-01',type:'landlord',opening_set:true},journals:[],lines:[],canWrite:state.paid}:name==='bookkeeping_paid'?state.paid:'22222222-2222-4222-8222-222222222222';
   return {error:state.error,data};
  }}};
 }};
});
import { POST,GET } from '../../src/app/api/bookkeeping/[id]/route';
import { POST as create } from '../../src/app/api/bookkeeping/route';
const id='22222222-2222-4222-8222-222222222222',ctx={params:Promise.resolve({id})};
const request=(body:unknown,origin='https://app.test')=>new Request('https://app.test/api/bookkeeping/'+id,{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify(body)});
const entry={action:'entry',data:{request_id:'33333333-3333-4333-8333-333333333333',kind:'income',date:'2026-01-10',description:'Rent',amount:100000}};
beforeEach(()=>{state.signed=true;state.paid=true;state.error=null;state.calls=[];});
it('rejects missing sessions and cross-origin writes before touching the ledger',async()=>{expect((await POST(request(entry,'https://evil.test'),ctx)).status).toBe(403);state.signed=false;expect((await POST(request(entry),ctx)).status).toBe(401);expect(state.calls).toHaveLength(0);});
it('denies expired paid writes even if the client enables its form',async()=>{state.paid=false;expect((await POST(request(entry),ctx)).status).toBe(402);expect(state.calls.map(c=>c.name)).toEqual(['bookkeeping_read']);});
it('constructs both balanced sides on the server with the owned book and landlord income account',async()=>{expect((await POST(request(entry),ctx)).status).toBe(200);expect(state.calls.at(-1)).toMatchObject({name:'bookkeeping_post',args:{p_book:id,p_kind:'income',p_lines:[{account:'bank',debit:100000,credit:0},{account:'rent',debit:0,credit:100000}]}});});
it('does not accept client-defined lines, owners or fractions of a penny',async()=>{expect((await POST(request({...entry,data:{...entry.data,lines:[{account:'bank',debit:1,credit:0}]}}),ctx)).status).toBe(400);expect((await POST(request({...entry,data:{...entry.data,amount:0.1}}),ctx)).status).toBe(400);expect(state.calls).toHaveLength(0);});
it('returns setup and permission errors without leaking raw database messages',async()=>{state.error={code:'PGRST202',message:'secret database details'};const response=await GET(new Request('https://app.test/api/bookkeeping/'+id),ctx);expect(response.status).toBe(503);expect(await response.text()).toContain('BOOKS_SETUP_REQUIRED');state.error={message:'BOOKS_PERMISSION'};expect((await GET(new Request('https://app.test'),ctx)).status).toBe(404);});
it('requires no new credentials for book creation and relies on the paid database function',async()=>{expect((await create(request({name:'My property',type:'landlord',start_date:'2026-01-01'}))).status).toBe(201);expect(state.calls[0]).toEqual({name:'bookkeeping_create',args:{p_name:'My property',p_type:'landlord',p_start:'2026-01-01'}});});
