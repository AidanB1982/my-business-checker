import { randomBytes } from 'node:crypto';
import { NextResponse } from 'next/server';
import { authenticated,checkOrigin,ApiError,apiError } from '@/lib/api';
import { hasAdvanced } from '@/lib/entitlements';
import { createAdmin } from '@/lib/supabase/admin';
import { billingAvailable,shopifyConfig } from '@/lib/shopify/config';
import { checkoutHash } from '@/lib/shopify/core';
export async function POST(request:Request){try{
 checkOrigin(request);const {supabase,user}=await authenticated();if(!billingAvailable())throw new ApiError(503,'Shopify recurring checkout is still being configured.');
 const {data:subscription,error}=await supabase.from('subscriptions').select('status,current_period_end,billing_customer_id').eq('user_id',user.id).maybeSingle();if(error)throw new ApiError(503,'Your plan could not be checked.');if(hasAdvanced(subscription))throw new ApiError(409,'You already have paid access. Manage your subscription in Shopify.');
 if(subscription?.billing_customer_id?.startsWith('shopify:'))throw new ApiError(409,'Use your Shopify customer account to manage or restart this membership, rather than create a duplicate subscription.');
 const config=shopifyConfig();const token=randomBytes(32).toString('hex');const admin=createAdmin();
 const {error:linkError}=await admin.from('shopify_checkout_links').insert({token_hash:checkoutHash(token),user_id:user.id,variant_id:config.variant,expires_at:new Date(Date.now()+24*60*60*1000).toISOString()});if(linkError)throw new ApiError(503,'Checkout could not be prepared. Check the billing migration.');
 const response=await fetch(`https://${config.store}/api/2026-10/graphql.json`,{method:'POST',headers:{'Content-Type':'application/json','X-Shopify-Storefront-Access-Token':config.token!},cache:'no-store',signal:AbortSignal.timeout(15000),body:JSON.stringify({query:`mutation CreateMembershipCart($input: CartInput!) { cartCreate(input:$input) { cart { checkoutUrl cost { totalAmount { amount currencyCode } } lines(first:2) { nodes { quantity ... on CartLine { merchandise { ... on ProductVariant { id } } sellingPlanAllocation { sellingPlan { id } } } } } } userErrors { message } } }`,variables:{input:{lines:[{merchandiseId:`gid://shopify/ProductVariant/${config.variant}`,quantity:1,sellingPlanId:`gid://shopify/SellingPlan/${config.plan}`}],attributes:[{key:'mbc_checkout',value:token}],buyerIdentity:{email:user.email}}}})});
 if(!response.ok)throw new ApiError(502,'Shopify checkout is unavailable.');const body=await response.json();const cart=body.data?.cartCreate?.cart;const line=cart?.lines?.nodes?.[0];
 if(body.errors?.length||body.data?.cartCreate?.userErrors?.length||!cart||cart.lines.nodes.length!==1||line.quantity!==1||line.merchandise?.id!==`gid://shopify/ProductVariant/${config.variant}`||line.sellingPlanAllocation?.sellingPlan?.id!==`gid://shopify/SellingPlan/${config.plan}`||cart.cost?.totalAmount?.currencyCode!=='GBP'||Number(cart.cost.totalAmount.amount)!==1.99)throw new ApiError(502,'The Shopify cart must contain the configured £1.99 GBP subscription only. Check the product, selling plan, tax and price settings.');
 const checkout=new URL(cart.checkoutUrl);if(checkout.protocol!=='https:'||!(checkout.hostname===config.store||checkout.hostname.endsWith('.shopify.com')||checkout.hostname==='checkout.shopify.com'||checkout.hostname===process.env.SHOPIFY_CHECKOUT_HOST))throw new ApiError(502,'Shopify returned an unexpected checkout address.');
 return NextResponse.json({url:checkout.toString()},{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){return apiError(error);}}
