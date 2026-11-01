import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authenticated,checkOrigin,apiError,ApiError } from '@/lib/api';
export async function DELETE(request:Request,{params}:{params:Promise<{id:string}>}){try{
 checkOrigin(request);const {supabase,user}=await authenticated();const {id}=await params;if(!z.uuid().safeParse(id).success)throw new ApiError(400,'Invalid calculation.');
 const {data,error}=await supabase.from('saved_calculations').delete().eq('id',id).eq('user_id',user.id).select('id');
 if(error)throw new ApiError(503,'Deletion failed. Please try again.');if(!data?.length)throw new ApiError(404,'Calculation not found.');
 return new NextResponse(null,{status:204,headers:{'Cache-Control':'private, no-store'}});
 }catch(error){return apiError(error);}}
