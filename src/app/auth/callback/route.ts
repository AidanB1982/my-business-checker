import { NextResponse,type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured,SITE_URL } from '@/lib/config';
import { AUTH_RETURN_COOKIE,AUTH_RECOVERY_COOKIE,authReturnPath,signInUrl } from '@/lib/auth-navigation';
export async function GET(request:NextRequest){
 const code=request.nextUrl.searchParams.get('code');const store=await cookies();const returnTo=authReturnPath(store.get(AUTH_RETURN_COOKIE)?.value);
 store.delete(AUTH_RECOVERY_COOKIE);
 if(code&&isSupabaseConfigured()){
  try{const supabase=await createClient();const {data,error}=await supabase.auth.exchangeCodeForSession(code);if(!error){if(data&&'redirectType' in data&&data.redirectType==='recovery'&&data.user){store.set(AUTH_RECOVERY_COOKIE,data.user.id,{httpOnly:true,secure:new URL(SITE_URL).protocol==='https:',sameSite:'lax',path:'/',maxAge:900});return NextResponse.redirect(new URL('/reset-password',SITE_URL));}store.delete(AUTH_RETURN_COOKIE);return NextResponse.redirect(new URL(returnTo,SITE_URL));}}catch{ /* Keep the intended destination when a confirmation or recovery link has expired. */ }
 }
 return NextResponse.redirect(new URL(signInUrl('expired',returnTo),SITE_URL));
}
