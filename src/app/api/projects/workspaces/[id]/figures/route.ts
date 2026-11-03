import { authenticated,apiError,ApiError } from '@/lib/api';
import { workspaceAccess,projectJSON } from '@/lib/projects/server';
import { booksError } from '@/lib/bookkeeping/server';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){try{const {supabase,user}=await authenticated(),{id}=await params,access=await workspaceAccess(supabase,user.id,id);if(access.role!=='owner')throw new ApiError(403,'Bookkeeping figures are private to the owner.');const {data,error}=await supabase.rpc('bookkeeping_project_figures',{p_workspace:id});booksError(error);return projectJSON({figures:data});}catch(error){return apiError(error);}}
