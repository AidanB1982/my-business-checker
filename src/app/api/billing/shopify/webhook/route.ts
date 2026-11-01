import { ZodError } from 'zod';
import { webhookDatabaseCode } from '@/lib/shopify/webhook-errors';
import { NextResponse } from 'next/server';
import { createAdmin } from '@/lib/supabase/admin';
import { shopifyConfig } from '@/lib/shopify/config';
import { validShopifySignature,membershipOrder,MembershipOrderError,refundSchema,cancelledOrderSchema } from '@/lib/shopify/core';
export const runtime='nodejs';
function failure(code:string,status:number,details?:{expectedShop:string;receivedShop:string}){
 // Codes only: never log webhook bodies, signatures, tokens, customer details or provider messages.
 console.error(JSON.stringify({event:'shopify_membership_webhook',code,status,...details}));
 return NextResponse.json({error:`Membership webhook failed [${code}]. No new access was granted.`},{status});
}
export async function POST(request:Request){
 const config=shopifyConfig();if(!config.secret||!config.variant||!process.env.SUPABASE_SERVICE_ROLE_KEY)return failure('WH_CONFIG',503);
 const raw=await request.text();if(Buffer.byteLength(raw,'utf8')>512*1024)return failure('WH_PAYLOAD_SIZE',413);
 if(!validShopifySignature(raw,request.headers.get('x-shopify-hmac-sha256'),config.secret))return failure('WH_SIGNATURE',401);
 // Diagnose domain aliases only for signature-verified requests, and log domain-shaped values only.
 const expectedShop=config.webhookShop??config.store;
 const receivedShop=request.headers.get('x-shopify-shop-domain')?.trim().toLowerCase()??'';
 if(!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(expectedShop))return failure('WH_CONFIG',503);
 if(receivedShop!==expectedShop)return failure('WH_SHOP',401,{expectedShop,receivedShop:/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(receivedShop)?receivedShop:'missing-or-invalid'});
 const topic=request.headers.get('x-shopify-topic');if(!['orders/paid','refunds/create','orders/cancelled'].includes(topic??'')){console.info(JSON.stringify({event:'shopify_membership_webhook',code:'WH_TOPIC_IGNORED'}));return NextResponse.json({ignored:true});}
 try{
  const payload=JSON.parse(raw);const admin=createAdmin();
  if(topic==='orders/paid'){
   // Confirm the product is subscription-only and monthly before enabling ready.
   if(!Array.isArray(payload.line_items))return failure('WH_ORDER_FORMAT',422);
   if(!payload.line_items.some((line:{variant_id?:unknown}|null)=>String(line?.variant_id)===config.variant)){console.info(JSON.stringify({event:'shopify_membership_webhook',code:'WH_VARIANT_IGNORED'}));return NextResponse.json({ignored:true});}
   if(!config.ready)return failure('WH_NOT_READY',503);
   const parsed=membershipOrder(payload,config.variant,config.allowTest);
   const {error}=await admin.rpc('apply_shopify_membership_payment',{p_shop:config.store,p_order:parsed.orderId,p_customer:parsed.customerId,p_line:parsed.lineItemId,p_paid_at:parsed.paidAt,p_period_end:parsed.periodEnd,p_token_hash:parsed.tokenHash,p_variant:config.variant});
   if(error)return failure(webhookDatabaseCode(error),503);
  }else{
   const eventId=request.headers.get('x-shopify-webhook-id');if(!eventId||eventId.length>200)return failure('WH_EVENT_ID',400);
   const refund=topic==='refunds/create'?refundSchema.parse(payload):null;const orderId=refund?refund.order_id:cancelledOrderSchema.parse(payload).id;
   const {error}=await admin.rpc('reverse_shopify_membership_payment',{p_shop:config.store,p_order:orderId,p_event:eventId,p_lines:refund?refund.refund_line_items.map(item=>item.line_item_id):[],p_complete:topic==='orders/cancelled'});
   if(error)return failure(webhookDatabaseCode(error),503);
  }
  console.info(JSON.stringify({event:'shopify_membership_webhook',code:'WH_RECEIVED',topic}));
  return NextResponse.json({received:true});
 }catch(error){
  if(error instanceof MembershipOrderError)return failure(error.code,422);
  if(error instanceof ZodError)return failure('WH_ORDER_FORMAT',422);
  if(error instanceof SyntaxError)return failure('WH_JSON',400);
  return failure('WH_INTERNAL',503);
 }
}
