import { z } from 'zod';
import { expenseCodes,documentOutstanding,type Journal } from './engine';
import type { ContactData } from './contacts';
export const invoiceDay=z.string().regex(/^20\d{2}-\d{2}-\d{2}$/).refine(s=>{const d=new Date(s+'T00:00:00Z');return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===s;});
export const invoiceLine=z.object({description:z.string().trim().min(1).max(240),quantity_milli:z.number().int().min(1).max(1000000000),unit_pence:z.number().int().min(0).max(100000000000),category:z.enum(expenseCodes).default('general')}).strict();
export const invoiceDraftSchema=z.object({kind:z.enum(['customer','supplier']),contact_id:z.uuid(),invoice_date:invoiceDay,supply_date:invoiceDay,due_date:invoiceDay,supplier_number:z.string().trim().max(80).default(''),notes:z.string().trim().max(2000).default(''),lines:z.array(invoiceLine).min(1).max(50)}).strict().refine(d=>d.due_date>=d.invoice_date&&d.supply_date<=d.invoice_date,'Check the supply, invoice and due dates.').refine(d=>d.kind!=='supplier'||d.supplier_number.length>0,'Enter the supplier’s invoice number.');
export const invoiceProfileSchema=z.object({legal_name:z.string().trim().min(1).max(160),trading_name:z.string().trim().max(160).default(''),address:z.string().trim().min(1).max(500),email:z.union([z.literal(''),z.email()]).default(''),phone:z.string().trim().max(60).default(''),payment_details:z.string().trim().max(500).default(''),not_vat_registered:z.literal(true)}).strict();
export type InvoiceDraft=z.infer<typeof invoiceDraftSchema>;
export type InvoiceLine=z.infer<typeof invoiceLine>;
export type InvoiceProfile=z.infer<typeof invoiceProfileSchema>&{version:number};
export type InvoiceHeader={id:string;book_id:string;kind:'customer'|'supplier';contact_id:string;status:'draft'|'posted';number:string;invoice_date:string;supply_date:string;due_date:string;total:number;journal_id:string|null;version:number};
export type InvoiceRecord=InvoiceHeader&{lines:InvoiceLine[];notes:string;issuer:Record<string,unknown>|null;recipient:Record<string,unknown>|null};
export type InvoiceData=ContactData&{invoices?:InvoiceHeader[];invoice_profile?:InvoiceProfile|null};
export function lineTotal(line:InvoiceLine){const product=line.quantity_milli*line.unit_pence;if(!Number.isSafeInteger(product))throw new Error('That line amount is too large.');const amount=Math.round(product/1000);if(amount>100000000000)throw new Error('That line amount is too large.');return amount;}
export function invoiceTotal(lines:InvoiceLine[]){const total=lines.reduce((n,line)=>n+lineTotal(line),0);if(!Number.isSafeInteger(total)||total<=0||total>100000000000)throw new Error('The invoice total must be positive and no more than £1 billion.');return total;}
export function invoicePosition(journal:Journal,data:ContactData,due:string|null,day:string){
 const reversed=data.journals.some(j=>j.reversal_of===journal.id&&j.entry_date<=day);
 const balance=documentOutstanding(journal,data.journals.filter(j=>j.entry_date<=day),data.lines);
 const original=data.lines.filter(l=>l.journal_id===journal.id&&l.account===(journal.kind==='invoice'?'receivable':'payable')).reduce((n,l)=>n+(journal.kind==='invoice'?l.debit-l.credit:l.credit-l.debit),0);
 return {balance,total:original,status:reversed?'Reversed':balance===0?'Paid':due&&due<day?'Overdue':balance<original?'Part paid':'Unpaid'};
}
