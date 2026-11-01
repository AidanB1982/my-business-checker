# Connect the existing Supabase project

Project URL: https://rreneammvssheldpgrxg.supabase.co

1. In Supabase Project Settings → API Keys, copy the **publishable** key (or legacy anon key). Never put a secret/service-role key in a NEXT_PUBLIC variable.
2. Copy `.env.example` to the ignored `.env.local`. Set `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`. Set `NEXT_PUBLIC_SITE_URL` to the actual app origin (localhost:3000 for local development). Restart the app after changing public variables; production builds embed them.
3. Review and apply `supabase/migrations/202611010001_initial_schema.sql` using the Supabase SQL editor or the migration CLI. This creates new public tables; inspect existing tables for conflicts first. The migration is transactional and runs once.
4. In Authentication → URL Configuration, set Site URL and allow the exact `/auth/callback` URL for each development/production origin. Enable email sign-in. Keep Supabase email rate limits and configure production SMTP before public launch.
5. Request a link at `/sign-in`, open it in the same browser (PKCE), then confirm `/account` shows the Free plan. Test sign-out. This is the connection/auth smoke test; `/api/health` reports configuration presence only and does not verify database connectivity.
6. Test row-level security with two different users: neither can read the other's data; neither can modify subscriptions. A Free user cannot insert/update saved calculations. An expired Advanced user may still read/delete their own records. Test these against your Supabase instance before release.

No migration has been applied remotely by generating these files. No privileged credential is needed in the Next.js app for the current workflow. Configure environment network access to `rreneammvssheldpgrxg.supabase.co` if requests are denied by the cloud policy.

## Advanced and billing

The £1.99/month price is represented on the pricing page, but checkout, billing webhooks, saved-calculation UI, comparisons and reports are not implemented. The schema reserves subscription writes for a trusted backend. Never grant subscription writes to authenticated users or infer paid access from browser state. Add a verified, idempotent billing webhook before enabling paid features.

## Google sign-in later

Email links are the initial sign-in flow. To add Google, configure the Google OAuth client and provider in Supabase, use the Supabase-provided callback URL in Google Cloud, and implement `signInWithOAuth` with the app `/auth/callback` redirect. Do not put a Google client secret in frontend code.
