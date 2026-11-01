import { z } from 'zod';
import { authenticated,apiError,ApiError } from '@/lib/api';
import { snapshotSchema } from '@/lib/reports/calculations';
import { csvReport,htmlReport } from '@/lib/reports/export';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){try{
 const {supabase,user}=await authenticated();const {id}=await params;if(!z.uuid().safeParse(id).success)throw new ApiError(400,'Invalid calculation.');
 const {data,error}=await supabase.from('saved_calculations').select('title,result,inputs').eq('id',id).eq('user_id',user.id).maybeSingle();
 if(error)throw new ApiError(503,'Report could not be loaded.');if(!data)throw new ApiError(404,'Calculation not found.');
 const parsed=snapshotSchema.safeParse(data.result);if(!parsed.success)throw new ApiError(409,'This saved calculation does not have a supported report format.');
 const csv=new URL(request.url).searchParams.get('format')==='csv';const body=csv?csvReport(data.title,parsed.data,data.inputs):htmlReport(data.title,parsed.data,data.inputs);
 return new Response(body,{headers:{'Content-Type':csv?'text/csv; charset=utf-8':'text/html; charset=utf-8','Content-Disposition':`attachment; filename="my-business-checker-${id}.${csv?'csv':'html'}"`,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; style-src 'unsafe-inline'; sandbox"}});
 }catch(error){return apiError(error);}}
