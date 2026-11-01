import Link from 'next/link';
import { tools } from '@/content/tools';
import { Icon } from '@/components/ui-icon';
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
 return <div className="wrap section"><div className="pricing-heading"><p className="eyebrow">Good tools. A little more possibility.</p><h1>Clarity comes free.<br/>Your plans can go further.</h1><p className="lead">Use every calculator for free. When you’re ready to keep your work and compare the what-ifs, make room for Advanced.</p></div><div className="plans"><section className="plan"><span className="tag">Everyday clarity</span><h2>Free</h2><p className="price">£0</p><p>For the answers you need today.</p><ul>{[`${tools.length} free calculators and working areas`,'Results, calculation breakdowns and assumptions','Guides and official source links','No account required to calculate'].map(text=><li key={text}><Icon name="check" size={16}/>{text}</li>)}</ul><Link className="button secondary" href="/tools">Explore free tools<Icon name="arrow" size={16}/></Link></section><section className="plan highlighted"><span className="plan-ribbon">A home for your plans</span><span className="tag"><Icon name="spark" size={12}/>Monthly membership</span><h2>Advanced</h2><p className="price">£1.99 <span>/ month</span></p><p>For the decisions you want to think through.</p><ul>{['Save and revisit named calculations','Compare two saved scenarios side by side','Download reports and CSV data','Compare results across supported tax years','In-depth sole-trader and landlord reading'].map(text=><li key={text}><Icon name="check" size={16}/>{text}</li>)}</ul><p>{available?'Subscribe securely through Shopify. Manage or cancel renewal through your Shopify customer account. Access continues to the end of your paid period unless it is refunded.':'Shopify checkout is being configured. You will not be charged from this app.'}</p><BillingActions available={available} advanced={advanced} hasHistory={history} returnTo="/pricing"/></section></div><p className="pricing-footnote"><Icon name="shield" size={15}/> Your calculations stay in your browser until you choose to save them. Clear assumptions and source references come with every tool.</p></div>;
}
