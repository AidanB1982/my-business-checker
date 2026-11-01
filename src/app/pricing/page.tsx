import Link from 'next/link';
import { billingAvailable } from '@/lib/shopify/config';
import { BillingActions } from '@/components/billing-actions';
import { isSupabaseConfigured } from '@/lib/config';
import { createClient } from '@/lib/supabase/server';
import { hasAdvanced } from '@/lib/entitlements';
export const metadata={title:'Free and Advanced plans'};
export default async function Pricing(){
 const available=billingAvailable();let advanced=false,history=false;
 if(isSupabaseConfigured()){try{
  const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();
  if(user){const {data:plan,error}=await supabase.from('subscriptions').select('status,current_period_end,billing_customer_id').eq('user_id',user.id).maybeSingle();if(!error){advanced=hasAdvanced(plan);history=Boolean(plan?.billing_customer_id?.startsWith('shopify:'));}}
 }catch{ /* Pricing remains available; the checkout API rechecks the session and plan. */ }}
 return <div className="wrap section"><p className="eyebrow">Simple tools. Simple pricing.</p><h1>Start free.<br/>Go further when you need to.</h1><p className="lead">The core answers stay free. Advanced adds ways to save, compare and plan.</p><div className="plans"><section className="plan"><span className="tag">Everyday clarity</span><h2>Free</h2><p className="price">£0</p><ul><li>Seven free calculator previews</li><li>Results, calculation breakdowns and assumptions</li><li>Guides and official source links</li><li>No account required to calculate</li></ul><Link className="button" href="/tools">Explore free tools →</Link></section><section className="plan highlighted"><span className="tag">Monthly membership</span><h2>Advanced</h2><p className="price">£1.99 <span>/ month</span></p><ul><li>Save and revisit named calculations</li><li>Compare two saved scenarios side by side</li><li>Download reports and CSV data</li><li>Compare results across supported tax years</li></ul><p>{available?'Subscribe securely through Shopify. Manage or cancel renewal through your Shopify customer account. Access continues to the end of your paid period unless it is refunded.':'Shopify checkout is being configured. You will not be charged from this app.'}</p><BillingActions available={available} advanced={advanced} hasHistory={history} returnTo="/pricing"/></section></div></div>;
}
