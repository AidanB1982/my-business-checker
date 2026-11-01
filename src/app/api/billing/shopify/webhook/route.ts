import { NextResponse } from 'next/server';
import { createAdmin } from '@/lib/supabase/admin';
import { shopifyConfig } from '@/lib/shopify/config';
import { validShopifySignature,membershipOrder,refundSchema,cancelledOrderSchema } from '@/lib/shopify/core';
export const runtime='nodejs';
export async function POST(request:Request){
 const config=shopifyConfig();if(!config.secret||!config.variant||!process.env.SUPABASE_SERVICE_ROLE_KEY)return NextResponse.json({error:'Webhook is not configured.'},{status:503});
 const raw=await request.text();if(Buffer.byteLength(raw,'utf8')>512*1024)return NextResponse.json({error:'Payload too large.'},{status:413});
 if(request.headers.get('x-shopify-shop-domain')!==config.store||!validShopifySignature(raw,request.headers.get('x-shopify-hmac-sha256'),config.secret))return NextResponse.json({error:'Invalid webhook signature.'},{status:401});
 const topic=request.headers.get('x-shopify-topic');if(!['orders/paid','refunds/create','orders/cancelled'].includes(topic??''))return NextResponse.json({ignored:true});
 try{
  const payload=JSON.parse(raw);const admin=createAdmin();
  if(topic==='orders/paid'){
   // Confirm the product is subscription-only and monthly before enabling ready.
   if(!Array.isArray(payload.line_items)||!payload.line_items.some((line:{variant_id?:unknown})=>String(line.variant_id)===config.variant))return NextResponse.json({ignored:true});
   if(!config.ready)return NextResponse.json({error:'Subscription product not confirmed.'},{status:503});
   const parsed=membershipOrder(payload,config.variant,config.allowTest);
   const {error}=await admin.rpc('apply_shopify_membership_payment',{p_shop:config.store,p_order:parsed.orderId,p_customer:parsed.customerId,p_line:parsed.lineItemId,p_paid_at:parsed.paidAt,p_period_end:parsed.periodEnd,p_token_hash:parsed.tokenHash,p_variant:config.variant});
   if(error)return NextResponse.json({error:'Membership update could not be applied.'},{status:503});
  }else{
   const eventId=request.headers.get('x-shopify-webhook-id');if(!eventId||eventId.length>200)return NextResponse.json({error:'Missing webhook identity.'},{status:400});
   const refund=topic==='refunds/create'?refundSchema.parse(payload):null;const orderId=refund?refund.order_id:cancelledOrderSchema.parse(payload).id;
   const {error}=await admin.rpc('reverse_shopify_membership_payment',{p_shop:config.store,p_order:orderId,p_event:eventId,p_lines:refund?refund.refund_line_items.map(item=>item.line_item_id):[],p_complete:topic==='orders/cancelled'});
   if(error)return NextResponse.json({error:'Membership reversal could not be applied.'},{status:503});
  }
  return NextResponse.json({received:true});
 }catch{return NextResponse.json({error:'Unsupported membership webhook. No access was granted.'},{status:422});}
}
