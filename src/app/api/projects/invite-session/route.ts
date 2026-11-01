import { cookies } from 'next/headers';
import { z } from 'zod';
import { checkOrigin,apiError,ApiError } from '@/lib/api';
import { projectBody,projectJSON } from '@/lib/projects/server';
export async function POST(request:Request){try{
 checkOrigin(request);const parsed=z.object({token:z.string().regex(/^[a-f0-9]{64}$/)}).strict().safeParse(await projectBody(request));if(!parsed.success)throw new ApiError(400,'This invitation link is invalid.');
 const store=await cookies();store.set('mbc_project_invite',parsed.data.token,{httpOnly:true,sameSite:'lax',secure:new URL(request.url).protocol==='https:',path:'/',maxAge:86400});return projectJSON({ready:true});
}catch(error){return apiError(error);}}
