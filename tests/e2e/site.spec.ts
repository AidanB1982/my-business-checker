import { test, expect } from '@playwright/test';
test('finds a tool and calculates a mileage expense locally',async({page})=>{
 await page.goto('/');
 await expect(page.getByRole('heading',{level:1})).toContainText('Your business.');
 await page.getByRole('searchbox').fill('mileage');
 await page.getByRole('link',{name:/Business mileage/}).click();
 await page.getByLabel('Qualifying business miles').fill('12000');
 await page.getByRole('button',{name:/Estimate mileage/}).click();
 await expect(page.getByRole('heading',{name:'£6,000.00'})).toBeVisible();
 await expect(page.getByText('Miles at 55p',{exact:true})).toBeVisible();
 await page.getByLabel('Tax year',{exact:true}).selectOption('2025/26');
 await expect(page.getByRole('heading',{name:'£6,000.00'})).not.toBeVisible();
 await page.getByRole('button',{name:/Estimate mileage/}).click();
 await expect(page.getByRole('heading',{name:'£5,000.00'})).toBeVisible();
 await expect(page.getByText('Miles at 45p',{exact:true})).toBeVisible();
 await expect(page.getByText(/not your tax saving/)).toBeVisible();
 await page.getByLabel('Qualifying business miles').fill('500');
 await expect(page.getByRole('heading',{name:'£5,000.00'})).not.toBeVisible();
});
test('displays honest paid plan and sign-in configuration state',async({page})=>{
 await page.goto('/pricing');
 await expect(page.getByText('£1.99 / month',{exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Subscribe for £1.99/month'})).toBeVisible();
 await expect(page.getByRole('link',{name:'View your account'})).toHaveCount(0);
 expect(await page.locator('main').innerText()).not.toContain('—');
 const health=await (await page.request.get('/api/health')).json();
 if(!health.billing.configured)await expect(page.getByText(/You will not be charged/)).toBeVisible();
 await page.goto('/account');
 await expect(page).toHaveURL(/sign-in/);
 await expect(page.getByRole('heading',{name:'Welcome back.'})).toBeVisible();
});
test('mobile navigation and tools have no horizontal overflow',async({page})=>{
 await page.setViewportSize({width:375,height:812});
 await page.goto('/');
 await expect(page.getByRole('navigation').getByRole('link',{name:'Tools',exact:true})).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
 await page.getByRole('navigation').getByRole('link',{name:'Guides',exact:true}).click();
 await expect(page.getByRole('heading',{level:1})).toContainText('explanation');
});

test('self-employed tax shows a breakdown and invalidates stale results',async({page})=>{
 await page.goto('/tools/self-employed-tax-calculator');
 await expect(page.getByText('Development estimate · source review pending')).toBeVisible();
 await page.getByLabel(/I meet the age/).check();
 await page.getByRole('button',{name:'Calculate my take-home'}).click();
 await expect(page.getByRole('heading',{name:'£44,951.40'})).toBeVisible();
 await expect(page.getByRole('definition').filter({hasText:'£13,048.60'})).toBeVisible();
 await expect(page.getByText('£1,087.39 each month',{exact:true})).toBeVisible();
 await page.getByText('Why is it that number?').click();
 await expect(page.getByText(/Total Income Tax on business profit/)).toBeVisible();
 await page.getByLabel('Tax year',{exact:true}).selectOption('2025/26');
 await expect(page.getByRole('heading',{name:'£44,951.40'})).not.toBeVisible();
 await page.getByRole('button',{name:'Calculate my take-home'}).click();
 await expect(page.getByText(/Tax year 2025\/26 · Rule set/)).toBeVisible();
 await page.getByLabel('Where do you pay Income Tax?').selectOption('scotland');
 await expect(page.getByRole('heading',{name:'£44,951.40'})).not.toBeVisible();
 await expect(page.getByRole('button',{name:'Calculate my take-home'})).toBeEnabled();
 await page.getByRole('button',{name:'Calculate my take-home'}).click();
 await expect(page.getByRole('heading',{name:'£43,209.60'})).toBeVisible();
 await page.getByText('Why is it that number?').click();
 await expect(page.getByText(/Total Scottish Income Tax/)).toBeVisible();
 await expect(page.getByText(/Starter rate:/)).toBeVisible();
 await page.getByLabel('Tax year',{exact:true}).selectOption('2026/27');
 await expect(page.getByRole('heading',{name:'£43,209.60'})).not.toBeVisible();
 await expect(page.getByRole('button',{name:'Calculate my take-home'})).toBeEnabled();
 await page.getByRole('button',{name:'Calculate my take-home'}).click();
 await expect(page.getByRole('heading',{name:'£43,241.35'})).toBeVisible();
 await page.getByLabel('Where do you pay Income Tax?').selectOption('england');
 await expect(page.getByRole('heading',{name:'£43,241.35'})).not.toBeVisible();
 await page.getByRole('button',{name:'Calculate my take-home'}).click();
 await expect(page.getByRole('heading',{name:'£44,951.40'})).toBeVisible();
});
test('tax preview stays local and fits mobile',async({page})=>{
 await page.setViewportSize({width:375,height:812});
 const outbound:string[]=[];
 page.on('request',request=>{if(['fetch','xhr'].includes(request.resourceType())&&!request.url().startsWith('http://127.0.0.1:3000'))outbound.push(request.url());});
 await page.goto('/tools/self-employed-tax-calculator');
 await page.getByLabel('Business income (£)',{exact:true}).fill('10000');
 await page.getByLabel('Allowable business expenses (£)',{exact:true}).fill('0');
 await page.getByLabel(/I meet the age/).check();
 await page.getByRole('button',{name:'Calculate my take-home'}).click();
 await expect(page.getByRole('heading',{name:'£10,000.00'})).toBeVisible();
 expect(outbound).toEqual([]);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});

test('installable manifest, icons and offline navigation are available',async({page,context})=>{
 const manifestResponse=await page.request.get('/manifest.webmanifest');
 expect(manifestResponse.ok()).toBe(true);
 const manifest=await manifestResponse.json();
 expect(manifest).toMatchObject({name:'My Business Checker',display:'standalone',start_url:'/tools',scope:'/'});
 for(const icon of manifest.icons){const response=await page.request.get(icon.src);expect(response.ok()).toBe(true);expect(response.headers()['content-type']).toContain('image/png');}
 await page.goto('/');
 await expect(page.locator('link[rel="manifest"]')).toHaveAttribute('href','/manifest.webmanifest');
 await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
 await page.reload();
 await page.waitForFunction(()=>Boolean(navigator.serviceWorker.controller));
 await page.goto('/sign-in');
 const cached=await page.evaluate(async()=>{const cache=await caches.open('mbc-offline-v1');return (await cache.keys()).map(request=>new URL(request.url).pathname);});
 expect(cached).toEqual(['/offline.html']);
 await context.setOffline(true);
 await page.goto('/tools');
 await expect(page.getByRole('heading',{name:'You’re offline.'})).toBeVisible();
 await expect(page.getByText('Your financial figures are not stored for offline use.',{exact:false})).toBeVisible();
 await context.setOffline(false);
 await page.getByRole('button',{name:'Try again'}).click();
 await expect(page.getByRole('heading',{name:'Your business toolbox.'})).toBeVisible();
});

test('VAT checks rolling turnover and the separate forecast without combining them',async({page})=>{
 await page.goto('/tools/vat-threshold-checker');
 const months=page.getByLabel(/taxable turnover \(£\)$/);await expect(months).toHaveCount(12);
 for(const month of await months.all())await month.fill('7500');
 await page.getByRole('button',{name:'Check VAT position'}).click();
 await expect(page.locator('.result').getByText('Below these two tests',{exact:true})).toBeVisible();
 await page.getByLabel('Expected taxable turnover in the next 30 days alone (£)').fill('90000.01');
 await page.getByRole('button',{name:'Check VAT position'}).click();
 await expect(page.locator('.result').getByText('Check registration now',{exact:true})).toBeVisible();
 await expect(page.locator('.result').getByText('Above threshold',{exact:true})).toHaveCount(1);
});
test('MTD uses the reference year and preserves exemption uncertainty',async({page})=>{
 await page.goto('/tools/mtd-checker');
 await page.getByLabel('Gross self-employment income before expenses (£)').fill('50000');
 await page.getByLabel('Your share of gross property income (£)').fill('1');
 await page.getByRole('button',{name:'Check MTD timing'}).click();
 await expect(page.locator('.result').getByText('2026-04-06',{exact:true})).toBeVisible();
 await page.getByLabel('Income reference tax year').selectOption('2025/26');
 await page.getByRole('button',{name:'Check MTD timing'}).click();
 await expect(page.locator('.result').getByText('2027-04-06',{exact:true})).toBeVisible();
 await page.getByLabel('I may qualify for an exemption').check();
 await page.getByRole('button',{name:'Check MTD timing'}).click();
 await expect(page.locator('.result').getByText('Possible exemption · confirm with HMRC',{exact:true})).toBeVisible();
});
test('salary comparison includes employer NI and does not assume Employment Allowance',async({page})=>{
 await page.goto('/tools/salary-dividend-calculator');
 await page.getByRole('button',{name:'Compare salary and dividends'}).click();
 await expect(page.locator('.result').getByText('£1,135.50',{exact:true})).toBeVisible();
 await page.getByLabel('The company is eligible for Employment Allowance and the full allowance is unused').check();
 await page.getByRole('button',{name:'Compare salary and dividends'}).click();
 await expect(page.locator('.result').getByText('£1,135.50',{exact:true})).not.toBeVisible();
 await expect(page.locator('.result').getByText('Chosen mix: personal take-home',{exact:true})).toBeVisible();
});
test('tax extensions and explicit save do not grant anonymous access',async({page})=>{
 await page.goto('/tools/self-employed-tax-calculator');
 await page.getByText('Pension, student loans and tax payments',{exact:true}).click();
 await page.getByLabel('Net relief-at-source pension paid (£)').fill('8000');
 await page.getByLabel('Undergraduate student loan plan').selectOption('plan2');
 await page.getByLabel(/I meet the age/).check();
 await page.getByRole('button',{name:'Calculate my take-home'}).click();
 await expect(page.getByRole('heading',{name:'£35,922.40'})).toBeVisible();
 await page.getByLabel('Calculation name').fill('Next year');
 await page.getByLabel('Save these financial figures securely to my account.').check();
 const denied=page.waitForResponse(response=>response.url().endsWith('/api/calculations')&&response.request().method()==='POST');
 await page.getByRole('button',{name:'Save to my account'}).click();
 const response=await denied;expect([401,503]).toContain(response.status());
 await expect(page.getByRole('status')).toContainText(response.status()===401?'Sign in':'Accounts are not configured');
});

test('pricing starts checkout directly and preserves the sign-in return',async({page})=>{
 const health=await (await page.request.get('/api/health')).json();
 await page.goto('/pricing');const subscribe=page.getByRole('button',{name:'Subscribe for £1.99/month'});
 if(!health.billing.configured){await expect(subscribe).toBeDisabled();return;}
 const denied=page.waitForResponse(response=>response.url().endsWith('/api/billing/checkout')&&response.request().method()==='POST');
 await subscribe.click();const response=await denied;
 if(health.supabase.configured){expect(response.status()).toBe(401);await expect(page).toHaveURL(/\/sign-in\?next=%2Fpricing/);await expect(page.locator('input[name="returnTo"]')).toHaveValue('/pricing');}
 else{expect(response.status()).toBe(503);await expect(page.getByRole('status')).toContainText('Accounts are not configured');}
});

test('salary checker distinguishes normal deductions from salary sacrifice and relief claims',async({page})=>{
 await page.goto('/tools/salary-take-home-calculator');
 await page.getByLabel(/I understand this assumes standard monthly payroll/).check();
 await page.getByRole('button',{name:'Check my salary'}).click();
 await expect(page.locator('.result .metric-row').filter({hasText:'Annual payslip take-home estimate'}).getByRole('definition')).toHaveText('£50,158.00');
 await page.getByLabel('Pension deduction method').selectOption('salary-sacrifice');
 await page.getByRole('button',{name:'Check my salary'}).click();
 await expect(page.locator('.result .metric-row').filter({hasText:'Annual payslip take-home estimate'}).getByRole('definition')).toHaveText('£50,230.00');
 await page.getByLabel('Pension deduction method').selectOption('relief-at-source');
 await page.getByRole('button',{name:'Check my salary'}).click();
 await expect(page.locator('.result').getByText('£49,438.00',{exact:true})).toBeVisible();
 await expect(page.locator('.result').getByText('£720.00',{exact:true})).toHaveCount(2);
 await page.getByLabel('What does your percentage represent?').selectOption('net');
 await page.getByLabel('Your pension contribution (%)').fill('4');
 await page.getByRole('button',{name:'Check my salary'}).click();
 await expect(page.locator('.result').getByText('£49,438.00',{exact:true})).toBeVisible();
});
test('pension predictor shows an unchanged-salary baseline and yearly chart on mobile',async({page})=>{
 await page.setViewportSize({width:375,height:812});await page.goto('/tools/pension-pot-predictor');
 await page.getByLabel('Current annual salary (£)').fill('72000');
 await page.getByLabel('Target retirement age').fill('45');
 await page.getByText('Projection assumptions',{exact:true}).click();
 await page.getByLabel('Annual investment growth before fees (%)').fill('0');
 await page.getByLabel('Annual pension fee (%)').fill('0');await page.getByLabel('Annual inflation assumption (%)').fill('0');
 await page.getByRole('button',{name:'Project my pension'}).click();
 await expect(page.getByRole('heading',{name:'£67,600.00'})).toBeVisible();
 await expect(page.getByRole('img',{name:'Projected pension pot over time'})).toBeVisible();
 await page.getByText('Year-by-year figures',{exact:true}).click();
 await expect(page.getByRole('table')).toBeVisible();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
 await page.getByLabel('Current defined-contribution pension pot (£)').fill('20000');
 await expect(page.getByRole('heading',{name:'£67,600.00'})).not.toBeVisible();
});
test('new tools and supporting guides are discoverable',async({page})=>{
 await page.goto('/tools');await page.getByRole('searchbox').fill('pension');
 await page.getByRole('link',{name:/Pension pot predictor/}).click();
 await page.getByRole('link',{name:'Understand how this works'}).click();
 await expect(page.getByRole('heading',{name:'Projecting your pension pot'})).toBeVisible();
});

test('checkout stays open until confirmed payment then closes and returns to account',async({page,context})=>{
 const health=await (await page.request.get('/api/health')).json();
 test.skip(!health.billing.configured,'Use fixture billing environment variables to exercise the mocked checkout flow.');
 let paid=false;
 await context.route('https://blackwoodpublishing.myshopify.com/checkout/browser-fixture',route=>route.fulfill({contentType:'text/html',body:'<h1>Shopify checkout fixture</h1>'}));
 await page.route('**/api/billing/checkout',route=>route.fulfill({json:{url:'https://blackwoodpublishing.myshopify.com/checkout/browser-fixture'}}));
 await page.route('**/api/billing/status',route=>route.fulfill({json:{advanced:paid}}));
 await page.goto('/pricing');const subscribe=page.getByRole('button',{name:'Subscribe for £1.99/month'});
 const opened=page.waitForEvent('popup');await subscribe.click();const checkout=await opened;
 await expect(checkout.getByRole('heading')).toHaveText('Shopify checkout fixture');
 await expect(page.getByRole('status')).toContainText('Complete payment in Shopify');
 await expect(page).toHaveURL(/\/pricing$/);expect(checkout.isClosed()).toBe(false);
 expect(await checkout.evaluate(()=>window.opener!==null)).toBe(true);
 const confirmation=page.waitForResponse(async response=>response.url().endsWith('/api/billing/status')&&(await response.json()).advanced===true);
 paid=true;await confirmation;await expect.poll(()=>checkout.isClosed(),{timeout:10000}).toBe(true);
 await expect(page).not.toHaveURL(/\/pricing$/);
});

test('tool catalogue filters categories and combines them with search',async({page})=>{
 await page.goto('/tools');
 await page.getByRole('button',{name:'Planning',exact:true}).click();
 await expect(page.locator('.tool-card')).toHaveCount(2);
 await expect(page.getByRole('button',{name:'Planning',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.getByRole('searchbox').fill('pension');await expect(page.locator('.tool-card')).toHaveCount(1);
 await page.getByRole('button',{name:'Expenses',exact:true}).click();await expect(page.getByRole('heading',{name:'No tools found'})).toBeVisible();
 await page.getByRole('button',{name:'Show all tools'}).click();await expect(page.locator('.tool-card')).toHaveCount(10);
});
test('redesigned pages keep navigation and content within a narrow mobile viewport',async({page})=>{
 await page.setViewportSize({width:375,height:812});
 for(const path of ['/tools','/pricing','/sign-in','/tools/salary-take-home-calculator','/tools/pension-pot-predictor']){
  await page.goto(path);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),path).toBe(true);
  await expect(page.getByRole('link',{name:'My workspace',exact:true})).toBeVisible();
 }
 await page.goto('/tools');await expect(page.getByRole('navigation',{name:'Main navigation'}).getByRole('link',{name:'Tools',exact:true})).toHaveAttribute('aria-current','page');
});

test('native sole-trader section leads to an editable working with separated drawings',async({page})=>{
 await page.goto('/sole-traders');await expect(page.getByRole('heading',{level:1})).toContainText('A clearer month');
 expect(await page.locator('a[href$=".xlsx"],a[href$=".docx"]').count()).toBe(0);
 await page.getByRole('link',{name:/Sole trader monthly working/}).click();
 await page.getByLabel('Business income received (£)').fill('3000');await page.getByLabel('Owner drawings paid (£)').fill('500');
 await page.getByLabel('Expense description').nth(0).fill('Materials');await page.getByLabel('Amount paid (£)').nth(0).fill('300');
 await page.getByLabel('Expense description').nth(1).fill('Phone');await page.getByLabel('Amount paid (£)').nth(1).fill('60');await page.getByLabel('Business use (%)').nth(1).fill('50');
 await page.getByRole('button',{name:'Review my monthly working'}).click();await expect(page.locator('.result h2')).toHaveText('£2,670.00');
 await expect(page.locator('.result .metric-row').filter({hasText:'Period cash movement after all entered costs, drawings and planned reserve'}).getByRole('definition')).toHaveText('£1,472.50');
 await page.getByLabel('Owner drawings paid (£)').fill('600');await expect(page.locator('.result h2')).not.toHaveText('£2,670.00');
});
test('landlord rent working retains arrears separately from advance rent',async({page})=>{
 await page.goto('/tools/landlord-rent-reconciliation');
 for(const [label,value] of [['Opening rent arrears (£)','200'],['Rent due for this month (£)','1000'],['Rent received against this month and older arrears (£)','900'],['Rent received for future periods (£)','300'],['Opening funds held by agent (£)','100'],['Agent fees deducted (£)','120'],['Other costs paid by agent (£)','80'],['Agent remittances to landlord (£)','1000'],['Actual closing funds held by agent (£)','100']])await page.getByLabel(label,{exact:true}).fill(value);
 await page.getByRole('button',{name:'Reconcile my rent'}).click();await expect(page.locator('.result h2')).toHaveText('£300.00');
 await expect(page.locator('.result .metric-row').filter({hasText:'Unexplained difference: expected minus statement'}).getByRole('definition')).toHaveText('£0.00');
});
test('property reserve shows immediate shortfalls on mobile',async({page})=>{
 await page.setViewportSize({width:375,height:812});await page.goto('/tools/property-maintenance-reserve');
 await page.getByLabel('Planning horizon').selectOption('5');await page.getByLabel('Annual cost inflation (%)').fill('0');await page.getByLabel('Cost contingency (%)').fill('0');
 await page.getByRole('button',{name:'Remove component 2'}).click();await page.getByLabel('Current replacement cost (£)').fill('4000');await page.getByLabel('First due calendar year').fill('2026');await page.getByLabel('Repeat every years (0 = once)').fill('0');
 await page.getByRole('button',{name:'Build my reserve plan'}).click();
 await expect(page.locator('.result .metric-row').filter({hasText:'Immediate extra funding needed for first-year work'}).getByRole('definition')).toHaveText('£3,000.00');
 await expect(page.getByRole('heading',{name:'Year-by-year funding'})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('native reading is discoverable and Advanced lesson bodies stay protected',async({page})=>{
 await page.goto('/landlords');await page.getByRole('link',{name:/Gross rent and agent statements/}).click();await page.getByText('Show the working and explanation',{exact:true}).click();await expect(page.getByText(/Gross rent collected is £1,200/)).toBeVisible();
 await page.goto('/learn/sole-trader-bank-review');await expect(page.getByRole('heading',{name:'A little deeper with Advanced.'})).toBeVisible();expect(await page.content()).not.toContain('Use the closing statement balance and the bookkeeping balance for the same account and date.');
 for(const path of ['/sole-traders','/landlords','/learn/profit-cash-and-drawings']){await page.setViewportSize({width:375,height:812});await page.goto(path);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),path).toBe(true);}
});
