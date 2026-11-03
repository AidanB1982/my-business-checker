import { test, expect, type Page } from '@playwright/test';
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
let bundle: Promise<string> | undefined;
async function fixture(page: Page) {
 const js = await (bundle ??= build({ stdin: { contents: `import React from 'react';import{createRoot}from'react-dom/client';import{SiteHeader}from'./src/components/site-header';import{WorkspaceSections}from'./src/components/workspace-sections';import{AppearanceLoader,AppearanceSettings}from'./src/components/appearance-settings';import{ValueChart,MoneyTrend}from'./src/components/calculation-charts';createRoot(document.getElementById('root')).render(<><AppearanceLoader/><SiteHeader/><main className="wrap section"><WorkspaceSections/><AppearanceSettings/><ValueChart title="Example figures" note="A fixed example" rows={[{label:'Income',value:10000,unit:'money',tone:'income'},{label:'Costs',value:4000,unit:'money',tone:'cost'}]}/><MoneyTrend title="Example trend" note="A fixed example" labels={['Jan','Feb']} series={[{label:'Income',values:[5000,10000]},{label:'Costs',values:[3000,4000]}]}/></main></>);`, resolveDir: process.cwd(), loader: 'tsx' }, bundle: true, write: false, platform: 'browser', format: 'iife', jsx: 'automatic', define: { 'process.env.NODE_ENV': '"production"' }, plugins: [{ name: 'next', setup(b) {
 b.onResolve({filter:/^next\/(link|navigation)$/},args=>({path:args.path,namespace:'next'}));
 b.onLoad({filter:/.*/,namespace:'next'},args=>({contents:args.path==='next/link'?"import React from'react';export default function Link({children,...props}){return React.createElement('a',props,children)}":"export const usePathname=()=>'/account';",loader:'js',resolveDir:process.cwd()}));
 } }] }).then(r=>r.outputFiles[0].text));
 const css = await readFile('src/app/globals.css','utf8');
 await page.route('http://localhost:4193/**',route=>{
  const path = new URL(route.request().url()).pathname;
  return route.fulfill({contentType:path==='/fixture.js'?'text/javascript':path==='/style.css'?'text/css':'text/html',body:path==='/fixture.js'?js:path==='/style.css'?css:'<!doctype html><html><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"><div id="root"></div><script src="/fixture.js"></script></html>'});
 });
 await page.goto('http://localhost:4193/account');
}
test('workspace tiles expose relevant sections with usable mobile links',async({page})=>{
 await page.setViewportSize({width:390,height:844});await fixture(page);
 const sole=page.getByRole('button',{name:/Sole traders/});await sole.click();await expect(sole).toHaveAttribute('aria-expanded','true');await expect(page.getByRole('link',{name:'Sole trader monthly working'})).toHaveAttribute('href','/tools/sole-trader-working-sheet');
 await page.getByRole('button',{name:/Landlords/}).click();await expect(sole).toHaveAttribute('aria-expanded','false');await expect(page.getByRole('link',{name:'Landlord rent reconciliation'})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.getByRole('link',{name:'My workspace',exact:true}).click();await expect(page).toHaveURL('http://localhost:4193/account');await expect(page.getByRole('button',{name:/Landlords/})).toHaveAttribute('aria-expanded','false');
});
test('app and graph colours change independently and persist without changing chart figures',async({page})=>{
 await fixture(page);await page.getByText('Colours & graphs',{exact:true}).click();
 const bar=page.locator('.chart-income');const initialBar=await bar.evaluate(e=>getComputedStyle(e).backgroundColor);
 await page.getByLabel('App colour scheme').selectOption('plum');await expect(page.locator('html')).toHaveAttribute('data-scheme','plum');expect(await bar.evaluate(e=>getComputedStyle(e).backgroundColor)).toBe(initialBar);
 await page.getByLabel('Graph colours').selectOption('ocean');expect(await bar.evaluate(e=>getComputedStyle(e).backgroundColor)).not.toBe(initialBar);await expect(page.getByRole('figure',{name:'Example figures'})).toContainText('£100.00');
 expect(await page.locator('.trend-series-0 polyline').evaluate(e=>getComputedStyle(e).stroke)).toBe(await bar.evaluate(e=>getComputedStyle(e).backgroundColor));
 await page.reload();await expect(page.locator('html')).toHaveAttribute('data-scheme','plum');await expect(page.locator('html')).toHaveAttribute('data-graphs','ocean');
 await page.getByText('Colours & graphs',{exact:true}).click();await page.getByRole('button',{name:'Reset colours'}).click();await expect(page.locator('html')).toHaveAttribute('data-scheme','forest');await expect(page.locator('html')).toHaveAttribute('data-graphs','classic');
});

test('My workspace navigates from the real mobile homepage to sign-in for a signed-out visitor',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto('/');await page.getByRole('link',{name:'My workspace',exact:true}).click();await expect(page).toHaveURL(/\/sign-in/);await expect(page.getByRole('heading',{name:'Welcome back.'})).toBeVisible();
});
