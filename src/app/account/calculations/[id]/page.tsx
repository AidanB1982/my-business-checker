import { CalculationCharts } from '@/components/calculation-charts';
import Link from 'next/link';
import { notFound,redirect } from 'next/navigation';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/config';
import { snapshotSchema,formatMetric } from '@/lib/reports/calculations';
export const metadata={title:'Saved calculation',robots:{index:false,follow:false}};
export default async function SavedCalculation({params}:{params:Promise<{id:string}>}){
 if(!isSupabaseConfigured())redirect('/sign-in');const {id}=await params;if(!z.uuid().safeParse(id).success)notFound();
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/sign-in');
 const {data:row,error}=await supabase.from('saved_calculations').select('title,result,inputs,created_at').eq('id',id).eq('user_id',user.id).maybeSingle();
 if(error)return <div className="wrap section"><h1>This calculation could not be loaded.</h1><Link href="/account">Back to account</Link></div>;if(!row)notFound();
 const parsed=snapshotSchema.safeParse(row.result);if(!parsed.success)return <div className="wrap section"><h1>This saved format needs updating.</h1><p>The record remains in your account and can be deleted there.</p><Link href="/account">Back to account</Link></div>;
 const snapshot=parsed.data;
 return <article className="wrap section"><Link href="/account" className="text-link">← Your account</Link><p className="eyebrow">Saved snapshot</p><h1>{row.title}</h1><p>{snapshot.title} · {snapshot.taxYear} · {snapshot.ruleSetVersion}</p><p className="fine">Saved {new Date(row.created_at).toLocaleString('en-GB',{timeZone:'UTC'})} UTC. These figures are preserved; later rule updates do not silently recalculate them.</p><div className="notice">{snapshot.review}</div><CalculationCharts snapshot={snapshot}/><div className="table-scroll"><table><thead><tr><th>Measure</th><th>Estimate</th></tr></thead><tbody>{snapshot.metrics.map(metric=><tr key={metric.key}><th>{metric.label}</th><td>{formatMetric(metric)}</td></tr>)}</tbody></table></div><p><a className="text-link" href={`/api/calculations/${id}/report`}>Download report (print to PDF)</a> · <a className="text-link" href={`/api/calculations/${id}/report?format=csv`}>Download CSV</a></p><h2>Saved inputs</h2><pre className="saved-inputs">{JSON.stringify(row.inputs,null,2)}</pre><h2>Assumptions</h2><ul>{snapshot.assumptions.map(text=><li key={text}>{text}</li>)}</ul><h2>Sources</h2><ul>{snapshot.sources.map(source=><li key={source.url}>{source.label}: {source.url}</li>)}</ul><Link className="button" href={`/tools/${snapshot.toolSlug}`}>Make a new calculation →</Link></article>;
}
