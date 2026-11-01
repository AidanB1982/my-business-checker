import { test,expect } from '@playwright/test';
import { projectFixture } from './project-fixture';

test('public project section preserves sign-in continuation',async({page})=>{
 await page.setViewportSize({width:375,height:812});
 await page.goto('/projects');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await expect(page.getByRole('heading',{level:1})).toContainText('Less chasing.');
 await page.getByRole('link',{name:'Open your projects'}).click();
 await expect(page).toHaveURL(/sign-in\?next=%2Fprojects$/);
 await expect(page.getByRole('heading',{name:'Welcome back.'})).toBeVisible();
});

test('invitation fragment is kept for sign-in without automatic acceptance',async({page})=>{
 let accepted=false;
 await page.route('**/api/projects/join',async route=>{accepted=true;await route.fulfill({json:{}});});
 await page.goto(`/projects/join#invite=${'a'.repeat(64)}`);
 await expect(page.getByRole('link',{name:'Sign in and continue'})).toBeVisible();
 await expect(page).toHaveURL(/\/projects\/join$/);
 const cookie=(await page.context().cookies()).find(cookie=>cookie.name==='mbc_project_invite');
 expect(cookie?.httpOnly).toBe(true);
 expect(accepted).toBe(false);
 await page.getByRole('link',{name:'Sign in and continue'}).click();
 await expect(page).toHaveURL(/sign-in\?next=%2Fprojects%2Fjoin$/);
});

test('project workspace creates a deliverable and moves it through board and list',async({page})=>{
 const {mutations}=await projectFixture(page);
 await expect(page.getByRole('heading',{name:'Publishing studio'})).toBeVisible();
 await page.getByRole('button',{name:'Board',exact:true}).click();
 await expect(page.getByRole('button',{name:'Review manuscript',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'New task',exact:true}).click();
 await page.getByLabel('Task title',{exact:true}).fill('Publish landing page');
 await page.getByLabel('Work type',{exact:true}).selectOption('deliverable');
 await page.getByLabel('Assignee',{exact:true}).selectOption({label:'Aidan'});
 await page.getByRole('button',{name:'Add checklist item',exact:true}).click();
 await page.getByLabel('Checklist item 1',{exact:true}).fill('Proofread content');
 await page.getByLabel('Complete checklist item 1',{exact:true}).check();
 await page.getByRole('button',{name:'Create task',exact:true}).click();
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Publish landing page',exact:true})).toBeVisible();
 await page.getByLabel('Status for Publish landing page',{exact:true}).selectOption('review');
 await expect.poll(()=>mutations.at(-1)?.action).toBe('task.update');
 await page.getByRole('button',{name:'Task list',exact:true}).click();
 await expect(page.getByRole('row').filter({hasText:'Publish landing page'})).toContainText('deliverable');
 await page.getByLabel('Search project tasks').fill('manuscript');
 await expect(page.getByRole('button',{name:'Publish landing page',exact:true})).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Review manuscript',exact:true})).toBeVisible();
});

test('milestones, workload and email-bound invitation controls work',async({page})=>{
 await projectFixture(page);
 await page.getByRole('button',{name:'New milestone',exact:true}).click();
 await page.getByLabel('Milestone title').fill('Launch signed off');
 await page.getByLabel('Milestone due date').fill('2026-11-15');
 await page.getByRole('button',{name:'Save milestone',exact:true}).click();
 await expect(page.getByRole('dialog')).toHaveCount(0);
 await expect(page.getByRole('button',{name:'Launch signed off',exact:true})).toBeVisible();
 await page.getByRole('button',{name:'Timeline',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Timeline and milestones'})).toBeVisible();
 await expect(page.locator('.timeline-row')).toHaveCount(2);
 await page.getByRole('button',{name:'Workload',exact:true}).click();
 await page.getByLabel('Workload week containing').fill('2026-11-03');
 await expect(page.locator('.workload-hours')).toContainText('8h');
 await page.getByRole('button',{name:'Team & settings',exact:true}).click();
 await page.getByLabel('Teammate email').fill('editor@example.com');
 await page.getByRole('button',{name:'Create invitation link',exact:true}).click();
 await expect(page.getByLabel('Invitation link · copy before leaving this page')).toHaveValue(/\/projects\/join#invite=a{64}$/);
});

test('viewer can review tasks and export but cannot edit',async({page})=>{
 await projectFixture(page,{viewer:true});
 await expect(page.getByText('You have viewer access.',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'New task',exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'Board',exact:true}).click();
 await expect(page.getByLabel('Status for Review manuscript',{exact:true})).toBeDisabled();
 await page.getByRole('button',{name:'Review manuscript',exact:true}).click();
 await expect(page.getByLabel('Task title',{exact:true})).toBeDisabled();
 await expect(page.getByRole('button',{name:'Save task',exact:true})).toHaveCount(0);
 await page.getByRole('button',{name:'Close editor'}).click();
 await page.locator('summary').filter({hasText:/^Export$/}).click();
 const download=page.waitForEvent('download');
 await page.getByRole('button',{name:'Export workspace JSON'}).click();
 expect((await download).suggestedFilename()).toBe('project-workspace.json');
});

test('a conflict preserves the unsaved task draft',async({page})=>{
 await projectFixture(page,{conflict:true});
 await page.getByRole('button',{name:'Board',exact:true}).click();
 await page.getByRole('button',{name:'Review manuscript',exact:true}).click();
 await page.getByLabel('Task title',{exact:true}).fill('My unsaved draft');
 await page.getByRole('button',{name:'Save task',exact:true}).click();
 await expect(page.getByRole('dialog').getByRole('alert')).toContainText('This task changed');
 await expect(page.getByLabel('Task title',{exact:true})).toHaveValue('My unsaved draft');
});

for(const width of [375,768,1440])test(`workspace views fit a ${width}px viewport`,async({page})=>{
 await page.setViewportSize({width,height:900});
 await projectFixture(page);
 await expect(page.getByRole('heading',{name:'Publishing studio'})).toBeVisible();
 for(const view of ['Overview','Board','Task list','Calendar','Timeline','Workload','Team & settings']){
  await page.getByRole('button',{name:view,exact:true}).click();
  if(width===1440&&view==='Board')await page.screenshot({path:'/tmp/my-business-checker-project-board.png',fullPage:true});
  const overflow=await page.evaluate(()=>Array.from(document.querySelectorAll('*')).filter(node=>{const r=node.getBoundingClientRect();return r.right>innerWidth+1&&r.width>0;}).slice(0,8).map(node=>({tag:node.tagName,class:node.className,width:node.getBoundingClientRect().width})));
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${view}: ${JSON.stringify(overflow)}`).toBe(true);
 }
});
