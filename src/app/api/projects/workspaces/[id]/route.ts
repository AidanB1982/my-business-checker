import { randomBytes,createHash } from 'node:crypto';
import { authenticated,checkOrigin,apiError,ApiError } from '@/lib/api';
import { projectMutation } from '@/lib/projects/schema';
import { projectJSON,projectBody,databaseFailure,workspaceAccess } from '@/lib/projects/server';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){try{
 const {supabase,user}=await authenticated();const {id}=await params;const access=await workspaceAccess(supabase,user.id,id);
 const results=await Promise.all([
  supabase.from('project_members').select('workspace_id,user_id,role,display_name,weekly_capacity').eq('workspace_id',id).order('joined_at'),
  supabase.from('project_projects').select('*').eq('workspace_id',id).order('created_at').limit(25),
  supabase.from('project_tasks').select('*').eq('workspace_id',id).order('created_at').range(0,999),
  supabase.from('project_milestones').select('*').eq('workspace_id',id).order('due_date',{ascending:true,nullsFirst:false}).limit(250),
  supabase.from('project_activity').select('id,workspace_id,project_id,task_id,actor_name,action,summary,created_at').eq('workspace_id',id).order('created_at',{ascending:false}).order('id').limit(50),
  access.role==='owner'?supabase.from('project_invites').select('id,email,role,expires_at,accepted_at,revoked_at').eq('workspace_id',id).is('accepted_at',null).is('revoked_at',null).gt('expires_at',new Date().toISOString()).order('created_at',{ascending:false}).limit(50):Promise.resolve({data:[],error:null}),
 ]);for(const result of results)databaseFailure(result.error);
 return projectJSON({...access,members:results[0].data??[],projects:results[1].data??[],tasks:results[2].data??[],milestones:results[3].data??[],activity:results[4].data??[],invitations:results[5].data??[]});
}catch(error){return apiError(error);}}
export async function POST(request:Request,{params}:{params:Promise<{id:string}>}){try{
 checkOrigin(request);const {supabase,user}=await authenticated();const {id}=await params;const access=await workspaceAccess(supabase,user.id,id);
 const parsed=projectMutation.safeParse(await projectBody(request));if(!parsed.success)throw new ApiError(400,'Check the project fields, dates, estimates and checklist.');const input=parsed.data;
 const securityActions=['member.settings','member.leave','member.role','invite.revoke','workspace.delete'];
 if(!securityActions.includes(input.action)&&!access.canWrite)throw new ApiError(access.role==='viewer'?403:402,access.role==='viewer'?'This workspace is read-only for viewers.':'The workspace owner needs an active Advanced plan for new changes.');
 if(['workspace.update','workspace.delete','member.role','invite.create','invite.revoke'].includes(input.action)&&access.role!=='owner')throw new ApiError(403,'Only the workspace owner can do that.');
 if(input.action==='invite.create'){
  const token=randomBytes(32).toString('hex'),hash=createHash('sha256').update(token).digest('hex');
  const {error}=await supabase.rpc('project_create_invite',{p_workspace:id,p_email:input.email,p_role:input.role,p_token_hash:hash});databaseFailure(error);return projectJSON({inviteToken:token,expiresInDays:7},201);
 }
 if(input.action==='invite.revoke'){const {error}=await supabase.rpc('project_revoke_invite',{p_workspace:id,p_invite:input.id});databaseFailure(error);return projectJSON({ok:true});}
 if(input.action==='member.leave'){const {error}=await supabase.rpc('project_leave_workspace',{p_workspace:id});databaseFailure(error);return projectJSON({left:true});}
 if(input.action==='member.role'){const {error}=await supabase.rpc('project_member_role',{p_workspace:id,p_user:input.user_id,p_role:input.role});databaseFailure(error);return projectJSON({ok:true});}
 if(input.action==='member.settings'){const {error}=await supabase.rpc('project_member_settings',{p_workspace:id,p_user:input.user_id,p_name:input.display_name,p_capacity:input.weekly_capacity});databaseFailure(error);return projectJSON({ok:true});}
 if(input.action==='workspace.update'){const {error}=await supabase.from('project_workspaces').update({name:input.name,description:input.description}).eq('id',id);databaseFailure(error);return projectJSON({ok:true});}
 if(input.action==='workspace.delete'){const {error}=await supabase.from('project_workspaces').delete().eq('id',id);databaseFailure(error);return projectJSON({deleted:true});}
 const table=input.action.startsWith('project.')?'project_projects':input.action.startsWith('task.')?'project_tasks':'project_milestones';
 if(input.action==='entity.delete'){
  const tables={project:'project_projects',task:'project_tasks',milestone:'project_milestones'} as const;
  const {data,error}=await supabase.from(tables[input.entity]).delete().eq('workspace_id',id).eq('id',input.id).eq('version',input.version).select('id');databaseFailure(error);if(!data?.length)throw new ApiError(409,'This item changed or was removed. Refresh before trying again.');return projectJSON({ok:true});
 }
 if(input.action==='project.create'||input.action==='task.create'||input.action==='milestone.create'){
  const row:Record<string,unknown>={...input.data,workspace_id:id,...(input.action==='task.create'?{created_by:user.id}:{})};const {data,error}=await supabase.from(table).insert(row).select('id').single();databaseFailure(error);return projectJSON({id:data?.id},201);
 }
 const {data,error}=await supabase.from(table).update(input.data).eq('workspace_id',id).eq('id',input.id).eq('version',input.version).select('id');databaseFailure(error);if(!data?.length)throw new ApiError(409,'Someone changed this item while you were editing it. Your change was not saved. Refresh to review the latest version.');return projectJSON({ok:true});
}catch(error){return apiError(error);}}
