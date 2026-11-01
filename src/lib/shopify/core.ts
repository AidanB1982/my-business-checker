import { createHmac,timingSafeEqual,createHash } from 'node:crypto';
import { z } from 'zod';
export const MEMBERSHIP_PRICE_PENCE=199;
export function validShopifySignature(raw:string,signature:string|null,secret:string){
 if(!signature||!secret||!/^[A-Za-z0-9+/]{43}=$/.test(signature))return false;
 const received=Buffer.from(signature,'base64'),expected=createHmac('sha256',secret).update(raw,'utf8').digest();
 return received.length===expected.length&&timingSafeEqual(received,expected);
}
export const checkoutHash=(token:string)=>createHash('sha256').update(token).digest('hex');
export function addCalendarMonth(iso:string){
 const date=new Date(iso);if(!Number.isFinite(date.getTime()))throw new Error('Invalid paid date.');
 const day=date.getUTCDate();date.setUTCDate(1);date.setUTCMonth(date.getUTCMonth()+1);
 const last=new Date(Date.UTC(date.getUTCFullYear(),date.getUTCMonth()+1,0)).getUTCDate();date.setUTCDate(Math.min(day,last));return date.toISOString();
}
const id=z.union([z.string().regex(/^\d+$/),z.number().int().positive().max(Number.MAX_SAFE_INTEGER)]).transform(String);
const amount=z.string().regex(/^\d+(\.\d{1,2})?$/).transform(value=>Math.round(Number(value)*100));
export const paidOrderSchema=z.object({id,financial_status:z.literal('paid'),currency:z.literal('GBP'),taxes_included:z.boolean().default(false),test:z.boolean().default(false),updated_at:z.iso.datetime({offset:true}),customer:z.object({id}).passthrough(),note_attributes:z.array(z.object({name:z.string(),value:z.string()})).default([]),line_items:z.array(z.object({id,variant_id:id.nullable(),quantity:z.number().int().min(1),requires_shipping:z.literal(false).default(false),price:amount,tax_lines:z.array(z.object({price:amount}).passthrough()).default([]),discount_allocations:z.array(z.object({amount}).passthrough()).default([])}).passthrough()).min(1)}).passthrough();
export function membershipOrder(raw:unknown,variantId:string,allowTest:boolean){
 const order=paidOrderSchema.parse(raw);if(order.test&&!allowTest)throw new Error('Test orders are disabled.');
 const lines=order.line_items.filter(line=>line.variant_id===variantId);if(lines.length!==1||lines[0].quantity!==1)throw new Error('Order must contain exactly one membership unit.');
 const line=lines[0];const tax=order.taxes_included?0:line.tax_lines.reduce((sum,item)=>sum+item.price,0);const net=line.price+tax-line.discount_allocations.reduce((sum,item)=>sum+item.amount,0);if(net!==MEMBERSHIP_PRICE_PENCE)throw new Error('Membership must be paid at £1.99 GBP with no discount.');
 const token=order.note_attributes.find(item=>item.name==='mbc_checkout')?.value;
 if(token&&!/^[a-f0-9]{64}$/.test(token))throw new Error('Invalid account link.');
 return {orderId:order.id,customerId:order.customer.id,lineItemId:line.id,paidAt:order.updated_at,periodEnd:addCalendarMonth(order.updated_at),tokenHash:token?checkoutHash(token):null};
}
export const refundSchema=z.object({order_id:id,refund_line_items:z.array(z.object({line_item_id:id,quantity:z.number().int().positive()}).passthrough()).default([])}).passthrough();
export const cancelledOrderSchema=z.object({id}).passthrough();
