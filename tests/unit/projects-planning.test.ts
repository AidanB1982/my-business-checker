import { describe,it,expect } from 'vitest';
import { taskWeekHours,weekRange,workload,projectSummary,dependencyOpen,tasksCSV } from '../../src/lib/projects/planning';
import { taskData,projectMutation,type Task,type Member } from '../../src/lib/projects/schema';
const id='00000000-0000-4000-8000-000000000001',projectId='00000000-0000-4000-8000-000000000002';
const base:Task={id,workspace_id:id,project_id:projectId,title:'Draft',description:'',status:'todo',priority:'medium',kind:'task',assignee_id:id,milestone_id:null,blocked_by:null,start_date:'2026-11-02',due_date:'2026-11-13',estimated_hours:40,acceptance_criteria:'',checklist:[],created_by:id,version:1,created_at:'2026-11-01T00:00:00Z',updated_at:'2026-11-01T00:00:00Z'};
const member:Member={workspace_id:id,user_id:id,display_name:'Alice',role:'owner',weekly_capacity:16};
describe('project effort and deadlines',()=>{
 it('uses Monday–Sunday weeks across year boundaries',()=>{expect(weekRange('2027-01-01')).toEqual({start:'2026-12-28',end:'2027-01-03'});expect(weekRange('2026-11-01')).toEqual({start:'2026-10-26',end:'2026-11-01'});});
 it('spreads effort over weekdays without double counting across two weeks',()=>{expect(taskWeekHours(base,'2026-11-02')).toBe(20);expect(taskWeekHours(base,'2026-11-09')).toBe(20);expect(taskWeekHours(base,'2026-11-16')).toBe(0);});
 it('places tasks without a start in their due-date week',()=>{expect(taskWeekHours({...base,start_date:null},'2026-11-02')).toBe(0);expect(taskWeekHours({...base,start_date:null},'2026-11-09')).toBe(40);});
 it('does not silently put undated or completed work into this week',()=>{expect(taskWeekHours({...base,due_date:null},'2026-11-02')).toBe(0);expect(taskWeekHours({...base,status:'done'},'2026-11-02')).toBe(0);});
 it('handles a weekend-only range explicitly in the due week',()=>expect(taskWeekHours({...base,start_date:'2026-11-07',due_date:'2026-11-08'},'2026-11-02')).toBe(40));
 it('keeps zero capacity finite and flags overload honestly',()=>{const rows=workload([base,{...base,id:projectId,due_date:null,estimated_hours:8}],[{...member,weekly_capacity:0}],'2026-11-02');expect(rows[0]).toMatchObject({hours:20,capacity:0,overloaded:true,unscheduledHours:8,openTasks:2});});
 it('counts overdue open work, deliverables and completed tasks separately',()=>{const summary=projectSummary([], [base,{...base,id:projectId,status:'done'},{...base,id:'other',kind:'deliverable',due_date:'2026-10-30'}],[],'2026-11-02');expect(summary).toMatchObject({open:2,done:1,overdue:1,deliverables:1});});
 it('does not invent a completed dependency',()=>{const b={...base,id:projectId,blocked_by:id};expect(dependencyOpen(b,[base,b])).toBe(true);expect(dependencyOpen(b,[{...base,status:'done'},b])).toBe(false);});
 it('exports user-provided spreadsheet strings without formula execution',()=>{const csv=tasksCSV([{...base,title:'=IMPORTXML("x")'}],[],[member]);expect(csv).toContain("'=IMPORTXML");expect(csv).toContain('Alice');});
});
describe('project mutation validation',()=>{
 it('does not accept forged owners or authors on task creation',()=>{const {id:_,workspace_id:__,created_by:___,version:____,created_at:_____,updated_at:______,...fields}=base;void _;void __;void ___;void ____;void _____;void ______;expect(taskData.safeParse({...fields,created_by:projectId}).success).toBe(false);});
 it('requires versions for updates and rejects cross-workspace fields',()=>{expect(projectMutation.safeParse({action:'task.update',id,data:{title:'Changed'}}).success).toBe(false);expect(projectMutation.safeParse({action:'workspace.update',name:'Hijack',description:'',owner_id:projectId}).success).toBe(false);});
 it('rejects invalid dates, excessive effort and duplicate checklist ids',()=>{const fields={project_id:projectId,title:'Task',description:'',status:'todo',priority:'medium',kind:'task',assignee_id:null,milestone_id:null,blocked_by:null,start_date:null,due_date:null,estimated_hours:0,acceptance_criteria:'',checklist:[]};expect(taskData.safeParse({...fields,due_date:'2026-02-30'}).success).toBe(false);expect(taskData.safeParse({...fields,estimated_hours:1001}).success).toBe(false);expect(taskData.safeParse({...fields,checklist:[{id,text:'A',done:true},{id,text:'B',done:false}]}).success).toBe(false);});
});
