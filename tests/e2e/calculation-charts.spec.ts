import { test,expect } from '@playwright/test';

test('salary chart uses annual amounts, preserves monthly pay and clears with edits',async({page})=>{
 await page.setViewportSize({width:375,height:812});await page.goto('/tools/salary-take-home-calculator');
 await page.getByLabel('Annual salary before pension deductions (£)',{exact:true}).fill('44160');
 await page.getByLabel('Income Tax region').selectOption('scotland');await page.getByLabel('Pension deduction method').selectOption('salary-sacrifice');
 await page.getByLabel('Undergraduate student loan plan').selectOption('plan4');await page.getByLabel(/I understand this assumes standard monthly payroll/).check();
 await page.getByRole('button',{name:'Check my salary'}).click();
 await expect(page.locator('.result h2')).toHaveText('£2,742.41');
 const chart=page.getByRole('figure',{name:'Where your annual salary goes',exact:true});await expect(chart).toBeVisible();
 await expect(chart.getByText('£32,908.93',{exact:true})).toBeVisible();await expect(chart.getByText('£2,208.00',{exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.getByLabel('Your pension contribution (%)',{exact:true}).fill('6');await expect(chart).toHaveCount(0);
});

test('rental charts separate yields and cash with negative scenarios shown honestly',async({page})=>{
 await page.setViewportSize({width:375,height:812});await page.goto('/tools/rental-yield-mortgage-planner');
 await page.getByRole('button',{name:'Plan my yield and mortgage'}).click();
 const yieldChart=page.getByRole('figure',{name:'Yield before mortgage finance',exact:true});
 await expect(yieldChart.getByText('6.00%',{exact:true})).toBeVisible();await expect(yieldChart.getByText('4.00%',{exact:true})).toBeVisible();
 const scenarios=page.getByRole('figure',{name:'Mortgage scenarios: first-year cash flow',exact:true});
 await expect(scenarios.getByText('-£2,500.00',{exact:true})).toBeVisible();await expect(scenarios.locator('.chart-negative')).toHaveCount(2);
 const trend=page.getByRole('figure',{name:'Illustrated mortgage balance',exact:true});await expect(trend.getByRole('img')).toBeVisible();
 await trend.getByText('Show exact chart figures',{exact:true}).click();await expect(trend.locator('tbody tr').last()).toContainText('£150,000.00');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});

test('VAT shows two separate threshold charts and handles all-zero inputs',async({page})=>{
 await page.goto('/tools/vat-threshold-checker');
 await page.getByRole('button',{name:'Check VAT position'}).click();
 const historic=page.getByRole('figure',{name:'Rolling turnover against the VAT threshold',exact:true}),future=page.getByRole('figure',{name:'Next 30 days alone against the VAT threshold',exact:true});
 await expect(historic.getByText('£0.00',{exact:true})).toBeVisible();await expect(historic.getByText('£90,000.00',{exact:true})).toBeVisible();
 await expect(future.getByText('£90,000.00',{exact:true})).toBeVisible();
 await page.getByLabel('Expected taxable turnover in the next 30 days alone (£)').fill('100000');await expect(future).toHaveCount(0);
 await page.getByRole('button',{name:'Check VAT position'}).click();await expect(future.getByText('£100,000.00',{exact:true})).toBeVisible();await expect(historic.getByText('£0.00',{exact:true})).toBeVisible();
});

test('reserve graph keeps negative funding visible with exact annual points',async({page})=>{
 await page.setViewportSize({width:375,height:812});await page.goto('/tools/property-maintenance-reserve');
 await page.getByLabel('Planning horizon').selectOption('5');await page.getByLabel('Annual cost inflation (%)').fill('0');await page.getByLabel('Cost contingency (%)').fill('0');
 await page.getByRole('button',{name:'Remove component 2'}).click();await page.getByLabel('Current replacement cost (£)').fill('4000');await page.getByLabel('First due calendar year').fill('2026');await page.getByLabel('Repeat every years (0 = once)').fill('0');
 await page.getByRole('button',{name:'Build my reserve plan'}).click();
 const graph=page.getByRole('figure',{name:'Maintenance reserve over time',exact:true});await expect(graph.getByRole('img')).toBeVisible();await graph.getByText('Show exact chart figures',{exact:true}).click();await expect(graph.locator('tbody tr').first()).toContainText('-£3,000.00');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:'/tmp/my-business-checker-reserve-charts.png',fullPage:true});
});
