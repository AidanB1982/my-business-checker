import { authenticated,checkOrigin,apiError,ApiError } from '@/lib/api';
import { hasAdvanced } from '@/lib/entitlements';
import { workspaceCreate } from '@/lib/projects/schema';
import { projectJSON,projectBody,databaseFailure } from '@/lib/projects/server';
export async function GET(){try{
 const {supabase,user}=await authenticated();const [{data:memberships,error},{data:plan,error:planError}]=await Promise.all([
  supabase.from('project_members').select('workspace_id,role,display_name,weekly_capacity,workspace:project_workspaces(id,name,description,owner_id,created_at)').eq('user_id',user.id).order('joined_at',{ascending:true}),
  supabase.from('subscriptions').select('status,current_period_end').eq('user_id',user.id).maybeSingle(),
 ]);databaseFailure(error);return projectJSON({memberships:memberships??[],canCreate:!planError&&hasAdvanced(plan),planError:Boolean(planError),user:{id:user.id,displayName:user.email?.split('@')[0]??'You'}});
}catch(error){return apiError(error);}}
export async function POST(request:Request){try{
 checkOrigin(request);const {supabase}=await authenticated();const parsed=workspaceCreate.safeParse(await projectBody(request));if(!parsed.success)throw new ApiError(400,'Enter a workspace name, a short description and your display name.');
 const {data,error}=await supabase.rpc('project_create_workspace',{p_name:parsed.data.name,p_description:parsed.data.description,p_display_name:parsed.data.display_name});databaseFailure(error);return projectJSON({id:data},201);
}catch(error){return apiError(error);}}
