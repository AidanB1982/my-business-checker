import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { beforeAll, afterAll, describe, expect, it } from 'vitest';
const db = new PGlite();
const alice='00000000-0000-4000-8000-000000000001';
const bob='00000000-0000-4000-8000-000000000002';
async function asUser(id:string) {
 await db.exec('reset role; set role authenticated;');
 await db.query("select set_config('request.jwt.claim.sub', $1, false)",[id]);
}
async function admin() {await db.exec('reset role');}
beforeAll(async()=>{
 await db.exec(`create role anon; create role authenticated; create schema auth;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth to authenticated;
 grant execute on function auth.uid() to authenticated;
 insert into auth.users values('${alice}'),('${bob}');`);
 await db.exec(await readFile(new URL('../../supabase/migrations/202611010001_initial_schema.sql',import.meta.url),'utf8'));
},15000);
afterAll(async()=>{await db.close();});
describe('PostgreSQL grants and RLS',()=>{
 it('denies anonymous access',async()=>{
  await db.exec('set role anon');
  await expect(db.query('select * from public.saved_calculations')).rejects.toThrow(/permission denied/);
  await admin();
 });
 it('does not let a user create their own paid subscription',async()=>{
  await asUser(alice);
  await expect(db.query("insert into public.subscriptions(user_id,status,current_period_end) values($1,'active',now()+interval '30 days')",[alice])).rejects.toThrow(/permission denied/);
 });
 it('blocks saving on a free account',async()=>{
  await asUser(alice);
  await expect(db.query("insert into public.saved_calculations(user_id,tool_slug,tax_year,rule_set_version,title,inputs,result) values($1,'mileage','2025/26','draft-1','Test','{}','{}')",[alice])).rejects.toThrow(/row-level security/);
 });
 it('allows a paid user to save and see only their own data',async()=>{
  await admin();
  await db.query("insert into public.subscriptions(user_id,status,current_period_end) values($1,'active',now()+interval '30 days')",[alice]);
  await asUser(alice);
  await db.query("insert into public.saved_calculations(user_id,tool_slug,tax_year,rule_set_version,title,inputs,result) values($1,'mileage','2025/26','draft-1','Test','{}','{}')",[alice]);
  expect((await db.query('select * from public.saved_calculations')).rows).toHaveLength(1);
  await asUser(bob);
  expect((await db.query('select * from public.saved_calculations')).rows).toHaveLength(0);
  expect((await db.query('select * from public.subscriptions')).rows).toHaveLength(0);
  await db.query("update public.saved_calculations set title='Changed'");
  await db.query('delete from public.saved_calculations');
  await asUser(alice);
  const result=await db.query<{title:string}>('select title from public.saved_calculations');
  expect(result.rows).toEqual([{title:'Test'}]);
 });
 it('prevents a paid user saving as another user or transferring ownership',async()=>{
  await asUser(alice);
  await expect(db.query("insert into public.saved_calculations(user_id,tool_slug,tax_year,rule_set_version,title,inputs,result) values($1,'mileage','2025/26','draft-1','Test','{}','{}')",[bob])).rejects.toThrow(/row-level security/);
  await expect(db.query('update public.saved_calculations set user_id=$1',[bob])).rejects.toThrow(/row-level security/);
 });
 it('keeps existing data readable and deletable when a subscription expires',async()=>{
  await admin();
  await db.query("update public.subscriptions set current_period_end=now()-interval '1 day' where user_id=$1",[alice]);
  await asUser(alice);
  expect((await db.query('select * from public.saved_calculations')).rows).toHaveLength(1);
  await db.query("update public.saved_calculations set title='Expired update'");
  expect((await db.query<{title:string}>('select title from public.saved_calculations')).rows[0].title).toBe('Test');
  await db.query('delete from public.saved_calculations');
  expect((await db.query('select * from public.saved_calculations')).rows).toHaveLength(0);
 });
 it('hides rule administration from signed-in users',async()=>{
  await asUser(alice);
  await expect(db.query('select * from public.rule_sets')).rejects.toThrow(/permission denied/);
 });
 it('requires source review to publish and prevents later edits or deletes',async()=>{
  await admin();
  await expect(db.query("insert into public.rule_sets(tax_year,version,status,rules,sources) values('2025/26',1,'published','{}','[]')")).rejects.toThrow(/check constraint/);
  await db.query("insert into public.rule_sets(tax_year,version,status,rules,sources,reviewed_at,published_at) values('2025/26',1,'published','{}','[\"https://www.gov.uk\"]',now(),now())");
  await expect(db.query("update public.rule_sets set rules='{\"changed\":true}'")).rejects.toThrow(/immutable/);
  await expect(db.query('delete from public.rule_sets')).rejects.toThrow(/immutable/);
 });
});
