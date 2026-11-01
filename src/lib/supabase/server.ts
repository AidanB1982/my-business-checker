import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/config";
export async function createClient() {
  if (!SUPABASE_KEY) throw new Error("Supabase publishable key is not configured.");
  const store = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => store.getAll(),
      setAll(values) {
        try { values.forEach(({name,value,options}) => store.set(name,value,options)); }
        catch { /* Server Components cannot set cookies. The proxy refreshes them. */ }
      },
    },
  });
}
