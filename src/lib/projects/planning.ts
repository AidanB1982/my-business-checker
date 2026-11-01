import type { Task,Member,Project,Milestone } from './schema';
export const utcToday=(now=new Date())=>now.toISOString().slice(0,10);
const day=(value:string)=>Math.floor(Date.parse(`${value}T00:00:00Z`)/86400000);
const date=(value:number)=>new Date(value*86400000).toISOString().slice(0,10);
export function weekRange(value:string){const d=day(value),weekday=new Date(d*86400000).getUTCDay(),start=d-((weekday+6)%7);return {start:date(start),end:date(start+6)};}
function weekdays(start:number,end:number){if(end<start)return 0;const days=end-start+1,weeks=Math.floor(days/7);let count=weeks*5;for(let offset=weeks*7;offset<days;offset++){const w=new Date((start+offset)*86400000).getUTCDay();if(w!==0&&w!==6)count++;}return count;}
export function taskWeekHours(task:Task,weekStart:string){
 if(task.status==='done'||!task.due_date)return 0;
 const week=weekRange(weekStart),from=day(week.start),to=day(week.end),due=day(task.due_date),start=task.start_date?day(task.start_date):due;
 if(!task.start_date)return due>=from&&due<=to?Number(task.estimated_hours):0;
 const total=weekdays(start,due);
 if(!total)return due>=from&&due<=to?Number(task.estimated_hours):0;
 const overlap=weekdays(Math.max(start,from),Math.min(due,to));return Math.round(Number(task.estimated_hours)*overlap/total*100)/100;
}
export function workload(tasks:Task[],members:Member[],weekStart:string){return members.map(member=>{const open=tasks.filter(task=>task.assignee_id===member.user_id&&task.status!=='done');const hours=Math.round(open.reduce((sum,task)=>sum+taskWeekHours(task,weekStart),0)*100)/100;return {member,hours,capacity:Number(member.weekly_capacity),overloaded:hours>Number(member.weekly_capacity),openTasks:open.length,unscheduledHours:Math.round(open.filter(task=>!task.due_date).reduce((sum,task)=>sum+Number(task.estimated_hours),0)*100)/100};});}
export function projectSummary(projects:Project[],tasks:Task[],milestones:Milestone[],today=utcToday()){
 const done=tasks.filter(task=>task.status==='done').length;return {projects:projects.length,active:projects.filter(project=>project.status==='active').length,tasks:tasks.length,done,open:tasks.length-done,overdue:tasks.filter(task=>task.status!=='done'&&task.due_date&&task.due_date<today).length,deliverables:tasks.filter(task=>task.kind==='deliverable'&&task.status!=='done').length,upcomingMilestones:milestones.filter(item=>!item.completed).sort((a,b)=>(a.due_date??'9999').localeCompare(b.due_date??'9999')).slice(0,5)};
}
export function dependencyOpen(task:Task,tasks:Task[]){return Boolean(task.blocked_by&&tasks.some(other=>other.id===task.blocked_by&&other.status!=='done'));}
export function csvCell(value:unknown){const text=String(value??'');return `"${(/^[\s]*[=+\-@]|^[\t\r\n]/.test(text)?"'":'')+text.replaceAll('"','""')}"`;}
export function tasksCSV(tasks:Task[],projects:Project[],members:Member[]){const rows=[['Project','Task','Type','Status','Priority','Assignee','Start','Due','Estimated hours','Acceptance criteria'],...tasks.map(task=>[projects.find(project=>project.id===task.project_id)?.name??'',task.title,task.kind,task.status,task.priority,members.find(member=>member.user_id===task.assignee_id)?.display_name??'Unassigned',task.start_date??'',task.due_date??'',task.estimated_hours,task.acceptance_criteria])];return '\ufeff'+rows.map(row=>row.map(csvCell).join(',')).join('\r\n');}
