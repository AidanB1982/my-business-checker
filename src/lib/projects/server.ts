import 'server-only';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ApiError,authenticated } from '@/lib/api';
type DB=Awaited<ReturnType<typeof authenticated>>['supabase'];
export const projectJSON=(value:unknown,status=200)=>NextResponse.json(value,{status,headers:{'Cache-Control':'private, no-store'}});
export async function projectBody(request:Request){const text=await request.text();if(new TextEncoder().encode(text).length>65536)throw new ApiError(413,'The project update is too large.');try{return JSON.parse(text);}catch{throw new ApiError(400,'Send a valid project update.');}}
export function databaseFailure(error:{code?:string;message?:string}|null){
 if(!error)return;
 if(['PGRST202','PGRST204','PGRST205','42P01','42883','42703'].includes(error.code??''))throw new ApiError(503,'Project workspace setup is not complete [PROJECTS_SETUP_REQUIRED].');
 const messages:Record<string,[number,string]>={
  PROJECTS_HIERARCHY:[400,'Choose a main project in this workspace. Only one level of subprojects is supported.'],PROJECTS_UNFINISHED:[409,'Finish the open tasks and subprojects first, or reopen the parent project.'],PROJECTS_SIGN_IN:[401,'Sign in to use your projects.'],PROJECTS_PAID_REQUIRED:[402,'The workspace owner needs an active Advanced plan for new work and invitations.'],PROJECTS_PERMISSION:[403,'Your workspace role does not allow this change.'],PROJECTS_INVITE_INVALID:[410,'This invitation has expired, was revoked or has already been used. Ask the owner for a new link.'],PROJECTS_INVITE_EMAIL:[403,'Sign in with the verified email address this invitation was created for.'],PROJECTS_LIMIT:[409,'This workspace has reached its limit. Export and remove work you no longer need, or use another workspace.'],PROJECTS_DEPENDENCY_CYCLE:[409,'That dependency would create a circular task chain.'],PROJECTS_DEPENDENCY_OPEN:[409,'Finish the dependency before completing this task.'],PROJECTS_CHECKLIST_OPEN:[409,'Complete the checklist before marking this task done.'],PROJECTS_INPUT:[400,'Check the project details.'],
 };
 const known=messages[error.message??''];if(known)throw new ApiError(known[0],known[1]);
 if(error.code==='42501')throw new ApiError(403,'Your role or the workspace subscription does not allow this change. Refresh the workspace.');
 if(['23503','23514','23505'].includes(error.code??''))throw new ApiError(409,'Check the dates, assignment, dependency and checklist. A referenced item may have changed; refresh before trying again.');
 throw new ApiError(503,'The project workspace could not be updated. Try again shortly.');
}
export async function workspaceAccess(db:DB,userId:string,id:string){
 if(!z.uuid().safeParse(id).success)throw new ApiError(400,'Invalid workspace.');
 const [{data:workspace,error},{data:member,error:memberError},{data:canWrite,error:writeError}]=await Promise.all([
  db.from('project_workspaces').select('id,owner_id,name,description,created_at').eq('id',id).maybeSingle(),
  db.from('project_members').select('role').eq('workspace_id',id).eq('user_id',userId).maybeSingle(),
  db.rpc('project_workspace_writable',{p_workspace:id}),
 ]);
 databaseFailure(error??memberError??writeError);if(!workspace||!member)throw new ApiError(404,'This workspace is not available to your account.');
 return {workspace,role:member.role as 'owner'|'editor'|'viewer',canWrite:canWrite===true};
}
