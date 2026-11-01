"use client";
import { useState } from 'react';
export function BillingActions({available,advanced,hasHistory=false}:{available:boolean;advanced:boolean;hasHistory?:boolean}){
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 if(advanced||hasHistory)return <p><a className="button secondary" href="https://blackwoodpublishing.myshopify.com/account" target="_blank" rel="noopener noreferrer">Manage or cancel in Shopify →</a></p>;
 return <><button className="button" disabled={!available||busy} onClick={async()=>{setBusy(true);setMessage('');try{const response=await fetch('/api/billing/checkout',{method:'POST'});const body=await response.json();if(!response.ok)throw new Error(body.error);window.location.assign(body.url);}catch(error){setMessage(error instanceof Error?error.message:'Checkout could not be opened.');setBusy(false);}}}>{busy?'Opening Shopify…':available?'Subscribe — £1.99/month':'Shopify checkout not enabled yet'}</button>{message&&<p role="status">{message}</p>}</>;
}
