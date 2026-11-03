import { z } from 'zod';
import { authenticated,apiError,ApiError } from '@/lib/api';
import { booksJSON,booksError } from '@/lib/bookkeeping/server';
export async function GET(_request:Request,{params}:{params:Promise<{id:string;invoiceId:string}>}){try{
 const {supabase}=await authenticated();const {id,invoiceId}=await params;
 if(!z.uuid().safeParse(id).success||!z.uuid().safeParse(invoiceId).success)throw new ApiError(400,'Invalid invoice.');
 const {data,error}=await supabase.rpc('bookkeeping_invoice_detail',{p_book:id,p_invoice:invoiceId});booksError(error);return booksJSON(data);
}catch(error){return apiError(error);}}
