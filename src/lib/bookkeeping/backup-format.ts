import { createHash } from 'node:crypto';
import { z } from 'zod';
import { accountingReports,type BookData } from './engine';
import { checkAssetRegister,type AssetData } from './assets';
export const backupTables=['bookkeeping_books','bookkeeping_contacts','bookkeeping_journals','bookkeeping_lines','bookkeeping_contact_links','bookkeeping_contact_openings','bookkeeping_reconciliations','bookkeeping_audit','bookkeeping_invoice_profiles','bookkeeping_invoice_sequences','bookkeeping_invoices','bookkeeping_brand_assets','bookkeeping_cost_projects','bookkeeping_project_costs','bookkeeping_assets','bookkeeping_asset_charges'] as const;
export type BackupTable=typeof backupTables[number];
const row=z.record(z.string(),z.unknown());
export const backupDataSchema=z.object({book_id:z.uuid(),owner_id:z.uuid(),exported_at:z.string().datetime({offset:true}),tables:z.object(Object.fromEntries(backupTables.map(t=>[t,z.array(row).max(100000).default([])])) as Record<BackupTable,z.ZodDefault<z.ZodArray<typeof row>>>).strict()}).strict();
export type BackupData=z.infer<typeof backupDataSchema>;
export function canonical(value:unknown):string{if(value===null||typeof value!=='object')return JSON.stringify(value);if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';return '{'+Object.entries(value).sort(([a],[b])=>a.localeCompare(b,'en')).map(([key,v])=>JSON.stringify(key)+':'+canonical(v)).join(',')+'}';}
export const digest=(value:unknown)=>createHash('sha256').update(canonical(value)).digest('hex');
export function validateBackupData(raw:unknown):BackupData{
 const tables=(raw as {tables?:Record<string,unknown>})?.tables;if(backupTables.slice(0,12).some(t=>!Array.isArray(tables?.[t])))throw new Error('Backup is missing required tables.');
 const data=backupDataSchema.parse(raw);if(data.tables.bookkeeping_books.length!==1)throw new Error('A portable backup must contain exactly one book.');
 const book=data.tables.bookkeeping_books[0];if(book.id!==data.book_id||book.owner_id!==data.owner_id)throw new Error('Backup ownership does not match.');
 for(const table of backupTables)for(const r of data.tables[table]){if(table==='bookkeeping_books')continue;if(table==='bookkeeping_invoice_sequences'){if(r.owner_id!==data.owner_id)throw new Error('Sequence ownership does not match.');}else if(r.book_id!==data.book_id)throw new Error('Backup contains a record from another book.');if('owner_id' in r&&r.owner_id!==data.owner_id)throw new Error('Record ownership does not match.');}
 return data;
}
export function makeBackup(raw:unknown){const data=validateBackupData(raw);return {format:'my-business-checker-bookkeeping',version:2,sha256:digest(data),data} as const;}
export function verifyBackup(raw:unknown){const parsed=z.object({format:z.literal('my-business-checker-bookkeeping'),version:z.union([z.literal(1),z.literal(2)]),sha256:z.string().regex(/^[a-f0-9]{64}$/),data:z.unknown()}).strict().parse(raw);if(digest(parsed.data)!==parsed.sha256)throw new Error('Backup checksum does not match; do not restore this file.');const value=parsed.data as {tables?:Record<string,unknown>};const required=parsed.version===1?backupTables.slice(0,12):backupTables;if(required.some(t=>!Array.isArray(value?.tables?.[t])))throw new Error('Backup is missing required tables.');return validateBackupData(parsed.data);}

export function backupBook(data:BackupData):AssetData{
 const t=data.tables;const profile=t.bookkeeping_invoice_profiles[0];return {book:t.bookkeeping_books[0],journals:t.bookkeeping_journals,lines:t.bookkeeping_lines,contacts:t.bookkeeping_contacts,contact_links:t.bookkeeping_contact_links,contact_openings:t.bookkeeping_contact_openings,reconciliations:t.bookkeeping_reconciliations,invoices:t.bookkeeping_invoices,invoice_profile:profile?{...(profile.details as object),version:profile.version}:null,audit:t.bookkeeping_audit,cost_projects:t.bookkeeping_cost_projects,project_costs:t.bookkeeping_project_costs,assets:t.bookkeeping_assets,asset_charges:t.bookkeeping_asset_charges,canWrite:false} as unknown as AssetData;
}
export function backupFinancialCheck(data:BackupData){const b=backupBook(data);checkAssetRegister(b);const dates=b.journals.map(j=>j.entry_date).sort();const to=dates.at(-1)??b.book.start_date;const r=accountingReports(b,b.book.start_date,to);if(r.balanceDifference||r.trialDifference)throw new Error('Backup ledger does not balance.');const journals=new Map(b.journals.map(j=>[j.id,j]));for(const line of b.lines)if(!journals.has(line.journal_id))throw new Error('Backup has an orphan ledger line.');return r;}
export function validateBankChecks(data:BookData){
 let opening=data.lines.filter(l=>l.account==='bank'&&data.journals.some(j=>j.id===l.journal_id&&j.kind==='opening')).reduce((n,l)=>n+l.debit-l.credit,0);const seen=new Set<string>();
 for(const r of [...data.reconciliations].sort((a,b)=>a.statement_date.localeCompare(b.statement_date))){if(r.opening_balance!==opening)throw new Error('Restored bank opening balance does not match.');for(const id of r.journal_ids){const j=data.journals.find(j=>j.id===id);if(seen.has(id)||!j||j.kind==='opening'||j.entry_date>r.statement_date||!data.lines.some(l=>l.journal_id===id&&l.account==='bank'))throw new Error('Restored bank matching is invalid.');seen.add(id);}const movement=data.lines.filter(l=>l.account==='bank'&&r.journal_ids.includes(l.journal_id)).reduce((n,l)=>n+l.debit-l.credit,0);if(opening+movement!==r.closing_balance)throw new Error('Restored bank check does not reconcile.');opening=r.closing_balance;}
}
