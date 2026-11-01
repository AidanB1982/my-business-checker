import { NextResponse } from 'next/server';
import { authenticated,checkOrigin,readJson,ApiError,apiError } from '@/lib/api';
import { createAdmin } from '@/lib/supabase/admin';
import { shopifyConfig,billingAvailable } from '@/lib/shopify/config';
import { recoveryInput,readRecoverableOrder } from '@/lib/shopify/recover-order';
import { hasAdvanced } from '@/lib/entitlements';
import { webhookDatabaseCode } from '@/lib/shopify/webhook-errors';
export async function POST(request:Request){try{
 checkOrigin(request);const {supabase,user}=await authenticated();
 const input=recoveryInput.safeParse(await readJson(request));if(!input.success)throw new ApiError(400,'Enter the Shopify order number, for example #1017.');
 if(!billingAvailable())throw new ApiError(503,'Billing configuration is incomplete.');
 const config=shopifyConfig();const admin=createAdmin();
 const {data:links,error:linksError}=await admin.from('shopify_checkout_links').select('token_hash').eq('user_id',user.id).limit(1);
 if(linksError)throw new ApiError(503,'Checkout records could not be checked [REC_DATABASE].');
 if(!links?.length)throw new ApiError(422,'No checkout from this app account could be found [REC_LINK].');
 const order=await readRecoverableOrder(config,input.data.orderNumber);
 if(!order.tokenHash)throw new ApiError(422,'That paid order could not be linked to this account [REC_LINK].');
 const {data:link,error:linkError}=await admin.from('shopify_checkout_links').select('user_id,redeemed_order_id').eq('token_hash',order.tokenHash).eq('user_id',user.id).maybeSingle();
 if(linkError)throw new ApiError(503,'Checkout records could not be checked [REC_DATABASE].');
 if(!link||(link.redeemed_order_id&&link.redeemed_order_id!==order.orderId))throw new ApiError(422,'That paid order could not be linked to this account [REC_LINK].');
 const {error}=await admin.rpc('apply_shopify_membership_payment',{p_shop:config.store,p_order:order.orderId,p_customer:order.customerId,p_line:order.lineItemId,p_paid_at:order.paidAt,p_period_end:order.periodEnd,p_token_hash:order.tokenHash,p_variant:config.variant});
 if(error)throw new ApiError(503,`Paid order could not be applied [${webhookDatabaseCode(error)}].`);
 const {data:subscription,error:statusError}=await supabase.from('subscriptions').select('status,current_period_end').eq('user_id',user.id).maybeSingle();
 if(statusError)throw new ApiError(503,'Payment was checked, but your plan could not be refreshed. Check your account.');
 return NextResponse.json({advanced:hasAdvanced(subscription)},{headers:{'Cache-Control':'private, no-store'}});
}catch(error){return apiError(error);}}
