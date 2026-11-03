import { z } from 'zod';
import type { BookData,Journal,Line } from './engine';
export const contactSchema=z.object({name:z.string().trim().min(1).max(160),kind:z.enum(['customer','supplier']),reference:z.string().trim().max(40).default(''),email:z.union([z.literal(''),z.email()]).default(''),phone:z.string().trim().max(60).default(''),address:z.string().trim().max(500).default(''),notes:z.string().trim().max(1000).default('')}).strict();
export type Contact=z.infer<typeof contactSchema>&{id:string;book_id:string;version:number;archived:boolean};
export type ContactLink={journal_id:string;contact_id:string};
export type ContactOpening={contact_id:string;amount:number};
export type ContactData=BookData&{contacts?:Contact[];contact_links?:ContactLink[];contact_openings?:ContactOpening[]};
export function contactIndex(data:ContactData){
 const lines=new Map<string,Line[]>();for(const line of data.lines){const rows=lines.get(line.journal_id)??[];rows.push(line);lines.set(line.journal_id,rows);}
 return {links:new Map((data.contact_links??[]).map(link=>[link.journal_id,link.contact_id])),journals:new Map(data.journals.map(j=>[j.id,j])),lines};
}
export function journalContact(journal:Journal,data:ContactData,index?:ReturnType<typeof contactIndex>):string|null{
 const source=journal.document_id??journal.reversal_of??journal.id;
 return index?index.links.get(source)??null:data.contact_links?.find(link=>link.journal_id===source)?.contact_id??null;
}
export function contactStatement(data:ContactData,contact:Contact,to:string,index=contactIndex(data)){
 const opening=to>=data.book.start_date?(data.contact_openings?.find(row=>row.contact_id===contact.id)?.amount??0):0;
 let balance=opening;
 const rows=data.journals.filter(j=>j.entry_date<=to&&journalContact(j,data,index)===contact.id).sort((a,b)=>a.entry_date.localeCompare(b.entry_date)||a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id)).map(j=>{
  const control=contact.kind==='customer'?'receivable':'payable';
  const delta=(index.lines.get(j.id)??[]).filter(l=>l.account===control).reduce((sum,line)=>sum+(contact.kind==='customer'?line.debit-line.credit:line.credit-line.debit),0);
  let added=Math.max(0,delta),reduced=Math.max(0,-delta);
  // A paid-at-once sale/purchase has no outstanding control-account movement.
  // Show both activity columns, rather than creating an artificial debt.
  const source=j.reversal_of?index.journals.get(j.reversal_of):j;
  if(!delta&&source&&['income','expense','equipment','property'].includes(source.kind)){
   const paid=Math.abs((index.lines.get(j.id)??[]).filter(l=>['bank','cash'].includes(l.account)).reduce((n,l)=>n+l.debit-l.credit,0));added=reduced=j.reversal_of?-paid:paid;
  }
  balance+=delta;return {journal:j,added,reduced,delta,balance};
 });
 return {opening,rows,balance};
}
export function contactControlCheck(data:ContactData,kind:Contact['kind'],to:string){
 const ids=new Set(data.journals.filter(j=>j.entry_date<=to).map(j=>j.id));const control=kind==='customer'?'receivable':'payable';
 const total=data.lines.filter(l=>ids.has(l.journal_id)&&l.account===control).reduce((n,l)=>n+(kind==='customer'?l.debit-l.credit:l.credit-l.debit),0);
 const index=contactIndex(data);const assigned=(data.contacts??[]).filter(c=>c.kind===kind).reduce((n,c)=>n+contactStatement(data,c,to,index).balance,0);
 return {total,assigned,unassigned:total-assigned};
}
export function statementCSV(data:ContactData,contact:Contact,to:string){
 const s=contactStatement(data,contact,to);const cell=(value:unknown)=>{const text=String(value??'');return '"'+(/^[\s]*[=+\-@]/.test(text)?"'":'')+text.replaceAll('"','""')+'"';};
 const rows=[['Account',contact.name,'Book',data.book.name,'Through',to],['Date','Description','Reference','Added GBP','Reduced GBP','Running balance GBP'],[data.book.start_date,'Allocated opening balance','',(s.opening/100).toFixed(2),'0.00',(s.opening/100).toFixed(2)],...s.rows.map(r=>[r.journal.entry_date,r.journal.description,r.journal.reference,(r.added/100).toFixed(2),(r.reduced/100).toFixed(2),(r.balance/100).toFixed(2)])];
 return '\ufeff'+rows.map(row=>row.map(cell).join(',')).join('\r\n');
}
