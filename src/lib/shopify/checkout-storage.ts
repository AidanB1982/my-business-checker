// Return only fixed categories: database messages can contain private row data.
export function checkoutStorageFailure(error:{code?:string},status:number){
 if(status===401||['PGRST301','PGRST302','PGRST303'].includes(error.code??''))return 'Checkout account-link authentication failed [DB_LINK_AUTH]. Check the Supabase server key and project URL.';
 if(['PGRST205','PGRST204','42P01','42703'].includes(error.code??''))return 'Checkout account-link schema is unavailable [DB_LINK_SCHEMA]. Check the Shopify billing migration and reload the Supabase schema cache.';
 if(error.code==='42501'||status===403)return 'Checkout account-link permission was denied [DB_LINK_PERMISSION]. Check the Supabase service-role key and billing table grants.';
 if(error.code==='23503')return 'Checkout account-link user was not found [DB_LINK_USER]. Check that server and sign-in credentials use the same Supabase project.';
 if(status===0)return 'Checkout account-link database could not be reached [DB_LINK_NETWORK]. Try again shortly.';
 return 'Checkout account link could not be saved [DB_LINK_WRITE]. Check the Supabase database logs.';
}
