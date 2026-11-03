import { z } from 'zod';
import { authenticated,apiError,ApiError } from '@/lib/api';
import { booksError } from '@/lib/bookkeeping/server';
import { validateBackupData,backupFinancialCheck } from '@/lib/bookkeeping/backup-format';
import { handoverZip,compressedBackup } from '@/lib/bookkeeping/handover';
import { invoiceDay } from '@/lib/bookkeeping/invoices';
export const runtime='nodejs';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){try{
 const {supabase}=await authenticated(),{id}=await params;
 if(!z.uuid().safeParse(id).success)throw new ApiError(400,'Invalid book.');
 const q=new URL(request.url).searchParams,mode=q.get('mode');
 if(!['pack','backup'].includes(mode??''))throw new ApiError(400,'Choose an accountant pack or portable backup.');
 const {data,error}=await supabase.rpc('bookkeeping_backup',{p_book:id});booksError(error);
 const raw=validateBackupData(data);backupFinancialCheck(raw);
 const from=q.get('from')??String(raw.tables.bookkeeping_books[0].start_date),to=q.get('to')??new Date().toISOString().slice(0,10);
 if(mode==='pack'&&(!invoiceDay.safeParse(from).success||!invoiceDay.safeParse(to).success||from>to||from<String(raw.tables.bookkeeping_books[0].start_date)||to>new Date().toISOString().slice(0,10)))throw new ApiError(400,'Choose valid report dates within this book and through today.');
 const bytes=mode==='pack'?handoverZip(raw,from,to):compressedBackup(raw);
 if(bytes.length>4*1024*1024)throw new ApiError(413,'This export exceeds the download limit. Contact support for a complete export; no records have been omitted.');
 return new Response(Buffer.from(bytes),{headers:{'Content-Type':mode==='pack'?'application/zip':'application/gzip','Content-Disposition':`attachment; filename="bookkeeping-${id}-${mode==='pack'?from+'-'+to+'.zip':'backup.json.gz'}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
}catch(error){return apiError(error);}}
