import { test, expect } from '@playwright/test';
test('finds a tool and calculates a mileage expense locally',async({page})=>{
 await page.goto('/');
 await expect(page.getByRole('heading',{level:1})).toContainText('Your business.');
 await page.getByRole('searchbox').fill('mileage');
 await page.getByRole('link',{name:/Business mileage/}).click();
 await page.getByLabel('Qualifying business miles').fill('12000');
 await page.getByRole('button',{name:/Estimate mileage/}).click();
 await expect(page.getByRole('heading',{name:'£5,000.00'})).toBeVisible();
 await expect(page.getByText(/not your tax saving/)).toBeVisible();
 await page.getByLabel('Qualifying business miles').fill('500');
 await expect(page.getByRole('heading',{name:'£5,000.00'})).not.toBeVisible();
});
test('displays honest paid plan and sign-in configuration state',async({page})=>{
 await page.goto('/pricing');
 await expect(page.getByText(/£1.99/)).toBeVisible();
 await expect(page.getByText(/You will not be charged/)).toBeVisible();
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
 await expect(page.getByText('£13,048.60',{exact:true})).toBeVisible();
 await expect(page.getByText('£1,087.39 each month',{exact:true})).toBeVisible();
 await page.getByText('Why is it that number?').click();
 await expect(page.getByText(/Total Income Tax on business profit/)).toBeVisible();
 await page.getByLabel('Tax year',{exact:true}).selectOption('2025/26');
 await expect(page.getByRole('heading',{name:'£44,951.40'})).not.toBeVisible();
 await page.getByRole('button',{name:'Calculate my take-home'}).click();
 await expect(page.getByText(/Tax year 2025\/26 · Rule set/)).toBeVisible();
 await page.getByLabel('Where do you pay Income Tax?').selectOption('scotland');
 await expect(page.getByRole('button',{name:'Calculate my take-home'})).toBeDisabled();
 await expect(page.getByRole('heading',{name:'£44,951.40'})).not.toBeVisible();
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
