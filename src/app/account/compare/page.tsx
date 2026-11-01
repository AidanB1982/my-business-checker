import Link from 'next/link';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/config';
import { hasAdvanced } from '@/lib/entitlements';
import { snapshotSchema,formatMetric } from '@/lib/reports/calculations';
export const metadata={title:'Compare saved scenarios',robots:{index:false,follow:false}};
export default async function Compare({searchParams}:{searchParams:Promise<{id?:string|string[]}>}){
 if(!isSupabaseConfigured())redirect('/sign-in');const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/sign-in');
 const {data:plan,error:planError}=await supabase.from('subscriptions').select('status,current_period_end').eq('user_id',user.id).maybeSingle();
 if(planError||!hasAdvanced(plan))return <div className="wrap section"><h1>Compare with Advanced.</h1><p>An active Advanced plan is required.</p><Link href="/account">Back to account</Link></div>;
 const {id}=await searchParams;const ids=z.array(z.uuid()).length(2).refine(values=>new Set(values).size===2).safeParse(Array.isArray(id)?id:[]);
 if(!ids.success)return <div className="wrap section"><h1>Choose two scenarios.</h1><Link href="/account">Select two saved calculations in your account.</Link></div>;
 const {data:rows,error}=await supabase.from('saved_calculations').select('id,title,tool_slug,tax_year,rule_set_version,result').eq('user_id',user.id).in('id',ids.data);
 if(error||rows?.length!==2)return <div className="wrap section"><h1>Those calculations could not be loaded.</h1><Link href="/account">Back to account</Link></div>;
 const ordered=ids.data.map(id=>rows.find(row=>row.id===id)!);const left=snapshotSchema.safeParse(ordered[0].result),right=snapshotSchema.safeParse(ordered[1].result);
 if(!left.success||!right.success||ordered[0].tool_slug!==ordered[1].tool_slug)return <div className="wrap section"><h1>Choose matching tools.</h1><p>Compare two supported calculations from the same tool. Different tax years are allowed and are shown explicitly.</p><Link href="/account">Back to account</Link></div>;
 return <div className="wrap section"><Link href="/account" className="text-link">← Your account</Link><h1>See the difference.</h1><p>{left.data.title}. Differences are right-hand scenario minus left-hand scenario.</p><div className="table-scroll"><table><thead><tr><th>Measure</th>{ordered.map(row=><th key={row.id}>{row.title}<br/>{row.tax_year} · {row.rule_set_version}</th>)}<th>Difference</th></tr></thead><tbody>{left.data.metrics.map(metric=>{const other=right.data.metrics.find(item=>item.key===metric.key&&item.unit===metric.unit);if(!other)return null;const diff=typeof metric.value==='number'&&typeof other.value==='number'?formatMetric({...metric,value:other.value-metric.value}):'Not applicable';return <tr key={metric.key}><th>{metric.label}</th><td>{formatMetric(metric)}</td><td>{formatMetric(other)}</td><td>{diff}</td></tr>;})}</tbody></table></div><div className="notice"><p>{left.data.review}</p><p>{right.data.review}</p><p>Changing a tax year or inputs may change eligibility and assumptions. Review each saved report before acting.</p></div></div>;
}
