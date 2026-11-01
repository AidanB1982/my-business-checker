import 'server-only';
export const SHOPIFY_STORE='blackwoodpublishing.myshopify.com';
export const SHOPIFY_ACCOUNT_URL=`https://${SHOPIFY_STORE}/account`;
export function shopifyConfig(){return {store:SHOPIFY_STORE,token:process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN,secret:process.env.SHOPIFY_WEBHOOK_SECRET,variant:process.env.SHOPIFY_MEMBERSHIP_VARIANT_ID||'60314386301273',plan:process.env.SHOPIFY_SELLING_PLAN_ID||'697055314265',ready:process.env.SHOPIFY_SUBSCRIPTION_READY==='true',allowTest:process.env.SHOPIFY_ALLOW_TEST_ORDERS==='true'};}
export function billingAvailable(){const config=shopifyConfig();return Boolean(config.ready&&config.token&&config.secret&&config.variant&&/^\d+$/.test(config.variant)&&config.plan&&/^\d+$/.test(config.plan)&&process.env.SUPABASE_SERVICE_ROLE_KEY);}
