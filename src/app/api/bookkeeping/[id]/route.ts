import { z } from 'zod';
import { authenticated,checkOrigin,apiError,ApiError } from '@/lib/api';
import { entrySchema,openingSchema,guidedPosting,openingPosting,type BookData } from '@/lib/bookkeeping/engine';
import { contactSchema } from '@/lib/bookkeeping/contacts';
import { booksJSON,booksError,booksBody } from '@/lib/bookkeeping/server';
type Context={params:Promise<{id:string}>};
const date=z.string().regex(/^20\d{2}-\d{2}-\d{2}$/);
const actions=z.discriminatedUnion('action',[
 z.object({action:z.literal('contact.save'),id:z.uuid(),data:contactSchema,version:z.number().int().min(1).optional(),archived:z.boolean().default(false)}).strict(),
 z.object({action:z.literal('contact.opening'),contact_id:z.uuid(),amount:z.number().int().min(0).max(100000000000)}).strict(),
 z.object({action:z.literal('contact.link'),journal_id:z.uuid(),contact_id:z.uuid().nullable()}).strict(),
 z.object({action:z.literal('entry'),data:entrySchema}).strict(),z.object({action:z.literal('opening'),data:openingSchema}).strict(),
 z.object({action:z.literal('reverse'),journal_id:z.uuid(),request_id:z.uuid(),date,reason:z.string().trim().min(1).max(160)}).strict(),
 z.object({action:z.literal('lock'),date}).strict(),z.object({action:z.literal('reconcile'),date,opening:z.number().int().min(-100000000000).max(100000000000),closing:z.number().int().min(-100000000000).max(100000000000),journal_ids:z.array(z.uuid()).max(5000).refine(ids=>new Set(ids).size===ids.length)}).strict(),
]);
export async function GET(_request:Request,{params}:Context){try{const {supabase}=await authenticated();const {id}=await params;if(!z.uuid().safeParse(id).success)throw new ApiError(400,'Invalid book.');const {data,error}=await supabase.rpc('bookkeeping_read',{p_book:id});booksError(error);return booksJSON(data);}catch(error){return apiError(error);}}
export async function POST(request:Request,{params}:Context){try{
 checkOrigin(request);const {supabase}=await authenticated();const {id}=await params;if(!z.uuid().safeParse(id).success)throw new ApiError(400,'Invalid book.');
 const parsed=actions.safeParse(await booksBody(request));if(!parsed.success)throw new ApiError(400,'Check the dates, amounts and required fields. Amounts must be whole pence.');const input=parsed.data;
 const {data:raw,error:readError}=await supabase.rpc('bookkeeping_read',{p_book:id});booksError(readError);const book=raw as BookData;if(!book.canWrite)throw new ApiError(402,'An active Advanced membership is required to record changes.');
 let result;
 if(input.action==='contact.save')result=await supabase.rpc('bookkeeping_save_contact',{p_book:id,p_contact:input.id,p_data:input.data,p_version:input.version??null,p_archived:input.archived});
 else if(input.action==='contact.opening')result=await supabase.rpc('bookkeeping_contact_opening',{p_book:id,p_contact:input.contact_id,p_amount:input.amount});
 else if(input.action==='contact.link')result=await supabase.rpc('bookkeeping_link_contact',{p_book:id,p_journal:input.journal_id,p_contact:input.contact_id});
 else if(input.action==='entry'){
  let lines;try{lines=guidedPosting(input.data,book.book,book.journals.find(j=>j.id===input.data.document_id));}catch(error){throw new ApiError(400,error instanceof Error?error.message:'Check the entry.');}
  result=await supabase.rpc('bookkeeping_post',{p_book:id,p_request:input.data.request_id,p_date:input.data.date,p_description:input.data.description,p_kind:input.data.kind,p_lines:lines,p_document:input.data.document_id,p_counterparty:input.data.counterparty,p_reference:input.data.reference,p_contact:input.data.contact_id});
 }else if(input.action==='opening'){
  const lines=openingPosting(input.data.balances);result=lines.length?await supabase.rpc('bookkeeping_post',{p_book:id,p_request:input.data.request_id,p_date:book.book.start_date,p_description:'Opening balances',p_kind:'opening',p_lines:lines}):await supabase.rpc('bookkeeping_zero_opening',{p_book:id});
 }else if(input.action==='reverse')result=await supabase.rpc('bookkeeping_reverse',{p_book:id,p_journal:input.journal_id,p_request:input.request_id,p_date:input.date,p_reason:input.reason});
 else if(input.action==='lock')result=await supabase.rpc('bookkeeping_lock',{p_book:id,p_date:input.date});
 else result=await supabase.rpc('bookkeeping_reconcile',{p_book:id,p_date:input.date,p_opening:input.opening,p_closing:input.closing,p_journals:input.journal_ids});
 booksError(result.error);return booksJSON({ok:true,id:result.data});
}catch(error){return apiError(error);}}
