'use client';
import Link from 'next/link';
import { useEffect,useState } from 'react';
import { usagePreferenceKey,usagePreferenceEvent } from '@/lib/usage';
export function UsagePreferences() {
 const [enabled,setEnabled] = useState(false),[message,setMessage] = useState(''),[busy,setBusy] = useState(false);
 useEffect(() => {const sync=()=>{try{setEnabled(localStorage.getItem(usagePreferenceKey)==='yes');}catch{}};sync();window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync);},[]);
 function choose(value:boolean) {
  try{localStorage.setItem(usagePreferenceKey,value?'yes':'no');setEnabled(value);window.dispatchEvent(new Event(usagePreferenceEvent));setMessage(value?'Optional usage sharing enabled on this browser.':'Optional usage sharing is off on this browser.');}
  catch{setMessage('Your browser could not save this choice. Please check browser storage settings and try again.');}
 }
 async function clearHistory() {
  choose(false);setBusy(true);
  try{const r=await fetch('/api/usage',{method:'DELETE'});if(!r.ok)throw new Error();setMessage('Your recorded usage history has been deleted.');}
  catch{setMessage('Could not delete usage history. Please try again.');}finally{setBusy(false);}
 }
 return <details className="appearance-settings"><summary>Optional usage sharing</summary><div className="appearance-options"><p>Help improve the app by sharing which sections and tools you visit while signed in. We record your account identifier, the day and a fixed page label, once per day and page. We never include financial inputs, results or invoice details. The owner sees totals only.</p><label className="usage-toggle"><input type="checkbox" checked={enabled} disabled={busy} onChange={e=>choose(e.target.checked)}/>Share my app usage on this browser</label><p>Off by default. You can stop at any time. Reports cover up to 90 days. Older records are removed when new usage is recorded; deleting history removes your records across your account. Your books, calculations and membership are unaffected.</p><button type="button" className="button secondary" disabled={busy} onClick={clearHistory}>{busy?'Deleting…':'Delete my usage history'}</button><p role="status">{message}</p><Link className="text-link" href="/privacy">Privacy details →</Link></div></details>;
}
