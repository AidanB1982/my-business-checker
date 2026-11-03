import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';
import type { WorkspaceData } from '../../src/lib/projects/schema';

// Bundle the real client UI in tests only. Production has no fixture route or auth bypass.
export const owner='11111111-1111-4111-8111-111111111111';
export const workspaceId='22222222-2222-4222-8222-222222222222';
const projectId='33333333-3333-4333-8333-333333333333';
const stamp='2026-11-01T12:00:00Z';
let bundle:Promise<string>|undefined;
function script(){return bundle??=build({stdin:{contents:`import React from 'react';import{createRoot}from'react-dom/client';import{ProjectsWorkspace}from'./src/components/projects-workspace';createRoot(document.getElementById('root')).render(<ProjectsWorkspace userId="${owner}" displayName="Aidan"/>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'test-link',setup(b){b.onResolve({filter:/^next\/link$/},()=>({path:'link',namespace:'test'}));b.onLoad({filter:/.*/,namespace:'test'},()=>({contents:`import React from'react';export default function Link({children,...props}){return React.createElement('a',props,children);}`,loader:'jsx',resolveDir:process.cwd()}));}}]}).then(result=>result.outputFiles[0].text);}
export async function projectFixture(page:Page,{viewer=false,conflict=false}={}){
 const data:WorkspaceData={workspace:{id:workspaceId,owner_id:owner,name:'Publishing studio',description:'Plan the next launch together.',created_at:stamp},members:[{workspace_id:workspaceId,user_id:owner,display_name:'Aidan',role:viewer?'viewer':'owner',weekly_capacity:35}],projects:[{id:projectId,workspace_id:workspaceId,name:'Autumn launch',description:'A clear plan for the next release.',status:'active',start_date:'2026-11-01',due_date:'2026-11-30',version:1,created_at:stamp,updated_at:stamp}],tasks:[{id:'44444444-4444-4444-8444-444444444444',workspace_id:workspaceId,project_id:projectId,created_by:owner,title:'Review manuscript',description:'Check the final draft.',status:'in-progress',kind:'task',priority:'high',assignee_id:owner,milestone_id:null,blocked_by:null,start_date:'2026-11-02',due_date:'2026-11-06',estimated_hours:8,acceptance_criteria:'Ready for layout',checklist:[],version:1,created_at:stamp,updated_at:stamp}],milestones:[],activity:[],invitations:[],canWrite:!viewer,role:viewer?'viewer':'owner'};
 const [js,css]=await Promise.all([script(),readFile('src/app/globals.css','utf8')]);
 const mutations:Record<string,unknown>[]=[];
 await page.route('http://localhost:4179/**',async route=>{
  const url=new URL(route.request().url());
  if(url.pathname==='/fixture.js')return route.fulfill({contentType:'application/javascript',body:js});
  if(!url.pathname.startsWith('/api/'))return route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Project UI fixture</title><style>${css}</style></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>`});
  const json=(body:unknown,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
  if(url.pathname==='/api/projects')return json({memberships:[{...data.members[0],workspace:data.workspace}],canCreate:!viewer});
  if(url.pathname.endsWith('/figures'))return json({figures:data.projects.map(p=>({project_id:p.id,capital:0,expense:0,completed:0,depreciation:0}))});
  if(url.pathname.endsWith('/comments'))return json({comments:[],hasMore:false});
  if(route.request().method()==='GET')return json(data);
  const input=route.request().postDataJSON();mutations.push(input);
  if(conflict)return json({error:'This task changed. Reload it before saving again.'},409);
  if(input.action==='project.create'){const id=crypto.randomUUID();data.projects.push({...input.data,id,workspace_id:workspaceId,version:1,created_at:stamp,updated_at:stamp});return json({id});}
  if(input.action==='project.update'){const p=data.projects.find(p=>p.id===input.id)!;Object.assign(p,input.data,{version:p.version+1});}
  if(input.action==='task.create'){data.tasks.push({...input.data,id:crypto.randomUUID(),workspace_id:workspaceId,created_by:owner,version:1,created_at:stamp,updated_at:stamp});}
  if(input.action==='task.update'){const index=data.tasks.findIndex(task=>task.id===input.id);data.tasks[index]={...data.tasks[index],...input.data,version:data.tasks[index].version+1};}
  if(input.action==='milestone.create')data.milestones.push({...input.data,id:crypto.randomUUID(),workspace_id:workspaceId,version:1,created_at:stamp});
  if(input.action==='invite.create')return json({inviteToken:'a'.repeat(64)});
  return json({ok:true});
 });
 await page.goto('http://localhost:4179/projects');
 return {data,mutations};
}
