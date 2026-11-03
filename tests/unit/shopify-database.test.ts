import { PGlite } from '@electric-sql/pglite';
import { beforeAll,afterAll,describe,it,expect } from 'vitest';
import { readFile } from 'node:fs/promises';
const db=new PGlite();
const alice='00000000-0000-4000-8000-000000000001',bob='00000000-0000-4000-8000-000000000002';
const shop='blackwoodpublishing.myshopify.com';
const now=new Date();const end=new Date(now.getTime()+30*86400000).toISOString();
let serial=0;
async function admin(){await db.exec('reset role');}
async function link(user=alice,hash=(++serial).toString(16).padStart(64,'0')){await admin();await db.query("insert into public.shopify_checkout_links(token_hash,user_id,variant_id,expires_at) values($1,$2,'404',now()+interval '1 day')",[hash,user]);return hash;}
async function paid(order:string,customer:string,hash:string|null=null){return db.query<{applied:boolean}>('select public.apply_shopify_membership_payment($1,$2,$3,$4,$5,$6,$7,$8) as applied',[shop,order,customer,`line-${order}`,now.toISOString(),end,hash,'404']);}
async function reverse(order:string,complete=true,lines:string[]=[`line-${order}`]){return db.query('select public.reverse_shopify_membership_payment($1,$2,$3,$4,$5)',[shop,order,`event-${++serial}`,lines,complete]);}
beforeAll(async()=>{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;insert into auth.users values('${alice}'),('${bob}');`);
 for(const file of ['202611010001_initial_schema.sql','202611010002_shopify_membership.sql','202611030007_membership_autocheck.sql'])await db.exec(await readFile(new URL('../../supabase/migrations/'+file,import.meta.url),'utf8'));
},20000);
afterAll(async()=>{await db.close();});
describe('Shopify SQL paid-period ledger',()=>{
 it('denies authenticated users and anonymous callers access to billing tables and RPCs',async()=>{
  for(const role of ['anon','authenticated']){await db.exec(`set role ${role}`);await expect(db.query('select * from public.shopify_checkout_links')).rejects.toThrow(/permission denied/);await expect(paid('denied','customer')).rejects.toThrow(/permission denied/);await admin();}
 });
 it('does not link a customer by email or an untrusted user id',async()=>{await admin();await expect(paid('unlinked','unknown')).rejects.toThrow(/account link/);});
 it('grants one paid period from a secure checkout link',async()=>{
  const hash=await link();const result=await paid('order-1','customer-1',hash);expect(result.rows[0].applied).toBe(true);
  const state=await db.query<{status:string;current_period_end:Date}>('select status,current_period_end from public.subscriptions where user_id=$1',[alice]);expect(state.rows[0].status).toBe('active');
  expect(new Date(state.rows[0].current_period_end).toISOString()).toBe(end);
 });
 it('repeated delivery of the same paid order cannot extend access',async()=>{
  const before=await db.query('select current_period_end from public.subscriptions where user_id=$1',[alice]);expect((await paid('order-1','customer-1')).rows[0].applied).toBe(false);
  expect((await db.query('select current_period_end from public.subscriptions where user_id=$1',[alice])).rows).toEqual(before.rows);
 });
 it('links subsequent paid renewals by the trusted Shopify customer mapping',async()=>{
  expect((await paid('order-2','customer-1')).rows[0].applied).toBe(true);
 });
 it('does not let another account claim an already linked customer',async()=>{
  const hash=await link(bob);await expect(paid('stolen','customer-1',hash)).rejects.toThrow(/another account/);
 });
 it('does not revoke a later paid period when an earlier order is refunded',async()=>{
  await reverse('order-1');expect((await db.query<{status:string}>('select status from public.subscriptions where user_id=$1',[alice])).rows[0].status).toBe('active');
 });
 it('revokes paid access when the remaining paid period is refunded',async()=>{
  await reverse('order-2');expect((await db.query<{status:string}>('select status from public.subscriptions where user_id=$1',[alice])).rows[0].status).toBe('canceled');
 });
 it('handles a refund delivered before its paid-order webhook',async()=>{
  await reverse('order-3',false,['line-order-3']);expect((await paid('order-3','customer-1')).rows[0].applied).toBe(false);
  expect((await db.query<{refunded:boolean}>("select refunded from public.shopify_membership_orders where order_id='order-3'")).rows[0].refunded).toBe(true);
  expect((await db.query<{status:string}>('select status from public.subscriptions where user_id=$1',[alice])).rows[0].status).toBe('canceled');
 });
 it('does not revoke membership when a different product is refunded',async()=>{
  await paid('order-4','customer-1');await reverse('order-4',false,['book-line']);expect((await db.query<{status:string}>('select status from public.subscriptions where user_id=$1',[alice])).rows[0].status).toBe('active');
 });
 it('rejects expired checkout links and impossible billing periods',async()=>{
  const hash=await link(bob);await db.query("update public.shopify_checkout_links set expires_at=now()-interval '2 days' where token_hash=$1",[hash]);await expect(paid('expired','customer-2',hash)).rejects.toThrow(/expired/);
  await expect(db.query('select public.apply_shopify_membership_payment($1,$2,$3,$4,now(),now()+interval \'1 year\',null,$5)',[shop,'bad-period','customer-1','line','404'])).rejects.toThrow(/period/);
 });
 it('grants execution to the service role without exposing it to users',async()=>{
  await db.exec('set role service_role');expect((await paid('order-service','customer-1')).rows[0].applied).toBe(true);await admin();
 });
 it('enforces saved snapshot size limits even through direct authenticated inserts',async()=>{
  await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[alice]);
  await expect(db.query("insert into public.saved_calculations(user_id,tool_slug,tax_year,rule_set_version,title,inputs,result) values($1,'mileage','2026/27','draft-1','Oversize','{}',jsonb_build_object('value',repeat('x',70000)))",[alice])).rejects.toThrow(/size_limit/);await admin();
 });
 it('keeps user data isolated after billing grants access',async()=>{
  await db.exec('set role authenticated');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[bob]);expect((await db.query('select * from public.subscriptions')).rows).toHaveLength(0);await admin();
 });
});

it('serializes automatic membership checks in a private service-only lease',async()=>{await admin();await db.exec('set role authenticated');await expect(db.query('select public.claim_shopify_membership_check($1)',[alice])).rejects.toThrow('permission denied');await admin();await db.exec('set role service_role');expect((await db.query<{claimed:boolean}>('select public.claim_shopify_membership_check($1) claimed',[alice])).rows[0].claimed).toBe(true);expect((await db.query<{claimed:boolean}>('select public.claim_shopify_membership_check($1) claimed',[alice])).rows[0].claimed).toBe(false);await admin();});
