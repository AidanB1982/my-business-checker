"use client";
import { createBrowserClient } from "@supabase/ssr";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/config";
export function createClient() {
  if (!SUPABASE_KEY) throw new Error("Supabase publishable key is not configured.");
  return createBrowserClient(SUPABASE_URL, SUPABASE_KEY);
}
