import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/config';
import { signOut } from '@/app/auth/actions';
import { hasAdvanced } from '@/lib/entitlements';
import { billingAvailable } from '@/lib/shopify/config';
import { BillingActions } from '@/components/billing-actions';
import { SavedCalculations } from '@/components/saved-calculations';
export const metadata={title:'Your account',robots:{index:false,follow:false}};
export default async function Account({searchParams}:{searchParams:Promise<{page?:string}>}){
 if(!isSupabaseConfigured())redirect('/sign-in');const supabase=await createClient();const {data:{user},error}=await supabase.auth.getUser();if(error||!user)redirect('/sign-in');
 const {data:subscription,error:subscriptionError}=await supabase.from('subscriptions').select('status,current_period_end,billing_customer_id').eq('user_id',user.id).maybeSingle();
 const advanced=!subscriptionError&&hasAdvanced(subscription);const checkoutAvailable=billingAvailable();
 const rawPage=Number((await searchParams).page??0);const page=Number.isInteger(rawPage)&&rawPage>=0&&rawPage<=10000?rawPage:0;
 const {data:rows,error:recordsError,count}=await supabase.from('saved_calculations').select('id,title,tool_slug,tax_year,created_at,rule_set_version',{count:'exact'}).eq('user_id',user.id).order('created_at',{ascending:false}).order('id',{ascending:false}).range(page*50,page*50+49);
 return <div className="wrap section"><p className="eyebrow">Your workspace</p><h1>A clearer view.</h1><p>Signed in as {user.email}</p>{subscriptionError?<div className="notice">Your plan could not be checked. Try again later.</div>:<p className="tag">{advanced?'Advanced':'Free plan'}</p>}<div className="notice"><h2>{advanced?'Your Advanced workspace':'Advanced — £1.99/month'}</h2><p>{advanced?'Save named calculations from the tools, compare two saved scenarios and download HTML/PDF-ready or CSV reports.':'Saved calculations, scenario comparisons and downloadable reports are available to active Advanced accounts. Checkout is offered through Shopify only after the recurring product and webhook configuration are enabled.'}</p>{advanced&&<p>Current paid access ends: {subscription?.current_period_end?new Date(subscription.current_period_end).toLocaleDateString('en-GB',{timeZone:'UTC'}):'Not available'}. Use Shopify to manage or cancel renewal. Cancellation does not remove the period you have already paid for.</p>}<BillingActions available={checkoutAvailable} advanced={advanced} hasHistory={Boolean(subscription?.billing_customer_id?.startsWith("shopify:"))}/><Link className="text-link" href="/pricing">Plan details →</Link></div>{recordsError?<p role="alert">Saved calculations could not be loaded. Please try again.</p>:<SavedCalculations rows={rows??[]} advanced={advanced}/>}<nav aria-label="Saved calculation pages">{page>0&&<Link className="text-link" href={`/account?page=${page-1}`}>← Previous saved results</Link>}{(page+1)*50<(count??0)&&<Link className="text-link" href={`/account?page=${page+1}`}>More saved results →</Link>}</nav><form action={signOut}><button className="button secondary" type="submit">Sign out</button></form></div>;
}
