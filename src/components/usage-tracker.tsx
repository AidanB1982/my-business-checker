'use client';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { usagePage,usagePreferenceKey,usagePreferenceEvent } from '@/lib/usage';
export function UsageTracker() {
 const path=usePathname();
 useEffect(()=>{
  const page=usagePage(path);if(!page)return;
  let controller:AbortController|null=null;
  const record=()=>{
   controller?.abort();
   try{if(localStorage.getItem(usagePreferenceKey)!=='yes')return;}catch{return;}
   controller=new AbortController();
   void fetch('/api/usage',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({page,consent:true}),signal:controller.signal}).catch(()=>{});
  };
  record();window.addEventListener('storage',record);window.addEventListener(usagePreferenceEvent,record);
  // Record a new UTC day if a signed-in user returns to an already open tab.
  const visible=()=>{if(document.visibilityState==='visible')record();};document.addEventListener('visibilitychange',visible);
  return()=>{controller?.abort();window.removeEventListener('storage',record);window.removeEventListener(usagePreferenceEvent,record);document.removeEventListener('visibilitychange',visible);};
 },[path]);
 return null;
}
