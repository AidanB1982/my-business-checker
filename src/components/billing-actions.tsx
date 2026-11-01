"use client";
import { useEffect,useRef,useState } from 'react';
import { useRouter } from 'next/navigation';
export function BillingActions({available,advanced,hasHistory=false,returnTo='/account'}:{available:boolean;advanced:boolean;hasHistory?:boolean;returnTo?:'/pricing'|'/account'}){
 const router=useRouter();
 const popup=useRef<Window|null>(null);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[checkoutUrl,setCheckoutUrl]=useState('');
 useEffect(()=>{
  if(!checkoutUrl)return;
  let disposed=false,timer:ReturnType<typeof setTimeout>|undefined;
  const controller=new AbortController();const deadline=Date.now()+20*60*1000;
  async function check(){
   try{
    const response=await fetch('/api/billing/status',{cache:'no-store',signal:controller.signal});
    if(disposed)return;
    if(response.status===401){setCheckoutUrl('');setMessage('Sign in again to check your payment.');return;}
    if(response.ok&&(await response.json()).advanced===true){
     if(disposed)return;
     popup.current?.close();setCheckoutUrl('');setBusy(false);router.replace('/account');router.refresh();return;
    }
   }catch{/* A temporary connection failure must not be treated as payment confirmation. */}
   if(disposed)return;
   if(Date.now()>=deadline){setCheckoutUrl('');setBusy(false);setMessage('Payment confirmation is taking longer than expected. Check your account before starting another subscription.');return;}
   timer=setTimeout(check,3000);
  }
  void check();
  return ()=>{disposed=true;controller.abort();if(timer)clearTimeout(timer);};
 },[checkoutUrl,router]);
 if(advanced||hasHistory)return <p><a className="button secondary" href="https://blackwoodpublishing.myshopify.com/account" target="_blank" rel="noopener noreferrer">Manage or cancel in Shopify →</a></p>;
 return <><button className="button" disabled={!available||busy||Boolean(checkoutUrl)} onClick={async()=>{
  setBusy(true);setMessage('');
  // Open during the click so browsers can allow the checkout window. Retain the window
  // relationship so the app can close it; checkout URLs are allowlisted by the server.
  popup.current=window.open('about:blank','_blank');
  if(popup.current){popup.current.document.title='Opening secure checkout';popup.current.document.body.textContent='Opening Shopify checkout…';}
  try{const response=await fetch('/api/billing/checkout',{method:'POST'});const body=await response.json();
   if(response.status===401){popup.current?.close();setBusy(false);router.push(`/sign-in?next=${encodeURIComponent(returnTo)}`);return;}
   if(!response.ok)throw new Error(body.error);
   if(popup.current&&!popup.current.closed)popup.current.location.replace(body.url);
   setCheckoutUrl(body.url);setBusy(false);setMessage('Complete payment in Shopify. This page will open your Advanced account and close the checkout window once payment is confirmed.');
  }catch(error){popup.current?.close();setMessage(error instanceof Error?error.message:'Checkout could not be opened.');setBusy(false);}
 }}>{busy?'Opening Shopify…':checkoutUrl?'Waiting for payment confirmation…':'Subscribe for £1.99/month'}</button>{!available&&<p className="fine">Checkout is being configured. Please try again later.</p>}{message&&<p role="status">{message}</p>}{checkoutUrl&&<p><a href={checkoutUrl} target="_blank" rel="noopener noreferrer" onClick={event=>{event.preventDefault();const opened=window.open('about:blank','_blank');if(opened){popup.current=opened;opened.location.replace(checkoutUrl);}}}>Open Shopify checkout →</a> <a href="/account">Check your account →</a></p>}</>;
}
