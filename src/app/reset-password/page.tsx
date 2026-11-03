import Link from 'next/link';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { isSupabaseConfigured } from '@/lib/config';
import { AUTH_RECOVERY_COOKIE } from '@/lib/auth-navigation';
import { updatePassword } from '@/app/auth/actions';
import { AuthSubmit } from '@/components/auth-submit';
export const dynamic='force-dynamic';
export const metadata={title:'Choose a new password',robots:{index:false,follow:false},referrer:'no-referrer'};
export default async function ResetPassword({searchParams}:{searchParams:Promise<{status?:string}>}){
 const {status}=await searchParams;let valid=false;
 if(isSupabaseConfigured())try{const db=await createClient(),{data:{user},error}=await db.auth.getUser();valid=Boolean(!error&&user&&(await cookies()).get(AUTH_RECOVERY_COOKIE)?.value===user.id);}catch{/* Request a new link if the recovery session cannot be validated. */}
 return <div className="wrap section"><p className="eyebrow">Your account</p><h1>Choose a new password.</h1>{valid?<form className="form-panel auth-reset" action={updatePassword}><p>Use 12–128 characters and save the password somewhere secure.</p><label htmlFor="new-password">New password</label><input id="new-password" name="password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required/><label htmlFor="confirm-password">Confirm new password</label><input id="confirm-password" name="confirm_password" type="password" autoComplete="new-password" minLength={12} maxLength={128} required/>{status==='password'&&<p role="alert">Use 12–128 characters and enter the same password twice.</p>}{status==='error'&&<p role="alert">The password could not be updated. Try a different strong password or request a new reset link.</p>}<AuthSubmit>Save new password →</AuthSubmit></form>:<div className="notice"><p>Your reset session is missing or has expired. Open the latest reset email in the browser where you requested it.</p><Link className="text-link" href="/sign-in?mode=forgot">Request a new password-reset link →</Link></div>}</div>;
}
