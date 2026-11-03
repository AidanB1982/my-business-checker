// Operator-only: always restores to a new, isolated, in-memory database.
import { PGlite } from '@electric-sql/pglite';
import { readFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { invoiceLine,invoiceTotal } from './invoices';
import { backupTables,verifyBackup,canonical,backupBook,backupFinancialCheck,validateBankChecks,type BackupData,type BackupTable } from './backup-format';
export const bookkeepingMigrations=['202611010001_initial_schema.sql','202611030001_bookkeeping.sql','202611030002_customer_supplier_accounts.sql','202611030003_invoices.sql','202611030004_premium_bookkeeping.sql'];
export async function freshBookkeepingDatabase(){
 const db=new PGlite();try{await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;`);
 for(const name of bookkeepingMigrations)await db.exec(await readFile(new URL('../../../supabase/migrations/'+name,import.meta.url),'utf8'));return db;}catch(e){await db.close();throw e;}
}
export function parseBackupFile(bytes:Uint8Array){if(bytes.byteLength>4*1024*1024)throw new Error('Compressed backup is too large.');const raw=gunzipSync(bytes,{maxOutputLength:25*1024*1024});return verifyBackup(JSON.parse(raw.toString('utf8')));}
function orderedJournals(rows:Record<string,unknown>[]){const pending=[...rows],result:typeof rows=[],done=new Set<unknown>();while(pending.length){const index=pending.findIndex(r=>['document_id','reversal_of'].every(k=>r[k]==null||r[k]===r.id||done.has(r[k])));if(index<0)throw new Error('Missing or cyclic journal references.');const [row]=pending.splice(index,1);result.push(row);done.add(row.id);}return result;}
export async function restoreAndVerify(data:BackupData){
 backupFinancialCheck(data);validateBankChecks(backupBook(data));const db=await freshBookkeepingDatabase();
 try{
 await db.query('insert into auth.users(id) values($1)',[data.owner_id]);await db.exec('begin');
 const order:BackupTable[]=['bookkeeping_books','bookkeeping_contacts','bookkeeping_brand_assets','bookkeeping_invoice_sequences','bookkeeping_journals','bookkeeping_lines','bookkeeping_contact_links','bookkeeping_contact_openings','bookkeeping_reconciliations','bookkeeping_audit','bookkeeping_invoice_profiles','bookkeeping_invoices'];
 for(const table of order){
  const columns=(await db.query<{column_name:string;udt_name:string}>('select column_name,udt_name from information_schema.columns where table_schema=$1 and table_name=$2',['public',table])).rows;
  const allowed=new Map(columns.map(c=>[c.column_name,c.udt_name]));
  for(const row of table==='bookkeeping_journals'?orderedJournals(data.tables[table]):data.tables[table]){
   const keys=Object.keys(row);if(keys.length!==allowed.size||keys.some(k=>!allowed.has(k)))throw new Error('Backup column layout does not match this application version.');
   const values=keys.map(k=>['json','jsonb'].includes(allowed.get(k)!)&&row[k]!==null?JSON.stringify(row[k]):row[k]);
   await db.query(`insert into public.${table} (${keys.map(k=>'"'+k+'"').join(',')}) overriding system value values (${keys.map((_,i)=>'$'+(i+1)).join(',')})`,values);
  }
 }
 await db.exec('commit');
 for(const table of ['bookkeeping_lines','bookkeeping_audit'])await db.query(`select setval(pg_get_serial_sequence('public.${table}','id'),coalesce((select max(id)+1 from public.${table}),1),false)`);
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[data.owner_id]);await db.exec('set role authenticated');
 const copy=(await db.query<{data:BackupData}>('select public.bookkeeping_backup($1) data',[data.book_id])).rows[0].data;
 if(canonical(copy.tables)!==canonical(data.tables))throw new Error('Restored rows differ from the backup.');
 const r=backupFinancialCheck(copy);validateBankChecks(backupBook(copy));
 for(const invoice of copy.tables.bookkeeping_invoices){
  if(!Array.isArray(invoice.lines)||invoiceTotal(invoice.lines.map(l=>invoiceLine.parse(l)))!==invoice.total)throw new Error('Restored invoice items do not match their total.');
  if(invoice.status!=='posted')continue;
  const doc=copy.tables.bookkeeping_journals.find(j=>j.id===invoice.journal_id);
  const account=invoice.kind==='customer'?'receivable':'payable',total=copy.tables.bookkeeping_lines.filter(l=>l.journal_id===doc?.id&&l.account===account).reduce((n,l)=>n+(invoice.kind==='customer'?Number(l.debit)-Number(l.credit):Number(l.credit)-Number(l.debit)),0);
  if(!doc||total!==invoice.total)throw new Error('Restored invoice and ledger amounts do not match.');
 }
 for(const details of [...copy.tables.bookkeeping_invoice_profiles.map(p=>p.details),...copy.tables.bookkeeping_invoices.map(i=>i.issuer)]){if(details&&typeof details==='object'&&'logo_id' in details&&!copy.tables.bookkeeping_brand_assets.some(a=>a.id===details.logo_id))throw new Error('Restored branding asset is missing.');}
 const largestNumber=Math.max(0,...copy.tables.bookkeeping_invoices.filter(i=>i.kind==='customer'&&i.status==='posted'&&/^INV-\d+$/.test(String(i.number))).map(i=>Number(String(i.number).slice(4))));
 if(largestNumber&&Number(copy.tables.bookkeeping_invoice_sequences[0]?.next_number??0)<=largestNumber)throw new Error('Restored invoice sequence would reuse an issued number.');
 const read=(await db.query<{data:{canWrite:boolean}}>('select public.bookkeeping_read($1) data',[data.book_id])).rows[0].data;
 if(read.canWrite)throw new Error('Backup must not restore membership privileges.');
 let paidDenied=false;try{await db.query("select public.bookkeeping_create('Restore permission test','sole-trader','2026-01-01')");}catch(error){paidDenied=error instanceof Error&&error.message.includes('BOOKS_PAID');}if(!paidDenied)throw new Error('Restored expired membership allowed a write.');
 const other=crypto.randomUUID();await db.exec('reset role');await db.query('insert into auth.users(id) values($1)',[other]);await db.query("select set_config('request.jwt.claim.sub',$1,false)",[other]);await db.exec('set role authenticated');
 for(const table of backupTables){try{if((await db.query(`select * from public.${table}`)).rows.length)throw new Error('Restored ownership isolation failed.');}catch(error){if(!(error instanceof Error)||!error.message.startsWith('permission denied for table '))throw error;}}
 let denied=false;try{await db.query('select public.bookkeeping_backup($1)',[data.book_id]);}catch{denied=true;}if(!denied)throw new Error('Restored export isolation failed.');
 return {tables:backupTables.length,rows:backupTables.reduce((n,t)=>n+copy.tables[t].length,0),journals:copy.tables.bookkeeping_journals.length,invoices:copy.tables.bookkeeping_invoices.length,trialDifference:r.trialDifference,balanceDifference:r.balanceDifference};
 }finally{await db.close();}
}
