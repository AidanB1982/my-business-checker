import { NextResponse } from 'next/server';
import { authenticated,checkOrigin,ApiError,apiError } from '@/lib/api';
import { createAdmin } from '@/lib/supabase/admin';
import { billingAvailable,shopifyConfig } from '@/lib/shopify/config';
import { hasAdvanced } from '@/lib/entitlements';
import { readLinkedPaidOrders } from '@/lib/shopify/recover-order';
import { webhookDatabaseCode } from '@/lib/shopify/webhook-errors';
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'private, no-store'}});
export async function POST(request:Request){try{
 checkOrigin(request);const {supabase,user}=await authenticated();
 async function status(){const {data,error}=await supabase.from('subscriptions').select('status,current_period_end').eq('user_id',user.id).maybeSingle();if(error)throw new ApiError(503,'Your membership could not be checked.');return hasAdvanced(data);}
 if(await status())return json({advanced:true,state:'confirmed'});
 if(!billingAvailable())throw new ApiError(503,'Automatic membership verification is unavailable while billing is being configured [REC_CONFIG].');
 const admin=createAdmin(),config=shopifyConfig(),now=new Date();
 const {data:paid,error:paidError}=await admin.from('shopify_membership_orders').select('order_id').eq('user_id',user.id).eq('refunded',false).gt('period_end',now.toISOString()).limit(1);
 if(paidError)throw new ApiError(503,'Verified payment records could not be checked [REC_DATABASE].');
 if(paid?.length){const {error}=await admin.rpc('refresh_shopify_membership',{p_user:user.id});if(error)throw new ApiError(503,'Your verified membership could not be refreshed [REC_DATABASE].');return json({advanced:await status(),state:'checked'});}
 const {data:claim,error:claimError}=await admin.rpc('claim_shopify_membership_check',{p_user:user.id});
 if(claimError)throw new ApiError(503,'Automatic membership checks need their database setup [REC_AUTO_SETUP].');
 if(!claim)return json({advanced:await status(),state:'cooldown',retryAfter:60});
 const since=new Date(now.getTime()-35*86400000).toISOString();
 const [checkouts,mapping]=await Promise.all([
  admin.from('shopify_checkout_links').select('token_hash,redeemed_order_id,created_at').eq('user_id',user.id).gte('created_at',since).order('created_at',{ascending:false}).limit(21),
  admin.from('shopify_membership_customers').select('customer_id').eq('user_id',user.id).eq('shop_domain',config.store).limit(11),
 ]);
 if(checkouts.error||mapping.error)throw new ApiError(503,'Your checkout links could not be checked [REC_DATABASE].');
 const links=checkouts.data??[],customers=(mapping.data??[]).map(m=>m.customer_id as string);
 if(links.length>20||customers.length>10)throw new ApiError(503,'More checkout history needs verification. Use the existing-payment check or contact support [REC_AUTO_LIMIT].');
 if(!links.length&&!customers.length)return json({advanced:false,state:'no-linked-checkout'});
 const orders=await readLinkedPaidOrders(config,links,customers,since,fetch,now);
 for(const order of orders){const {error}=await admin.rpc('apply_shopify_membership_payment',{p_shop:config.store,p_order:order.orderId,p_customer:order.customerId,p_line:order.lineItemId,p_paid_at:order.paidAt,p_period_end:order.periodEnd,p_token_hash:order.tokenHash,p_variant:config.variant});if(error)throw new ApiError(503,`Payment verification could not be completed [${webhookDatabaseCode(error)}].`);}
 if(orders.length){const {error}=await admin.rpc('refresh_shopify_membership',{p_user:user.id});if(error)throw new ApiError(503,'Your membership could not be refreshed [REC_DATABASE].');}
 return json({advanced:await status(),state:orders.length?'checked':'not-confirmed'});
}catch(error){return apiError(error);}}
