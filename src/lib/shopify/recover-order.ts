import 'server-only';
import { z } from 'zod';
import { ApiError } from '@/lib/api';
import { membershipOrder } from './core';
export const recoveryInput=z.object({orderNumber:z.string().trim().regex(/^#?[A-Za-z0-9-]{1,40}$/)}).strict();
type Config={store:string;clientId?:string;clientSecret?:string;variant:string;allowTest:boolean};
const money=z.object({amount:z.string().regex(/^\d+(\.\d{1,2})?$/),currencyCode:z.literal('GBP')});
const moneySet=z.object({shopMoney:money});
const orderSchema=z.object({name:z.string(),legacyResourceId:z.string().regex(/^\d+$/),displayFinancialStatus:z.literal('PAID'),currencyCode:z.literal('GBP'),taxesIncluded:z.boolean(),test:z.boolean(),cancelledAt:z.null(),customer:z.object({legacyResourceId:z.string().regex(/^\d+$/)}),customAttributes:z.array(z.object({key:z.string(),value:z.string()})),totalPriceSet:moneySet,totalRefundedSet:moneySet,lineItems:z.object({pageInfo:z.object({hasNextPage:z.literal(false)}),nodes:z.array(z.object({id:z.string().regex(/^gid:\/\/shopify\/LineItem\/\d+$/),variant:z.object({legacyResourceId:z.string().regex(/^\d+$/)}),quantity:z.literal(1),requiresShipping:z.literal(false),originalUnitPriceSet:moneySet,taxLines:z.array(z.object({priceSet:moneySet}))})).length(1)}),transactions:z.array(z.object({kind:z.string(),status:z.string(),processedAt:z.iso.datetime({offset:true}).nullable(),amountSet:moneySet}))});
const QUERY=`query RecoverMembership($query:String!) { orders(first:2,query:$query) { nodes { name legacyResourceId displayFinancialStatus currencyCode taxesIncluded test cancelledAt customer { legacyResourceId } customAttributes { key value } totalPriceSet { shopMoney { amount currencyCode } } totalRefundedSet { shopMoney { amount currencyCode } } lineItems(first:2) { pageInfo { hasNextPage } nodes { id variant { legacyResourceId } quantity requiresShipping originalUnitPriceSet { shopMoney { amount currencyCode } } taxLines { priceSet { shopMoney { amount currencyCode } } } } } transactions(first:100) { kind status processedAt amountSet { shopMoney { amount currencyCode } } } } } }`;
export async function readRecoverableOrder(config:Config,orderNumber:string,fetcher:typeof fetch=fetch){
 if(!/^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(config.store)||!config.clientId||!config.clientSecret)throw new ApiError(503,'Order recovery needs the installed Shopify app credentials [REC_CONFIG].');
 async function call(stage:'AUTH'|'SCOPES'|'ORDER',url:string,options:RequestInit){
  let response:Response;try{response=await fetcher(url,{...options,cache:'no-store',signal:AbortSignal.timeout(15000)});}catch{throw new ApiError(502,'Shopify could not be reached [REC_NETWORK].');}
  if([401,403].includes(response.status))throw new ApiError(503,stage==='AUTH'?'Shopify rejected the integration credentials or installation [REC_AUTH_ACCESS].':`Shopify rejected the ${stage==='SCOPES'?'installed permission check':'order API request'}. Check the integration credentials and store installation [REC_${stage}_HTTP_ACCESS].`);
  if(!response.ok)throw new ApiError(502,'Shopify order lookup failed [REC_HTTP].');
  try{return await response.json();}catch{throw new ApiError(502,'Shopify returned an invalid response [REC_RESPONSE].');}
 }
 const auth=await call('AUTH',`https://${config.store}/admin/oauth/access_token`,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'client_credentials',client_id:config.clientId,client_secret:config.clientSecret}).toString()});
 if(typeof auth.access_token!=='string'||!auth.access_token)throw new ApiError(503,'Shopify app authentication failed [REC_AUTH].');
 const installed=await call('SCOPES',`https://${config.store}/admin/api/2026-10/graphql.json`,{method:'POST',headers:{'Content-Type':'application/json','X-Shopify-Access-Token':auth.access_token},body:JSON.stringify({query:'query MembershipRecoveryScopes { currentAppInstallation { accessScopes { handle } } }'})});
 if(installed.errors?.length)throw new ApiError(503,'The installed Shopify app permissions could not be checked [REC_SCOPE_CHECK].');
 const granted=z.array(z.object({handle:z.string()})).safeParse(installed.data?.currentAppInstallation?.accessScopes);
 if(!granted.success)throw new ApiError(502,'Shopify returned an invalid installed-permission response [REC_SCOPE_RESPONSE].');
 if(!granted.data.some(scope=>scope.handle==='read_orders'))throw new ApiError(503,'The installed Shopify app has not granted read_orders. Release the configured version and approve the store installation permissions [REC_SCOPE_MISSING].');
 const name=orderNumber.startsWith('#')?orderNumber:`#${orderNumber}`;
 const body=await call('ORDER',`https://${config.store}/admin/api/2026-10/graphql.json`,{method:'POST',headers:{'Content-Type':'application/json','X-Shopify-Access-Token':auth.access_token},body:JSON.stringify({query:QUERY,variables:{query:`name:${name}`}})});
 if(body.errors?.length){
  if(body.errors.some((error:{extensions?:{code?:string}})=>error.extensions?.code==='ACCESS_DENIED'))throw new ApiError(503,'The installed app has read_orders, but Shopify denied fields needed to verify the order. Check its order/customer data access permissions [REC_ORDER_DATA_ACCESS].');
  throw new ApiError(502,'Shopify order lookup could not be completed [REC_QUERY].');
 }
 const candidates=body.data?.orders?.nodes;
 if(!Array.isArray(candidates))throw new ApiError(502,'Shopify returned an invalid order response [REC_RESPONSE].');
 const matches=candidates.filter((order:{name?:string})=>order?.name===name);
 if(matches.length!==1)throw new ApiError(422,'That paid order could not be verified [REC_ORDER].');
 const parsed=orderSchema.safeParse(matches[0]);
 if(!parsed.success)throw new ApiError(422,'The order must be an unrefunded, paid £1.99 GBP digital membership [REC_ORDER].');
 const order=parsed.data;
 const payments=order.transactions.filter(tx=>tx.status==='SUCCESS'&&['SALE','CAPTURE'].includes(tx.kind));
 if(payments.length!==1||!payments[0].processedAt||Number(payments[0].amountSet.shopMoney.amount)!==1.99||Number(order.totalPriceSet.shopMoney.amount)!==1.99||Number(order.totalRefundedSet.shopMoney.amount)!==0)throw new ApiError(422,'The original successful £1.99 payment could not be verified [REC_PAYMENT].');
 const line=order.lineItems.nodes[0];
 try{return membershipOrder({id:order.legacyResourceId,financial_status:'paid',currency:order.currencyCode,taxes_included:order.taxesIncluded,test:order.test,updated_at:payments[0].processedAt,customer:{id:order.customer.legacyResourceId},note_attributes:order.customAttributes.map(item=>({name:item.key,value:item.value})),line_items:[{id:line.id.split('/').at(-1),variant_id:line.variant.legacyResourceId,quantity:line.quantity,requires_shipping:line.requiresShipping,price:line.originalUnitPriceSet.shopMoney.amount,tax_lines:line.taxLines.map(tax=>({price:tax.priceSet.shopMoney.amount}))}]},config.variant,config.allowTest);}catch{throw new ApiError(422,'That paid order does not match the configured membership [REC_MEMBERSHIP].');}
}
