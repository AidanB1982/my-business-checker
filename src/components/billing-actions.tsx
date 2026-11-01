"use client";
import { useState } from 'react';
import { useRouter } from 'next/navigation';
export function BillingActions({available,advanced,hasHistory=false,returnTo='/account'}:{available:boolean;advanced:boolean;hasHistory?:boolean;returnTo?:'/pricing'|'/account'}){
 const router=useRouter();
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 if(advanced||hasHistory)return <p><a className="button secondary" href="https://blackwoodpublishing.myshopify.com/account" target="_blank" rel="noopener noreferrer">Manage or cancel in Shopify →</a></p>;
 return <><button className="button" disabled={!available||busy} onClick={async()=>{
  setBusy(true);setMessage('');
  try{const response=await fetch('/api/billing/checkout',{method:'POST'});const body=await response.json();
   if(response.status===401){setBusy(false);router.push(`/sign-in?next=${encodeURIComponent(returnTo)}`);return;}
   if(!response.ok)throw new Error(body.error);setBusy(false);window.location.assign(body.url);
  }catch(error){setMessage(error instanceof Error?error.message:'Checkout could not be opened.');setBusy(false);}
 }}>{busy?'Opening Shopify…':'Subscribe for £1.99/month'}</button>{!available&&<p className="fine">Checkout is being configured. Please try again later.</p>}{message&&<p role="status">{message}</p>}</>;
}
