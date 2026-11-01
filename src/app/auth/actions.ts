"use server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured, SITE_URL } from "@/lib/config";
export async function signIn(form: FormData) {
 if(!isSupabaseConfigured()) redirect("/sign-in?status=unavailable");
 const email=z.email().max(254).safeParse(form.get("email"));
 if(!email.success) redirect("/sign-in?status=invalid");
 let failed = false;
 try { const supabase=await createClient();const {error}=await supabase.auth.signInWithOtp({email:email.data,options:{emailRedirectTo: new URL("/auth/callback",SITE_URL).toString()}});failed = Boolean(error); } catch { failed = true; }
 if(failed) redirect("/sign-in?status=error");
 redirect("/sign-in?status=sent");
}
export async function signOut() {
 if(isSupabaseConfigured()) { const supabase=await createClient();const {error}=await supabase.auth.signOut();if(error) redirect("/account?status=signout-error"); }
 redirect("/sign-in");
}
