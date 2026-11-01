import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/config";
import { signOut } from "@/app/auth/actions";
import { hasAdvanced } from "@/lib/entitlements";
export const metadata={title:"Your account",robots:{index:false,follow:false}};
export default async function Account() {
 if(!isSupabaseConfigured()) redirect("/sign-in");
 const supabase=await createClient();const {data:{user},error}=await supabase.auth.getUser();if(error||!user) redirect("/sign-in");
 const {data:subscription,error:subscriptionError}=await supabase.from("subscriptions").select("status,current_period_end").eq("user_id",user.id).maybeSingle();
 const advanced=!subscriptionError && hasAdvanced(subscription);
 return <div className="wrap section"><p className="eyebrow">Your workspace</p><h1>A clearer view.</h1><p>Signed in as {user.email}</p>{subscriptionError?<div className="notice">Your plan could not be loaded. Please try again later. If this is a new installation, apply the database migration.</div>:<p className="tag">{advanced?"Advanced":"Free plan"}</p>}<section className="notice"><h2>Saved calculations</h2><p>Saving, scenario comparison and reports are planned for Advanced at £1.99/month. They are not enabled yet.</p><Link className="text-link" href="/tools">Explore the free tools →</Link></section><form action={signOut}><button type="submit" className="button secondary">Sign out</button></form></div>;
}
