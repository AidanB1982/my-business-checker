import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll,afterAll,it,expect } from 'vitest';
import type { OwnerStats } from '@/lib/usage';
const db=new PGlite();
const owner='00000000-0000-4000-8000-000000000001',alice='00000000-0000-4000-8000-000000000002',bob='00000000-0000-4000-8000-000000000003',anonymous='00000000-0000-4000-8000-000000000004';
async function asUser(id:string,role='authenticated'){await db.exec(`reset role;set role ${role}`);await db.query("select set_config('request.jwt.claim.sub',$1,false)",[id]);}
async function admin(){await db.exec('reset role');}
async function stats(){return (await db.query<{stats:OwnerStats}>('select public.owner_dashboard_stats() as stats')).rows[0].stats;}
beforeAll(async()=>{
 await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,created_at timestamptz not null default now(),is_anonymous boolean default false);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
 insert into auth.users(id,created_at,is_anonymous) values('${owner}',now()-interval '40 days',false),('${alice}',now(),false),('${bob}',now(),false),('${anonymous}',now(),true);`);
 await db.exec(await readFile(new URL('../../supabase/migrations/202611010001_initial_schema.sql',import.meta.url),'utf8'));
 await db.exec(await readFile(new URL('../../supabase/migrations/202611040001_owner_dashboard.sql',import.meta.url),'utf8'));
 await db.exec(`insert into public.app_owners values('${owner}');insert into public.subscriptions(user_id,status,current_period_end) values('${owner}','active',now()+interval '10 days'),('${alice}','active',now()-interval '1 day'),('${bob}','canceled',now()+interval '10 days');`);
},15000);
afterAll(async()=>{await db.close();});
it('blocks anonymous activity and aggregate access',async()=>{
 await asUser('','anon');await expect(stats()).rejects.toThrow(/permission denied/);await expect(db.query("select public.record_app_activity('workspace')")).rejects.toThrow(/permission denied/);
 await asUser(anonymous);await expect(db.query("select public.record_app_activity('workspace')")).rejects.toThrow(/Sign in required/);
});
it('never lets a normal user read activity, appoint an owner or fetch totals',async()=>{
 await asUser(alice);expect((await db.query<{owner:boolean}>('select public.is_app_owner() as owner')).rows[0].owner).toBe(false);
 for(const sql of ['select * from public.app_activity','select * from public.app_owners',`insert into public.app_owners values('${alice}')`])await expect(db.query(sql)).rejects.toThrow(/permission denied/);
 await expect(stats()).rejects.toThrow(/Owner access required/);
});
it('records only allowlisted pages, deduplicated for the authenticated user and UTC day',async()=>{
 await asUser(alice);await db.query("select public.record_app_activity('workspace')");await db.query("select public.record_app_activity('workspace')");await db.query("select public.record_app_activity('business-mileage-calculator')");
 await expect(db.query("select public.record_app_activity('/tools/mileage?salary=123')")).rejects.toThrow(/check constraint/);
 await admin();const rows=(await db.query<{user_id:string,page:string}>('select user_id,page from public.app_activity')).rows;expect(rows).toHaveLength(2);expect(rows.every(r=>r.user_id===alice)).toBe(true);
});
it('counts unique accounts, current paid access and UTC day boundaries correctly',async()=>{
 await admin();await db.exec(`insert into public.app_activity values('${bob}',(now() at time zone 'UTC')::date-6,'business-mileage-calculator'),('${alice}',(now() at time zone 'UTC')::date-7,'business-mileage-calculator'),('${owner}',(now() at time zone 'UTC')::date-29,'workspace'),('${owner}',(now() at time zone 'UTC')::date-30,'pension-pot-predictor');`);
 await asUser(owner);const result=await stats();expect(result).toMatchObject({registeredUsers:3,newUsers30:2,advancedMembers:1,activeUsers7:2,activeUsers30:3});expect(result.topTools).toEqual([{page:'business-mileage-calculator',users:2}]);expect(result.dailyActivity).toHaveLength(30);expect(result.dailyActivity.at(-1)?.users).toBe(1);
 // Even the owner gets aggregates, not permission to retrieve individuals.
 await expect(db.query('select * from public.app_activity')).rejects.toThrow(/permission denied/);
});
it('purges old activity on recording and deletes only the callers history',async()=>{
 await admin();await db.exec(`insert into public.app_activity values('${bob}',(now() at time zone 'UTC')::date-90,'workspace');`);
 await asUser(alice);await db.query("select public.record_app_activity('workspace')");await db.query('select public.delete_my_app_activity()');
 await admin();expect((await db.query('select * from public.app_activity where user_id=$1',[alice])).rows).toHaveLength(0);expect((await db.query('select * from public.app_activity where activity_day<(now() at time zone \'UTC\')::date-89')).rows).toHaveLength(0);expect((await db.query('select * from public.app_activity where user_id=$1',[bob])).rows).toHaveLength(1);
});
it('removes activity on account deletion and revokes dashboard access when ownership is removed',async()=>{
 await admin();await db.query('delete from auth.users where id=$1',[bob]);await asUser(owner);expect((await stats()).registeredUsers).toBe(2);
 await admin();await db.query('delete from public.app_owners where user_id=$1',[owner]);await asUser(owner);await expect(stats()).rejects.toThrow(/Owner access required/);
});
