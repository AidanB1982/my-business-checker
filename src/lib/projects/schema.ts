import { z } from 'zod';
const name=z.string().trim().min(1).max(120);
const date=z.iso.date().refine(value=>value>='2000-01-01'&&value<='2100-12-31').nullable();
const hours=z.number().finite().min(0).max(1000).refine(value=>Math.abs(value*100-Math.round(value*100))<0.00001);
export const projectStatuses=['planned','active','on-hold','completed'] as const;
export const taskStatuses=['todo','in-progress','review','blocked','done'] as const;
export const priorities=['low','medium','high','urgent'] as const;
export const checklistItem=z.object({id:z.uuid(),text:z.string().trim().min(1).max(200),done:z.boolean()}).strict();
export const projectData=z.object({name,description:z.string().trim().max(3000),status:z.enum(projectStatuses),start_date:date,due_date:date,parent_id:z.uuid().nullable().default(null),budget_pence:z.number().int().min(0).max(100000000000).default(0),committed_pence:z.number().int().min(0).max(100000000000).default(0)}).strict();
export const taskData=z.object({project_id:z.uuid(),title:name,description:z.string().trim().max(4000),status:z.enum(taskStatuses),priority:z.enum(priorities),kind:z.enum(['task','deliverable']),assignee_id:z.uuid().nullable(),milestone_id:z.uuid().nullable(),blocked_by:z.uuid().nullable(),start_date:date,due_date:date,estimated_hours:hours,acceptance_criteria:z.string().trim().max(2000),checklist:z.array(checklistItem).max(30).refine(items=>new Set(items.map(item=>item.id)).size===items.length)}).strict();
const milestoneData=z.object({project_id:z.uuid(),title:name,due_date:date,completed:z.boolean()}).strict();
export const workspaceCreate=z.object({name,description:z.string().trim().max(1000),display_name:z.string().trim().min(1).max(80)}).strict();
const version=z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
export const projectMutation=z.discriminatedUnion('action',[
 z.object({action:z.literal('project.create'),data:projectData}).strict(),
 z.object({action:z.literal('project.update'),id:z.uuid(),version,data:projectData.omit({parent_id:true,budget_pence:true,committed_pence:true}).extend({parent_id:z.uuid().nullable().optional(),budget_pence:z.number().int().min(0).max(100000000000).optional(),committed_pence:z.number().int().min(0).max(100000000000).optional()})}).strict(),
 z.object({action:z.literal('task.create'),data:taskData}).strict(),
 z.object({action:z.literal('task.update'),id:z.uuid(),version,data:taskData.omit({project_id:true})}).strict(),
 z.object({action:z.literal('milestone.create'),data:milestoneData}).strict(),
 z.object({action:z.literal('milestone.update'),id:z.uuid(),version,data:milestoneData.omit({project_id:true})}).strict(),
 z.object({action:z.literal('entity.delete'),entity:z.enum(['project','task','milestone']),id:z.uuid(),version}).strict(),
 z.object({action:z.literal('workspace.update'),name,description:z.string().trim().max(1000)}).strict(),
 z.object({action:z.literal('workspace.delete')}).strict(),
 z.object({action:z.literal('member.settings'),user_id:z.uuid(),display_name:z.string().trim().min(1).max(80),weekly_capacity:z.number().finite().min(0).max(168)}).strict(),
 z.object({action:z.literal('member.leave')}).strict(),
 z.object({action:z.literal('member.role'),user_id:z.uuid(),role:z.enum(['editor','viewer','remove'])}).strict(),
 z.object({action:z.literal('invite.create'),email:z.email().max(254),role:z.enum(['editor','viewer'])}).strict(),
 z.object({action:z.literal('invite.revoke'),id:z.uuid()}).strict(),
]);
export type Project={id:string;workspace_id:string;name:string;description:string;status:typeof projectStatuses[number];start_date:string|null;due_date:string|null;version:number;created_at:string;updated_at:string;parent_id?:string|null;budget_pence?:number;committed_pence?:number};
export type Task={id:string;workspace_id:string;created_by:string;version:number;created_at:string;updated_at:string}&z.infer<typeof taskData>;
export type Milestone={id:string;workspace_id:string;version:number;created_at:string}&z.infer<typeof milestoneData>;
export type Member={workspace_id:string;user_id:string;display_name:string;role:'owner'|'editor'|'viewer';weekly_capacity:number};
export type Workspace={id:string;owner_id:string;name:string;description:string;created_at:string};
export type Activity={id:string;workspace_id:string;project_id:string|null;task_id:string|null;actor_name:string;action:string;summary:string;created_at:string};
export type Comment={id:string;task_id:string;workspace_id:string;author_id:string|null;body:string;created_at:string};
export type Invitation={id:string;email:string;role:'editor'|'viewer';expires_at:string;accepted_at:string|null;revoked_at:string|null};
export type WorkspaceData={workspace:Workspace;members:Member[];projects:Project[];tasks:Task[];milestones:Milestone[];activity:Activity[];invitations:Invitation[];canWrite:boolean;role:Member['role']};
