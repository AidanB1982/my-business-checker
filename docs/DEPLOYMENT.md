# Publish the installable app on Vercel

An installable web app still needs an HTTPS address to deliver the app to a phone. No custom domain or separate marketing website is required. Vercel provides an initial `*.vercel.app` address and HTTPS for Next.js.

## First deployment (requires your Vercel account)

1. Open https://vercel.com/new and sign in with GitHub.
2. Import `AidanB1982/my-business-checker`. If it is not listed, grant the Vercel GitHub integration access to this repository.
3. Keep the Next.js framework preset and repository root. Default install/build settings use the lockfile and `npm run build`.
4. Add `NEXT_PUBLIC_SUPABASE_URL` with `https://rreneammvssheldpgrxg.supabase.co`, and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` with your public publishable key. Never add a service-role key to a `NEXT_PUBLIC_` variable.
5. Deploy. After Vercel assigns an address, set `NEXT_PUBLIC_SITE_URL` to that exact HTTPS origin (no trailing callback path) and redeploy. These variables are read at build time.
6. In Supabase Authentication → URL Configuration, set Site URL to the same HTTPS origin and add `https://YOUR-APP.vercel.app/auth/callback` to Redirect URLs. Keep localhost only for local development.
7. Verify the home/tools pages, tax preview, sign-in email flow and sign-out at that address. Confirm the deployment is accessible to intended testers; Vercel deployment protection may require sign-in for preview addresses.

The repository has not been deployed merely by pushing GitHub. Future pushes to the connected production branch trigger Vercel builds once the integration is configured. GitHub Actions checks are separate; configure deployment gates if you want deployment to wait for CI.

## Install on a phone

For paid bookkeeping, run `supabase/migrations/202611030001_bookkeeping.sql` once in the existing Supabase project after the previous migrations. No new credentials or Edge Function is needed. See [Bookkeeping setup and scope](BOOKKEEPING.md).

Named accounts use `202611030002_customer_supplier_accounts.sql`; itemised invoicing uses `202611030003_invoices.sql`, in that order after the first bookkeeping migration. Run each only once. Invoicing does not require file storage, uploads or another environment variable.

For the shared Projects section, also run `supabase/migrations/202611010003_project_workspaces.sql` once in the existing Supabase project. A Vercel redeploy does not run database migrations. No additional environment variables or Edge Functions are needed; see [Projects setup](PROJECTS.md).

- iPhone/iPad: open the HTTPS app address in Safari → Share → Add to Home Screen.
- Android: open in Chrome → Install app / Add to Home screen when offered. An Install app button also appears in our footer when the browser exposes an install prompt.

Device installation must still be tested on real phones. Browser tests validate the manifest, icon responses, service worker, offline fallback and reconnection; they do not submit or install an app through an app store.

## Current preview limitations

The tax rules still await independent official HMRC source review. Keep preview labels and robots restrictions. All eleven calculator/working-area previews and the Advanced workspace are implemented. Shopify checkout remains disabled until its new migration, server credentials and live integration checks are complete; see docs/SHOPIFY.md. The privacy, contact and operator details need review before a general public launch. Hosting a preview is distinct from a launch-ready financial product.
