import { WorkspaceSections } from '@/components/workspace-sections';
import { AppearanceSettings } from '@/components/appearance-settings';
import Link from 'next/link';
import { Icon } from '@/components/ui-icon';
import { tools } from '@/content/tools';
import { MembershipCheck } from '@/components/membership-check';
import { RecoverPayment } from '@/components/recover-payment';
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
 const paidUntil=subscription?.current_period_end?new Date(subscription.current_period_end).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}):null;

 return <div className="workspace-shell"><aside className="workspace-sidebar"><p className="eyebrow">Your space to plan</p><nav className="workspace-nav" aria-label="Workspace navigation"><Link href="/account" aria-current="page"><Icon name="grid" size={18}/>Overview</Link><Link href="/projects"><Icon name="grid" size={18}/>Projects & tasks</Link><Link href="/bookkeeping"><Icon name="file" size={18}/>Bookkeeping</Link><a href="#saved-calculations"><Icon name="file" size={18}/>Saved work</a><Link href="/tools"><Icon name="calculator" size={18}/>Calculators</Link><a href="#membership"><Icon name="wallet" size={18}/>Membership</a></nav><div className="sidebar-plan"><Icon name={advanced?'spark':'shield'} size={24}/><h3>{advanced?'Make room for what’s next.':'A little more clarity.'}</h3><p>{advanced?'Your ideas, saved. Your scenarios, compared. Your next step, a little clearer.':'Keep your calculations and explore the what-ifs with Advanced.'}</p><Link className="text-link" href={advanced?'/tools':'/pricing'}>{advanced?'Explore your tools':'Explore Advanced'} →</Link></div></aside>
 <div className="workspace-main"><div className="workspace-heading"><div><p className="eyebrow">Your workspace</p><h1>A clearer view.</h1><p>Signed in as {user.email}</p></div><Link className="button" href="/tools"><Icon name="plus" size={17}/>New calculation</Link></div>
 <WorkspaceSections/><AppearanceSettings/>
 {!advanced&&!subscriptionError&&<MembershipCheck/>}
 {subscriptionError&&<div className="notice" role="alert">Your plan could not be checked. Try again later.</div>}
 <div className="workspace-stats"><div className="workspace-stat"><div className="stat-top">Saved calculations<Icon name="file"/></div><strong>{recordsError?'Unavailable':count??rows?.length??0}</strong><span>Your ideas, ready to revisit</span></div><div className="workspace-stat plan-stat"><div className="stat-top">Your membership<Icon name="spark"/></div><strong>{subscriptionError?'Unavailable':advanced?'Advanced':'Free plan'}</strong><span>{advanced?'Save, compare & download':'Free calculators & guides'}</span></div><div className="workspace-stat"><div className="stat-top">{advanced?'Paid access until':'Ready to explore'}<Icon name={advanced?'clock':'calculator'}/></div><strong style={{fontSize:advanced?'19px':undefined}}>{advanced?paidUntil:tools.length}</strong><span>{advanced?'Manage renewal in Shopify':'Free calculator previews'}</span></div></div>
 <div id="saved-calculations">{recordsError?<p role="alert">Saved calculations could not be loaded. Please try again.</p>:<SavedCalculations rows={rows??[]} advanced={advanced}/>}</div><nav className="saved-pagination" aria-label="Saved calculation pages">{page>0&&<Link className="text-link" href={`/account?page=${page-1}`}>← Previous saved results</Link>}{(page+1)*50<(count??0)&&<Link className="text-link" href={`/account?page=${page+1}`}>More saved results →</Link>}</nav>
 <section className="membership-panel" id="membership"><p className="eyebrow">Your membership</p><h2>{advanced?'A little more room to plan.':'Go further with Advanced.'}</h2><p>{advanced?`Your Advanced access runs until ${paidUntil}. Save named calculations, compare scenarios and download your reports. Manage or cancel renewal in Shopify; your paid access continues until the period ends unless refunded.`:'For £1.99/month, give your calculations a home. Save your figures, compare two scenarios and download reports whenever you need them.'}</p><BillingActions available={checkoutAvailable} advanced={advanced} hasHistory={Boolean(subscription?.billing_customer_id?.startsWith('shopify:'))}/><Link className="text-link" href="/pricing">Plan details →</Link>{!advanced&&<RecoverPayment/>}</section><div className="workspace-account-footer"><p><Icon name="shield" size={14}/>Your saved figures are private to your account.</p><form action={signOut}><button className="button secondary" type="submit"><Icon name="logout" size={15}/>Sign out</button></form></div>
 </div></div>;
}
