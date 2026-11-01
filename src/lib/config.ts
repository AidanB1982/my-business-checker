export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://rreneammvssheldpgrxg.supabase.co";
export const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
export function isSupabaseConfigured() { return Boolean(SUPABASE_KEY); }
