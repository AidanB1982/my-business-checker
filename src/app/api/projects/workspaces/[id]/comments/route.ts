import { z } from 'zod';
import { authenticated,checkOrigin,apiError,ApiError } from '@/lib/api';
import { projectJSON,projectBody,databaseFailure,workspaceAccess } from '@/lib/projects/server';
export async function GET(request:Request,{params}:{params:Promise<{id:string}>}){try{
 const {supabase,user}=await authenticated();const {id}=await params;await workspaceAccess(supabase,user.id,id);const url=new URL(request.url),task=url.searchParams.get('task'),page=Number(url.searchParams.get('page')??0);
 if(!z.uuid().safeParse(task).success||!Number.isInteger(page)||page<0||page>10000)throw new ApiError(400,'Invalid task or comment page.');
 const {data,error,count}=await supabase.from('project_comments').select('id,workspace_id,task_id,author_id,body,created_at',{count:'exact'}).eq('workspace_id',id).eq('task_id',task!).order('created_at',{ascending:false}).order('id').range(page*50,page*50+49);databaseFailure(error);return projectJSON({comments:data??[],hasMore:(page+1)*50<(count??0)});
}catch(error){return apiError(error);}}
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){try{
 checkOrigin(request);const {supabase,user}=await authenticated();const {id}=await params;const access=await workspaceAccess(supabase,user.id,id);if(!access.canWrite)throw new ApiError(403,'Your role or the workspace plan does not allow new comments.');
 const parsed=z.object({task_id:z.uuid(),body:z.string().trim().min(1).max(4000)}).strict().safeParse(await projectBody(request));if(!parsed.success)throw new ApiError(400,'Write a comment of up to 4,000 characters.');
 const {error}=await supabase.from('project_comments').insert({...parsed.data,workspace_id:id,author_id:user.id});databaseFailure(error);return projectJSON({ok:true},201);
}catch(error){return apiError(error);}}
export async function DELETE(request:Request,{params}:{params:Promise<{id:string}>}){try{
 checkOrigin(request);const {supabase,user}=await authenticated();const {id}=await params;await workspaceAccess(supabase,user.id,id);const comment=new URL(request.url).searchParams.get('comment');if(!z.uuid().safeParse(comment).success)throw new ApiError(400,'Invalid comment.');
 const {data,error}=await supabase.from('project_comments').delete().eq('workspace_id',id).eq('id',comment!).select('id');databaseFailure(error);if(!data?.length)throw new ApiError(404,'That comment is not available to delete.');return projectJSON({ok:true});
}catch(error){return apiError(error);}}
