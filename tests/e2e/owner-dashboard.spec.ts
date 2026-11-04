import { test,expect,type Page } from '@playwright/test';
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
let bundle:Promise<string>|undefined;
async function fixture(page:Page) {
 const js=await(bundle??=build({stdin:{contents:`import React from'react';import{createRoot}from'react-dom/client';import{UsageTracker}from'./src/components/usage-tracker';import{UsagePreferences}from'./src/components/usage-preferences';import{OwnerDashboard}from'./src/components/owner-dashboard';import{MileageCalculator}from'./src/components/mileage-calculator';const stats={registeredUsers:42,newUsers30:7,advancedMembers:9,activeUsers7:12,activeUsers30:18,recordingSince:'2026-11-04',topTools:[{page:'business-mileage-calculator',users:8}],dailyActivity:[{day:'2026-11-04',users:12}]};createRoot(document.getElementById('root')).render(<><UsageTracker/>{location.pathname==='/account/owner'?<OwnerDashboard stats={stats}/>:<main className="wrap section"><UsagePreferences/>{location.pathname.startsWith('/tools/')&&<MileageCalculator/>}</main>}</>);`,resolveDir:process.cwd(),loader:'tsx'},bundle:true,write:false,platform:'browser',format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'},plugins:[{name:'next',setup(b){b.onResolve({filter:/^next\/(link|navigation)$/},args=>({path:args.path,namespace:'next'}));b.onLoad({filter:/.*/,namespace:'next'},args=>({contents:args.path==='next/link'?"import React from'react';export default function Link({children,...props}){return React.createElement('a',props,children)}":"export const usePathname=()=>window.location.pathname;",resolveDir:process.cwd(),loader:'js'}));}}]}).then(r=>r.outputFiles[0].text));
 const css=await readFile('src/app/globals.css','utf8');const writes:{method:string,body:unknown}[]=[];
 await page.route('http://localhost:4194/**',async route=>{const path=new URL(route.request().url()).pathname;if(path==='/api/usage'){writes.push({method:route.request().method(),body:route.request().method()==='POST'?route.request().postDataJSON():null});return route.fulfill({status:204});}return route.fulfill({contentType:path==='/fixture.js'?'text/javascript':path==='/style.css'?'text/css':'text/html',body:path==='/fixture.js'?js:path==='/style.css'?css:'<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="root"></div><script src="/fixture.js"></script></html>'});});
 return writes;
}
test('optional usage is off by default, sends only fixed page labels, and supports withdrawal and deletion',async({page})=>{
 const writes=await fixture(page);await page.goto('http://localhost:4194/account');await page.getByText('Optional usage sharing',{exact:true}).click();
 const checkbox=page.getByRole('checkbox',{name:'Share my app usage on this browser'});await expect(checkbox).not.toBeChecked();expect(writes).toEqual([]);
 await checkbox.check();await expect.poll(()=>writes.length).toBe(1);expect(writes[0]).toEqual({method:'POST',body:{page:'workspace',consent:true}});
 await page.goto('http://localhost:4194/tools/business-mileage-calculator?private=not-collected');await expect.poll(()=>writes.length).toBe(2);expect(writes[1].body).toEqual({page:'business-mileage-calculator',consent:true});
 await page.getByLabel('Qualifying business miles').fill('12000');await page.getByRole('button',{name:/Estimate mileage/}).click();await expect(page.getByRole('heading',{name:'£6,000.00'})).toBeVisible();expect(writes).toHaveLength(2);
 await page.getByText('Optional usage sharing',{exact:true}).click();await checkbox.uncheck();await expect(page.getByRole('status')).toContainText('sharing is off');
 await page.getByRole('button',{name:'Delete my usage history'}).click();await expect(page.getByRole('status')).toContainText('history has been deleted');expect(writes.at(-1)).toEqual({method:'DELETE',body:null});
 await page.reload();await page.getByText('Optional usage sharing',{exact:true}).click();await expect(checkbox).not.toBeChecked();expect(writes).toHaveLength(3);
});
test('private aggregate dashboard explains coverage and fits mobile',async({page})=>{
 await page.setViewportSize({width:390,height:844});const writes=await fixture(page);await page.goto('http://localhost:4194/account/owner');
 await expect(page.getByRole('heading',{name:'How your app is being used.'})).toBeVisible();await expect(page.getByRole('article').filter({has:page.getByRole('heading',{name:'Registered accounts',exact:true})})).toContainText('42');await expect(page.getByText('Activity is not a visitor count',{exact:false})).toBeVisible();
 await expect(page.getByRole('link',{name:'Business mileage'})).toHaveAttribute('href','/tools/business-mileage-calculator');await page.getByText('Show the last 30 days',{exact:true}).click();await expect(page.getByRole('cell',{name:'12',exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(writes).toEqual([]);
});
test('the deployed route does not expose the owner dashboard to signed-out visitors',async({page})=>{
 await page.goto('/account/owner');await expect(page).toHaveURL(/\/sign-in/);await expect(page.getByRole('heading',{name:'How your app is being used.'})).toHaveCount(0);
});
