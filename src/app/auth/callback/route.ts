import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured, SITE_URL } from "@/lib/config";
export async function GET(request: NextRequest) {
 const code=request.nextUrl.searchParams.get("code");
 if(code && isSupabaseConfigured()) {
  try { const supabase=await createClient();const {error}=await supabase.auth.exchangeCodeForSession(code);if(!error) return NextResponse.redirect(new URL("/account",SITE_URL)); } catch { /* Fail closed and offer a fresh sign-in link. */ }
 }
 return NextResponse.redirect(new URL("/sign-in?status=expired",SITE_URL));
}
