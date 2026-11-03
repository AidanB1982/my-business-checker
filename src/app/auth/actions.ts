"use server";
import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured,SITE_URL } from '@/lib/config';
import { AUTH_RETURN_COOKIE,AUTH_RECOVERY_COOKIE,authReturnPath,signInUrl } from '@/lib/auth-navigation';
const emailSchema=z.email().max(254),newPassword=z.string().min(12).max(128);
async function remember(returnTo:string){const store=await cookies();store.delete(AUTH_RECOVERY_COOKIE);store.set(AUTH_RETURN_COOKIE,returnTo,{httpOnly:true,secure:new URL(SITE_URL).protocol==='https:',sameSite:'lax',path:'/',maxAge:3600});}
export async function signIn(form:FormData){
 const returnTo=authReturnPath(form.get('returnTo'));
 if(!isSupabaseConfigured())redirect(signInUrl('unavailable',returnTo));
 const email=emailSchema.safeParse(form.get('email')),password=z.string().min(1).max(128).safeParse(form.get('password'));
 if(!email.success||!password.success)redirect(signInUrl('invalid',returnTo));
 let failed=false;try{const db=await createClient();const {error}=await db.auth.signInWithPassword({email:email.data,password:password.data});failed=Boolean(error);if(!failed){const store=await cookies();store.delete(AUTH_RETURN_COOKIE);store.delete(AUTH_RECOVERY_COOKIE);}}catch{failed=true;}
 if(failed)redirect(signInUrl('credentials',returnTo));redirect(returnTo);
}
export async function register(form:FormData){
 const returnTo=authReturnPath(form.get('returnTo')),url=(status:string)=>signInUrl(status,returnTo)+'&mode=register';
 if(!isSupabaseConfigured())redirect(url('unavailable'));
 const email=emailSchema.safeParse(form.get('email')),password=newPassword.safeParse(form.get('password'));
 if(!email.success)redirect(url('invalid'));if(!password.success||form.get('password')!==form.get('confirm_password'))redirect(url('password'));
 let failed=false,signedIn=false;try{await remember(returnTo);const db=await createClient();const {data,error}=await db.auth.signUp({email:email.data,password:password.data,options:{emailRedirectTo:new URL('/auth/callback',SITE_URL).toString()}});failed=Boolean(error);signedIn=Boolean(data.session);}catch{failed=true;}
 if(failed)redirect(url('register-error'));if(signedIn){(await cookies()).delete(AUTH_RETURN_COOKIE);redirect(returnTo);}redirect(signInUrl('confirm',returnTo));
}
export async function requestPasswordReset(form:FormData){
 const returnTo=authReturnPath(form.get('returnTo'));
 if(!isSupabaseConfigured())redirect(signInUrl('unavailable',returnTo)+'&mode=forgot');
 const email=emailSchema.safeParse(form.get('email'));if(!email.success)redirect(signInUrl('invalid',returnTo)+'&mode=forgot');
 try{await remember(returnTo);const db=await createClient();await db.auth.resetPasswordForEmail(email.data,{redirectTo:new URL('/auth/callback',SITE_URL).toString()});}catch{/* Keep the response identical regardless of account existence or provider errors. */}
 redirect(signInUrl('reset-sent',returnTo)+'&mode=forgot');
}
export async function updatePassword(form:FormData){
 if(!isSupabaseConfigured())redirect('/sign-in?status=unavailable');
 const password=newPassword.safeParse(form.get('password'));
 if(!password.success||form.get('password')!==form.get('confirm_password'))redirect('/reset-password?status=password');
 let failed=false,valid=false;const store=await cookies();
 try{const db=await createClient();const {data:{user},error}=await db.auth.getUser();valid=Boolean(!error&&user&&store.get(AUTH_RECOVERY_COOKIE)?.value===user.id);if(valid){const result=await db.auth.updateUser({password:password.data});failed=Boolean(result.error);}}catch{failed=true;}
 if(!valid){store.delete(AUTH_RECOVERY_COOKIE);redirect('/sign-in?mode=forgot&status=recovery-expired');}
 if(failed)redirect('/reset-password?status=error');
 store.delete(AUTH_RECOVERY_COOKIE);const returnTo=authReturnPath(store.get(AUTH_RETURN_COOKIE)?.value);store.delete(AUTH_RETURN_COOKIE);redirect(returnTo);
}
export async function signOut(){
 if(isSupabaseConfigured()){const supabase=await createClient();const {error}=await supabase.auth.signOut();if(error)redirect('/account?status=signout-error');}
 const store=await cookies();store.delete(AUTH_RECOVERY_COOKIE);store.delete(AUTH_RETURN_COOKIE);redirect('/sign-in');
}
