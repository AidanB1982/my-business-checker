import Link from 'next/link';
import { z } from 'zod';
import { notFound,redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/config';
import { lineTotal,type InvoiceRecord } from '@/lib/bookkeeping/invoices';
import { InvoicePrintButton } from '@/components/invoice-print-button';
export const dynamic='force-dynamic';export const metadata={title:'Invoice',robots:{index:false,follow:false}};
const money=(n:number)=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(n/100);
const text=(data:Record<string,unknown>|null,key:string)=>typeof data?.[key]==='string'?String(data[key]):'';
export default async function PrintInvoice({params,searchParams}:{params:Promise<{invoiceId:string}>;searchParams:Promise<{book?:string}>}){
 const {invoiceId}=await params;const {book}=await searchParams;if(!z.uuid().safeParse(invoiceId).success||!z.uuid().safeParse(book).success)notFound();
 if(!isSupabaseConfigured())redirect('/sign-in?next=%2Fbookkeeping');const db=await createClient();const {data:{user}}=await db.auth.getUser();if(!user)redirect('/sign-in?next=%2Fbookkeeping');
 const {data,error}=await db.rpc('bookkeeping_invoice_detail',{p_book:book,p_invoice:invoiceId});if(error||!data)notFound();
 const d=data.invoice as InvoiceRecord;if(d.status!=='posted')notFound();const customer=d.kind==='customer';
 return <article className="wrap section invoice-print"><div className="invoice-print-toolbar no-print"><Link href="/bookkeeping" className="text-link">← Your books</Link><InvoicePrintButton/></div>
 <div className="invoice-paper"><header className="invoice-paper-head"><div><p className="eyebrow">{customer?'Invoice':'Supplier invoice record — internal copy'}</p><h1>{d.number}</h1>{data.reversed&&<strong className="invoice-cancelled">REVERSED — not payable</strong>}</div><div><p><strong>Invoice date:</strong> {d.invoice_date}</p><p><strong>Supply date:</strong> {d.supply_date}</p><p><strong>Payment due:</strong> {d.due_date}</p></div></header>
 <div className="invoice-parties"><section><h2>{customer?'From':'Supplier'}</h2><strong>{text(d.issuer,'legal_name')}</strong>{text(d.issuer,'trading_name')&&<p>Trading as {text(d.issuer,'trading_name')}</p>}<p className="invoice-address">{text(d.issuer,'address')}</p>{text(d.issuer,'email')&&<p>{text(d.issuer,'email')}</p>}{text(d.issuer,'phone')&&<p>{text(d.issuer,'phone')}</p>}</section><section><h2>{customer?'Bill to':'Recorded by'}</h2><strong>{text(d.recipient,'name')||text(d.recipient,'legal_name')}</strong><p className="invoice-address">{text(d.recipient,'address')}</p>{text(d.recipient,'email')&&<p>{text(d.recipient,'email')}</p>}</section></div>
 <div className="table-scroll"><table><thead><tr><th>Description</th><th>Quantity</th><th>{customer?'Unit price':'Gross unit price'}</th><th>Amount</th></tr></thead><tbody>{d.lines.map((line,i)=><tr key={i}><th>{line.description}</th><td>{line.quantity_milli/1000}</td><td>{money(line.unit_pence)}</td><td>{money(lineTotal(line))}</td></tr>)}</tbody></table></div>
 <div className="invoice-totals"><p><span>Total GBP</span><strong>{money(d.total)}</strong></p><p><span>Current amount outstanding</span><strong>{money(data.balance)}</strong></p></div>
 <p>{customer?'VAT not charged — issuer is not VAT registered.':'Gross amounts as entered. VAT breakdown is not captured. This internal bookkeeping record does not replace the supplier’s original invoice.'}</p>
 {customer&&text(d.issuer,'payment_details')&&<section><h2>How to pay</h2><p className="invoice-address">{text(d.issuer,'payment_details')}</p><p>Please quote {d.number} when paying.</p></section>}
 {d.notes&&<section><h2>Notes</h2><p className="invoice-address">{d.notes}</p></section>}
 <p className="fine">{data.reversed?'This invoice was reversed in the ledger.':data.balance===0?'The recorded balance is paid.':'Outstanding balance reflects payments recorded in these books.'} Invoice details are preserved from the time of issue/recording.</p></div></article>;
}
