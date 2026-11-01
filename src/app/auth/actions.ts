"use server";
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured,SITE_URL } from '@/lib/config';
import { AUTH_RETURN_COOKIE,authReturnPath,signInUrl } from '@/lib/auth-navigation';
export async function signIn(form:FormData){
 const returnTo=authReturnPath(form.get('returnTo'));
 if(!isSupabaseConfigured())redirect(signInUrl('unavailable',returnTo));
 const email=z.email().max(254).safeParse(form.get('email'));if(!email.success)redirect(signInUrl('invalid',returnTo));
 let failed=false;
 try{
  const store=await cookies();store.set(AUTH_RETURN_COOKIE,returnTo,{httpOnly:true,secure:new URL(SITE_URL).protocol==='https:',sameSite:'lax',path:'/',maxAge:3600});
  const supabase=await createClient();const {error}=await supabase.auth.signInWithOtp({email:email.data,options:{emailRedirectTo:new URL('/auth/callback',SITE_URL).toString()}});failed=Boolean(error);
 }catch{failed=true;}
 if(failed)redirect(signInUrl('error',returnTo));redirect(signInUrl('sent',returnTo));
}
export async function signOut(){
 if(isSupabaseConfigured()){const supabase=await createClient();const {error}=await supabase.auth.signOut();if(error)redirect('/account?status=signout-error');}
 redirect('/sign-in');
}
