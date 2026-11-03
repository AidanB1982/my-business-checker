import { z } from 'zod';
import { authenticated,checkOrigin,ApiError,apiError } from '@/lib/api';
import { assetAction } from '@/lib/bookkeeping/assets';
import { booksError,booksBody,booksJSON } from '@/lib/bookkeeping/server';
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){try{
 checkOrigin(request);const {supabase}=await authenticated(),{id}=await params;
 if(!z.uuid().safeParse(id).success)throw new ApiError(400,'Invalid book.');
 const parsed=assetAction.safeParse(await booksBody(request));if(!parsed.success)throw new ApiError(400,'Check the project, dates, amounts and depreciation policy.');
 const {action,...input}=parsed.data;const {data,error}=await supabase.rpc('bookkeeping_asset_action',{p_book:id,p_action:action,p_data:input});booksError(error);return booksJSON({ok:true,id:data});
}catch(error){return apiError(error);}}
