import { createHmac } from 'node:crypto';
import { describe,it,expect } from 'vitest';
import { validShopifySignature,addCalendarMonth,membershipOrder,checkoutHash } from '../../src/lib/shopify/core';
const order={id:101,financial_status:'paid',currency:'GBP',updated_at:'2026-11-01T12:00:00Z',customer:{id:202},note_attributes:[{name:'mbc_checkout',value:'a'.repeat(64)}],line_items:[{id:303,variant_id:404,quantity:1,price:'1.99',discount_allocations:[]}]};
describe('Shopify verified paid periods',()=>{
 it('requires a valid signature over the exact raw body',()=>{const raw=JSON.stringify(order),secret='test-webhook-fixture';const signature=createHmac('sha256',secret).update(raw).digest('base64');expect(validShopifySignature(raw,signature,secret)).toBe(true);expect(validShopifySignature(raw+' ',signature,secret)).toBe(false);expect(validShopifySignature(raw,'forged',secret)).toBe(false);});
 it('extracts only the configured £1.99 membership and hashes the link',()=>{expect(membershipOrder(order,'404',false)).toMatchObject({orderId:'101',customerId:'202',lineItemId:'303',periodEnd:'2026-12-01T12:00:00.000Z',tokenHash:checkoutHash('a'.repeat(64))});});
 it.each([{...order,currency:'USD'},{...order,financial_status:'pending'},{...order,test:true},{...order,line_items:[{...order.line_items[0],price:'0.99'}]},{...order,line_items:[{...order.line_items[0],quantity:2}]},{...order,line_items:[{...order.line_items[0],discount_allocations:[{amount:'0.10'}]}]}])('does not grant an invalid/unpaid/discounted order',payload=>{expect(()=>membershipOrder(payload,'404',false)).toThrow();});
 it('does not accept a book variant as membership',()=>{expect(()=>membershipOrder(order,'999',false)).toThrow();});
 it('allows test orders only when deliberately enabled',()=>{expect(()=>membershipOrder({...order,test:true},'404',true)).not.toThrow();});
 it.each([['2027-01-31T12:00:00Z','2027-02-28T12:00:00.000Z'],['2028-01-31T12:00:00Z','2028-02-29T12:00:00.000Z'],['2026-12-15T12:00:00Z','2027-01-15T12:00:00.000Z']])('adds a calendar month to %s',(date,end)=>{expect(addCalendarMonth(date)).toBe(end);});
});

describe('membership price and tax validation',()=>{
 it('rejects VAT added on top of the advertised £1.99',()=>{expect(()=>membershipOrder({...order,line_items:[{...order.line_items[0],tax_lines:[{price:'0.40'}]}]},'404',false)).toThrow(/£1.99/);});
 it('accepts tax-inclusive £1.99 pricing',()=>{expect(()=>membershipOrder({...order,taxes_included:true,line_items:[{...order.line_items[0],tax_lines:[{price:'0.33'}]}]},'404',false)).not.toThrow();});
 it('rejects a physical/shipping membership product',()=>{expect(()=>membershipOrder({...order,line_items:[{...order.line_items[0],requires_shipping:true}]},'404',false)).toThrow();});
});
