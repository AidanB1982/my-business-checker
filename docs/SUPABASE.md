# Supabase accounts and Advanced data

Project: https://rreneammvssheldpgrxg.supabase.co

## Configuration

- `NEXT_PUBLIC_SUPABASE_URL`: the project URL above.
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: public publishable key (or legacy anon key).
- `NEXT_PUBLIC_SITE_URL`: the app's exact origin: `http://localhost:3000` for local development, `https://my-business-checker.vercel.app` for production.

Use `.env.local` locally or Vercel environment settings in production. Public variables are embedded at build time, so redeploy after changes. Never put a secret/service-role key in any `NEXT_PUBLIC_` variable.

In Authentication → URL Configuration, Site URL is the origin **without** `/auth/callback`; allow that origin plus `/auth/callback` in Redirect URLs. Email sign-in uses PKCE: request and open the email link in the same browser. `/api/health` reports configuration presence, not live connectivity. Google OAuth is not implemented.

## Migrations

1. `202611010001_initial_schema.sql`: original profiles, subscriptions, saved calculations, rule sets and RLS. The owner confirmed applying this earlier. Do not rerun it on that project.
2. **New:** `202611010002_shopify_membership.sql`: private checkout links/customer mapping/paid-order ledger, reversal tombstones, size limits and service-role-only atomic billing functions. Apply once after the original migration. This file has only been run in local PostgreSQL tests; generating it does not apply it to production.
3. `202611010003_project_workspaces.sql`: shared project workspaces, memberships, projects, tasks, milestones, discussions, activity and email-bound invitations. Apply once after the existing migrations. It uses normal authenticated RLS and needs no new server key or Edge Function. See [Projects setup](PROJECTS.md).

All migrations are transactional. Inspect for naming conflicts before using them on a different existing project. Billing functions use a per-order transaction lock to serialize concurrent payments/refunds, and a user lock for the paid-period update. Billing function execution is denied to anonymous and authenticated clients. Project functions are separately restricted to signed-in users and validate workspace roles and owner entitlement.

## Data permissions

Bookkeeping requires the additional transactional migration `202611030001_bookkeeping.sql`. Posting functions enforce Advanced access and ownership; immutable ledger tables allow only owner reads through RLS. Expired accounts retain read/export access. See [Bookkeeping](BOOKKEEPING.md). Do not rerun the original migrations to enable this feature.

Anonymous visitors cannot read or write account/billing tables. Authenticated users can read their own subscription status but cannot grant themselves paid access. Active Advanced users can save/update their own records; expired users can still read/export/delete their existing records. Normal APIs use the user's authenticated Supabase session and explicitly filter by user ID, in addition to RLS.

The server recalculates a save from validated inputs; it does not trust a browser-provided result. Reports preserve a saved snapshot and its rule version. HTML escapes user text; CSV exports neutralize formula-like cells. Financial figures are sent to the app/Supabase only after explicit save consent, not while calculating.

## Billing credentials and live checks

`SUPABASE_SERVICE_ROLE_KEY` is server-only and is needed only for Shopify checkout linking and signed billing events. Enter it securely in Vercel; do not paste it into chat or commit it. See [Shopify setup](SHOPIFY.md) for the matching webhook/Storefront configuration.

Local tests verify RLS with two users, signature rejection, paid-order idempotency, refunds before payments and owned report APIs. The full paid-user browser journey still needs a real Shopify test order and live Supabase account. Configure production email delivery and complete the operator/privacy/retention details before a general launch.
