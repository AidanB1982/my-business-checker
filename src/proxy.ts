import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { SUPABASE_URL, SUPABASE_KEY } from "@/lib/config";
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!SUPABASE_KEY) return response;
  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        values.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  await supabase.auth.getUser();
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}
export const config = { matcher: ["/sign-in", "/reset-password", "/bookkeeping/:path*", "/api/bookkeeping/:path*", "/pricing", "/projects/:path*", "/api/projects/:path*", "/learn/:path*", "/account/:path*", "/auth/:path*", "/api/calculations/:path*", "/api/usage", "/api/learning", "/api/billing/checkout", "/api/billing/status", "/api/billing/recover", "/api/billing/reconcile"] };
