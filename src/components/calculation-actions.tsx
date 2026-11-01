"use client";
import { useState } from 'react';
import Link from 'next/link';
import { buildSnapshot,type CalculationDraft } from '@/lib/reports/calculations';
export function CalculationActions({calculation}:{calculation:CalculationDraft}){
 const [message,setMessage]=useState('');const [busy,setBusy]=useState(false);
 return <section className="notice"><h2>Keep this calculation</h2><p>Advanced (£1.99/month) lets you save figures to your account, compare saved scenarios and download reports. Saving sends these figures to your account; ordinary calculations stay local.</p><form onSubmit={async event=>{
  event.preventDefault();setMessage('');setBusy(true);const data=new FormData(event.currentTarget);
  try{const snapshot=buildSnapshot(calculation);const response=await fetch('/api/calculations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({title:data.get('title'),calculation,expectedRuleSetVersion:snapshot.ruleSetVersion,consent:data.has('consent')})});const result=await response.json();setMessage(response.ok?'Saved. Open your account to compare or download the report.':result.error||'Could not save.');}catch{setMessage('Could not save. Check your connection and try again.');}finally{setBusy(false);}
 }}><label htmlFor={`save-title-${calculation.toolSlug}`}>Calculation name</label><input id={`save-title-${calculation.toolSlug}`} name="title" maxLength={150} required placeholder="For example: next year’s plan"/><label className="check-field"><input type="checkbox" name="consent" required/>Save these financial figures securely to my account.</label><button className="button" disabled={busy} type="submit">{busy?'Saving…':'Save to my account'}</button></form>{message&&<p role="status">{message}</p>}<p><Link className="text-link" href="/account">Your account →</Link> · <Link className="text-link" href="/pricing">Advanced plan details →</Link></p></section>;
}
