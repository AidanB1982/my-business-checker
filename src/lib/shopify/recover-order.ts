import 'server-only';
import { z } from 'zod';
import { ApiError } from '@/lib/api';
import { membershipOrder,checkoutHash } from './core';
export const recoveryInput=z.object({orderNumber:z.string().trim().regex(/^#?[A-Za-z0-9-]{1,40}$/)}).strict();
type Config={store:string;clientId?:string;clientSecret?:string;variant:string;allowTest:boolean};
const money=z.object({amount:z.string().regex(/^\d+(\.\d{1,2})?$/),currencyCode:z.literal('GBP')});
const moneySet=z.object({shopMoney:money});
const orderSchema=z.object({name:z.string(),legacyResourceId:z.string().regex(/^\d+$/),displayFinancialStatus:z.literal('PAID'),currencyCode:z.literal('GBP'),taxesIncluded:z.boolean(),test:z.boolean(),cancelledAt:z.null(),customer:z.object({legacyResourceId:z.string().regex(/^\d+$/)}),customAttributes:z.array(z.object({key:z.string(),value:z.string()})),totalPriceSet:moneySet,totalRefundedSet:moneySet,lineItems:z.object({pageInfo:z.object({hasNextPage:z.literal(false)}),nodes:z.array(z.object({id:z.string().regex(/^gid:\/\/shopify\/LineItem\/\d+$/),variant:z.object({legacyResourceId:z.string().regex(/^\d+$/)}),quantity:z.literal(1),requiresShipping:z.literal(false),originalUnitPriceSet:moneySet,taxLines:z.array(z.object({priceSet:moneySet}))})).length(1)}),transactions:z.array(z.object({kind:z.string(),status:z.string(),processedAt:z.iso.datetime({offset:true}).nullable(),amountSet:moneySet}))});
const QUERY=`query RecoverMembership($query:String!) { orders(first:2,query:$query) { nodes { name legacyResourceId displayFinancialStatus currencyCode taxesIncluded test cancelledAt customer { legacyResourceId } customAttributes { key value } totalPriceSet { shopMoney { amount currencyCode } } totalRefundedSet { shopMoney { amount currencyCode } } lineItems(first:2) { pageInfo { hasNextPage } nodes { id variant { legacyResourceId } quantity requiresShipping originalUnitPriceSet { shopMoney { amount currencyCode } } taxLines { priceSet { shopMoney { amount currencyCode } } } } } transactions(first:100) { kind status processedAt amountSet { shopMoney { amount currencyCode } } } } } }`;
async function recoveryClient(config:Config,fetcher:typeof fetch){
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
 return async(query:string,variables:Record<string,unknown>)=>{
 const body=await call('ORDER',`https://${config.store}/admin/api/2026-10/graphql.json`,{method:'POST',headers:{'Content-Type':'application/json','X-Shopify-Access-Token':auth.access_token},body:JSON.stringify({query,variables})});
 if(body.errors?.length){
  if(body.errors.some((error:{extensions?:{code?:string}})=>error.extensions?.code==='ACCESS_DENIED'))throw new ApiError(503,'The installed app has read_orders, but Shopify denied fields needed to verify the order. Check its order/customer data access permissions [REC_ORDER_DATA_ACCESS].');
  throw new ApiError(502,'Shopify order lookup could not be completed [REC_QUERY].');
 }
 return body;
 };
}
export async function readRecoverableOrder(config:Config,orderNumber:string,fetcher:typeof fetch=fetch){
 const graphql=await recoveryClient(config,fetcher),name=orderNumber.startsWith('#')?orderNumber:`#${orderNumber}`;
 const body=await graphql(QUERY,{query:`name:${name}`});
 const candidates=body.data?.orders?.nodes;
 if(!Array.isArray(candidates))throw new ApiError(502,'Shopify returned an invalid order response [REC_RESPONSE].');
 const matches=candidates.filter((order:{name?:string})=>order?.name===name);
 if(matches.length!==1)throw new ApiError(422,'That paid order could not be verified [REC_ORDER].');
 return verifiedOrder(config,matches[0]);
}
function verifiedOrder(config:Config,raw:unknown){
 const parsed=orderSchema.safeParse(raw);
 if(!parsed.success)throw new ApiError(422,'The order must be an unrefunded, paid £1.99 GBP digital membership [REC_ORDER].');
 const order=parsed.data;
 const payments=order.transactions.filter(tx=>tx.status==='SUCCESS'&&['SALE','CAPTURE'].includes(tx.kind));
 if(payments.length!==1||!payments[0].processedAt||Number(payments[0].amountSet.shopMoney.amount)!==1.99||Number(order.totalPriceSet.shopMoney.amount)!==1.99||Number(order.totalRefundedSet.shopMoney.amount)!==0)throw new ApiError(422,'The original successful £1.99 payment could not be verified [REC_PAYMENT].');
 const line=order.lineItems.nodes[0];
 try{return membershipOrder({id:order.legacyResourceId,financial_status:'paid',currency:order.currencyCode,taxes_included:order.taxesIncluded,test:order.test,updated_at:payments[0].processedAt,customer:{id:order.customer.legacyResourceId},note_attributes:order.customAttributes.map(item=>({name:item.key,value:item.value})),line_items:[{id:line.id.split('/').at(-1),variant_id:line.variant.legacyResourceId,quantity:line.quantity,requires_shipping:line.requiresShipping,price:line.originalUnitPriceSet.shopMoney.amount,tax_lines:line.taxLines.map(tax=>({price:tax.priceSet.shopMoney.amount}))}]},config.variant,config.allowTest);}catch{throw new ApiError(422,'That paid order does not match the configured membership [REC_MEMBERSHIP].');}
}

export type VerifiedMembership=ReturnType<typeof membershipOrder>;
export async function readLinkedPaidOrders(config:Config,links:{token_hash:string;redeemed_order_id:string|null}[],customers:string[],since:string,fetcher:typeof fetch=fetch,now=new Date()):Promise<VerifiedMembership[]>{
 if(!links.length&&!customers.length)return [];
 if(!/^\d{4}-\d{2}-\d{2}T/.test(since)||!Number.isFinite(Date.parse(since))||customers.some(id=>!/^\d+$/.test(id)))throw new ApiError(400,'Invalid membership check window.');
 const graphql=await recoveryClient(config,fetcher),hashes=new Map(links.map(l=>[l.token_hash,l.redeemed_order_id])),known=new Set(customers);
 const query=`query LinkedMemberships($query:String!,$after:String) { orders(first:50,after:$after,sortKey:CREATED_AT,reverse:true,query:$query) { pageInfo { hasNextPage endCursor } nodes { name legacyResourceId customer { legacyResourceId } customAttributes { key value } lineItems(first:2) { nodes { variant { legacyResourceId } } } } } }`;
 function belongs(raw:{legacyResourceId?:unknown;customer?:{legacyResourceId?:unknown};customAttributes?:{key:string;value:string}[]}){const token=raw.customAttributes?.find(a=>a.key==='mbc_checkout')?.value,hash=typeof token==='string'&&/^[a-f0-9]{64}$/.test(token)?checkoutHash(token):null;return Boolean((hash&&hashes.has(hash)&&(hashes.get(hash)===null||hashes.get(hash)===String(raw.legacyResourceId)))||known.has(String(raw.customer?.legacyResourceId)));}
 const search=`financial_status:paid created_at:>=${since.slice(0,10)}`+(links.length?'':` (${customers.map(id=>'customer_id:'+id).join(' OR ')})`);
 let after:string|null=null;const seen=new Set<string>();
 for(let page=0;page<4;page++){
  const body=await graphql(query,{query:search,after}),orders=body.data?.orders;
  if(!Array.isArray(orders?.nodes)||typeof orders.pageInfo?.hasNextPage!=='boolean')throw new ApiError(502,'Shopify returned an invalid membership search [REC_RESPONSE].');
  for(const raw of orders.nodes){
   if(!raw||!Array.isArray(raw.customAttributes)||!belongs(raw)||!raw.lineItems?.nodes?.some((line:{variant?:{legacyResourceId?:unknown}})=>String(line.variant?.legacyResourceId)===config.variant)||!recoveryInput.safeParse({orderNumber:raw.name}).success)continue;
   const detail=await graphql(QUERY,{query:`name:${raw.name}`}),matches=detail.data?.orders?.nodes;
   if(!Array.isArray(matches))throw new ApiError(502,'Shopify returned an invalid order response [REC_RESPONSE].');
   const exact=matches.filter(o=>o?.name===raw.name&&String(o.legacyResourceId)===String(raw.legacyResourceId));
   if(exact.length!==1||!belongs(exact[0]))continue;
   try{const order=verifiedOrder(config,exact[0]);if(Date.parse(order.periodEnd)>now.getTime())return [order];}catch(error){if(!(error instanceof ApiError)||error.status!==422)throw error;}
  }
  // One verified, unrefunded current paid period is sufficient. Never claim no
  // payment was found when the bounded scan still has unread pages.
  if(!orders.pageInfo.hasNextPage)return [];
  const cursor=orders.pageInfo.endCursor;if(typeof cursor!=='string'||!cursor||seen.has(cursor))throw new ApiError(502,'Shopify returned an invalid membership search cursor [REC_RESPONSE].');seen.add(cursor);after=cursor;
 }
 throw new ApiError(503,'The automatic check could not finish searching recent payments. Use the existing-payment check or contact support [REC_AUTO_LIMIT].');
}
