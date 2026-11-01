import { NextResponse,type NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured,SITE_URL } from '@/lib/config';
import { AUTH_RETURN_COOKIE,authReturnPath,signInUrl } from '@/lib/auth-navigation';
export async function GET(request:NextRequest){
 const code=request.nextUrl.searchParams.get('code');const store=await cookies();const returnTo=authReturnPath(store.get(AUTH_RETURN_COOKIE)?.value);
 store.delete(AUTH_RETURN_COOKIE);
 if(code&&isSupabaseConfigured()){
  try{const supabase=await createClient();const {error}=await supabase.auth.exchangeCodeForSession(code);if(!error)return NextResponse.redirect(new URL(returnTo,SITE_URL));}catch{ /* Offer a fresh link without losing the intended destination. */ }
 }
 return NextResponse.redirect(new URL(signInUrl('expired',returnTo),SITE_URL));
}
