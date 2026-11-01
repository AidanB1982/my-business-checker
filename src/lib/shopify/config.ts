import 'server-only';
export const SHOPIFY_STORE='blackwoodpublishing.myshopify.com';
export const SHOPIFY_ACCOUNT_URL=`https://${SHOPIFY_STORE}/account`;
const value=(name:string)=>process.env[name]?.trim()||undefined;
export function shopifyConfig(){return {
 store:SHOPIFY_STORE,token:value('SHOPIFY_STOREFRONT_ACCESS_TOKEN'),
 clientId:value('SHOPIFY_CLIENT_ID'),clientSecret:value('SHOPIFY_CLIENT_SECRET'),
 secret:value('SHOPIFY_WEBHOOK_SECRET'),
 variant:value('SHOPIFY_MEMBERSHIP_VARIANT_ID')??'60314386301273',
 plan:value('SHOPIFY_SELLING_PLAN_ID')??'697055314265',
 ready:value('SHOPIFY_SUBSCRIPTION_READY')?.toLowerCase()==='true',
 allowTest:value('SHOPIFY_ALLOW_TEST_ORDERS')?.toLowerCase()==='true',
};}
export function shopifyConfigurationIssues(){
 const config=shopifyConfig();const issues:{setting:string;reason:string}[]=[];
 if(!config.ready)issues.push({setting:'SHOPIFY_SUBSCRIPTION_READY',reason:'Must be set to true after setup.'});
 if(!config.token){
  if(!config.clientId)issues.push({setting:'SHOPIFY_CLIENT_ID',reason:'Missing or blank. Required unless an explicit Storefront token is configured.'});
  if(!config.clientSecret)issues.push({setting:'SHOPIFY_CLIENT_SECRET',reason:'Missing or blank. Required unless an explicit Storefront token is configured.'});
 }
 if(!config.secret)issues.push({setting:'SHOPIFY_WEBHOOK_SECRET',reason:'Missing or blank.'});
 if(!value('SUPABASE_SERVICE_ROLE_KEY'))issues.push({setting:'SUPABASE_SERVICE_ROLE_KEY',reason:'Missing or blank.'});
 if(!/^\d+$/.test(config.variant))issues.push({setting:'SHOPIFY_MEMBERSHIP_VARIANT_ID',reason:'Must be a numeric variant ID.'});
 if(!/^\d+$/.test(config.plan))issues.push({setting:'SHOPIFY_SELLING_PLAN_ID',reason:'Must be a numeric selling-plan ID.'});
 return issues;
}
export function billingAvailable(){return shopifyConfigurationIssues().length===0;}
