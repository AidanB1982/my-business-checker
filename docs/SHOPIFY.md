# Shopify Advanced membership

Store: `blackwoodpublishing.myshopify.com`
Product: https://blackwoodpublishing.myshopify.com/products/my-business-checker
Variant: `60314386301273`
Selling plan: `697055314265`

These public IDs come from product JSON supplied by the owner on 1 November 2026. The price is £1.99, the plan is “Deliver every month”, and the variant requires no shipping. The supplied product data currently allows one-time purchase (`requires_selling_plan: false`). Set subscription-only purchase options before enabling the membership checkout.

## What is implemented

- A server-created Storefront API cart always includes the configured recurring selling plan and one membership variant. It checks the expected £1.99 GBP amount.
- Checkout includes a random account-link attribute; only its hash is stored server-side. A first payment cannot grant access by matching an email address or accepting a client-supplied user ID.
- Signed `orders/paid` webhooks record one calendar month of access from the order's paid-event timestamp. Replays of the same order cannot add time twice. Later paid renewal orders use the trusted Shopify customer mapping.
- `refunds/create` and `orders/cancelled` reverse the affected paid period. Refunds arriving before payment are retained as tombstones. Refunding an unrelated order line does not revoke membership. A later paid renewal remains valid if an earlier order is refunded.
- Failed renewal produces no paid-order extension, so access expires at the recorded paid-period end. Cancelling the contract in Shopify stops renewal; the already paid period remains available unless refunded.
- The app links to the Shopify customer account to manage/restart/cancel. Enable the subscription app's self-service controls there. Existing linked users are sent to that account instead of creating a second contract in this app.

This is a **paid-period ledger**, not a complete mirror of Shopify subscription contracts. Billing-anchor changes, pauses, prorations and custom grants are not inferred from contract events. Chargeback/dispute handling needs merchant reconciliation; no automatic dispute integration is claimed. Trial/discount plans are not supported by this £1.99 flow.

## Required configuration — keep checkout disabled initially

1. Review/run `supabase/migrations/202611010002_shopify_membership.sql` once, after the original migration. It adds private billing tables, service-role-only atomic functions and calculation size limits. Do not rerun the original migration.
2. Set these **server-only** Vercel Production variables securely (never paste them into chat or prefix them with `NEXT_PUBLIC_`):
   - `SUPABASE_SERVICE_ROLE_KEY`: a Supabase server secret/service-role key. It is used only for the billing ledger and checkout-link tables. Normal calculation APIs continue using the user's own session and RLS.
   - Either `SHOPIFY_STOREFRONT_ACCESS_TOKEN` (an existing Storefront token) **or** both `SHOPIFY_CLIENT_ID` and `SHOPIFY_CLIENT_SECRET` from the installed Dev Dashboard app. With the client credentials route, the server exchanges them for app access and reuses/creates a Storefront token through the Admin API. Client credentials require an app/store ownership relationship supported by Shopify. The app must be installed with `unauthenticated_read_product_listings`, `unauthenticated_read_selling_plans` and `unauthenticated_write_checkouts`. A Client secret is never passed as the Storefront token. Provisioned tokens remain in Shopify; none are written to Git or sent to the browser.
   - `SHOPIFY_WEBHOOK_SECRET`: the signing secret for the webhook registration method you use. Use the Notifications webhook signing secret for manually created webhooks, or the matching app client secret for app-created webhooks; do not mix them.
   - Optional `SHOPIFY_CHECKOUT_HOST`: an exact trusted custom checkout hostname if cartCreate returns your store's custom domain. No scheme or path.
3. The product and plan IDs above are defaults; optional `SHOPIFY_MEMBERSHIP_VARIANT_ID` and `SHOPIFY_SELLING_PLAN_ID` override them. Keep price £1.99 GBP, one quantity, no shipping, no discounts, monthly recurring. Configure tax-inclusive pricing where applicable so the final membership charge remains £1.99. VAT charged on top is rejected by the paid-order adapter.
4. Register JSON webhooks for **Order payment**, **Refund creation**, and **Order cancellation** at:
   `https://my-business-checker.vercel.app/api/billing/shopify/webhook`
   (API topics `orders/paid`, `refunds/create`, `orders/cancelled`). These hooks may see book orders too; unrelated paid variants are ignored.
5. For deliberate test orders only, set `SHOPIFY_ALLOW_TEST_ORDERS=true` in the isolated test deployment. Test paid orders are otherwise rejected. Use a separate test Supabase project/checkout product where possible: test grants must never be represented as live subscriptions.
6. Set `SHOPIFY_SUBSCRIPTION_READY=true` only after the monthly/subscription-only product and webhooks have been confirmed and the real test below is ready. Until then, checkout is visibly unavailable and no browser return URL grants access.
7. Redeploy after configuration changes. If using this cloud environment to test external calls, also allow the exact Shopify hostname through its network configuration; Vercel's configuration is separate.

## Mandatory live integration check

The adapter has local signature, route and PostgreSQL tests. It has **not** been exercised against this store or a live Shopify subscription yet. Before offering paid checkout:

- Sign into the app, start checkout and confirm the correct monthly product at £1.99 including any tax. Use the supplied selling plan, not a one-time product checkout. Confirm the `mbc_checkout` cart attribute arrives in the paid order's `note_attributes`.
- Confirm webhook delivery succeeds and only the signed-in account gets one paid period. Refresh the app account; save two calculations, compare them, download both report formats and delete a record.
- Deliver the same paid order again; the expiry must not extend. Check a renewal, a failed renewal/expiry and subscription cancellation in Shopify customer self-service.
- Refund the membership line and check revocation; refund an unrelated book line and check that membership stays intact.
- Remove test-order allowance before live sales. Confirm webhook retries and merchant visibility for failed deliveries. Existing customers who purchased directly from the store before using the linked app checkout need a deliberate support/linking process; no email-only auto-link is performed.

The app does not send unsolicited emails or alter the Shopify theme/product automatically. Configuration and a real test order remain outside the local test evidence.

## Dev Dashboard credential route

After adding the Client ID/secret as private Vercel variables, redeploy. No OAuth redirect route or extra Supabase migration is needed for this server-to-server exchange. An explicit Storefront token takes precedence if both methods are configured. Server instances coalesce concurrent requests and cache the resolved token for five minutes; later requests query existing tokens before creating one. A cross-instance creation race can create more than one app-owned token, but the helper does not delete or rotate any tokens. The client-credentials exchange and token creation have mocked tests; successful authentication against this store still requires the actual private variables and a live checkout check.

## Diagnosing a disabled checkout button

Open `/api/health` on the deployed app. `billing.configurationIssues` lists missing setting names or a disabled readiness flag, never credential values. `revision` identifies the deployed Git commit when Vercel provides it. If the array is empty but an old tab shows a disabled button, refresh the account page and verify the production deployment/revision. A configured result verifies only presence/format, not the credentials, webhook delivery or Shopify API access. Check Production scope and redeploy after correcting variables.
