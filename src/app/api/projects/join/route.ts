import { cookies } from 'next/headers';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { authenticated,checkOrigin,apiError,ApiError } from '@/lib/api';
import { projectBody,projectJSON,databaseFailure } from '@/lib/projects/server';
export async function POST(request:Request){try{
 checkOrigin(request);const {supabase}=await authenticated();const parsed=z.object({display_name:z.string().trim().min(1).max(80)}).strict().safeParse(await projectBody(request));if(!parsed.success)throw new ApiError(400,'Enter your display name.');
 const store=await cookies(),token=store.get('mbc_project_invite')?.value;if(!token||!/^[a-f0-9]{64}$/.test(token))throw new ApiError(400,'Open the invitation link before joining.');
 const {data,error}=await supabase.rpc('project_accept_invite',{p_token_hash:createHash('sha256').update(token).digest('hex'),p_display_name:parsed.data.display_name});databaseFailure(error);store.delete('mbc_project_invite');return projectJSON({workspaceId:data});
}catch(error){return apiError(error);}}
