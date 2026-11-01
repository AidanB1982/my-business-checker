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

## Access errors and pricing checkout

Authenticated checkout errors now contain a fixed `SF_` stage code for app authentication, token lookup or token creation. HTTP status and allowlisted schema/permission categories are reported without raw provider messages, request headers, credential values or tokens. A configuration-presence check is distinct from successful app authentication.

The Advanced pricing card starts the same authenticated checkout directly. If sign-in is needed, an HTTP-only, same-site cookie records an allowlisted `/pricing` return destination. The Supabase email callback URL remains unchanged, and successful sign-in returns to pricing without requiring an account-page visit. Existing subscribers/customer mappings still receive the management link rather than a duplicate subscription.

## Checkout account-link storage failures

Checkout stores a private, hashed link before creating a Shopify cart. A storage failure stops checkout; it must not fall back to email matching or skip account linking. The browser receives only fixed categories, never raw database messages:

- `DB_LINK_SCHEMA`: missing billing table/column or stale PostgREST schema cache. Confirm migration `202611010002_shopify_membership.sql` ran in the project used by Production. Do not blindly rerun it; it is transactional and not idempotent. If the schema exists, reload the API schema cache using `NOTIFY pgrst, 'reload schema';` in Supabase SQL Editor.
- `DB_LINK_AUTH`: rejected server credential. Verify Production `SUPABASE_SERVICE_ROLE_KEY` is the service-role/server secret key for the same project as `NEXT_PUBLIC_SUPABASE_URL`, then redeploy. Never share the key or put it in a public variable.
- `DB_LINK_PERMISSION`: wrong key role or missing grants. Verify the server key first. The migration grants billing table access only to `service_role`; do not grant access to `anon` or `authenticated` or disable RLS.
- `DB_LINK_USER`: the signed-in user is absent from the database used by the server. Check project alignment and sign in again after fixing it.
- `DB_LINK_NETWORK`: no HTTP response from the database. Check availability and retry.
- `DB_LINK_WRITE`: another insert failure. Use Supabase database/API logs to investigate without exposing row data or credentials.

A read-only SQL Editor check for the migration's checkout table and grant:

```sql
select to_regclass('public.shopify_checkout_links') as checkout_table,
       case when to_regclass('public.shopify_checkout_links') is not null
         then has_table_privilege('service_role', 'public.shopify_checkout_links', 'INSERT')
         else false end as service_role_can_insert;
```

## Returning from checkout

Subscribe opens Shopify in a separate browser window/tab and keeps the app open. The app polls its authenticated, uncached `/api/billing/status` endpoint every three seconds for up to twenty minutes. Only an active paid period written by the signed webhook confirms payment. Once confirmed, the app closes the window it opened and navigates to `/account`. The checkout window retains its opener relationship so the app can close it; the server restricts checkout destinations to trusted Shopify/configured checkout hosts. If popups are blocked, the app shows an explicit checkout link. Browser window rules can prevent automatic closing in some environments; the account link remains available. A confirmation timeout does not indicate payment failure and must not encourage a second subscription. No storefront script, checkout-return query parameter or browser callback grants access.

This flow must be verified with a real payment/webhook delivery; browser tests simulate confirmation and do not exercise Shopify payment processing.

## Paid order still shows Free

Fulfilment is separate from payment: membership activates on `orders/paid`, not on fulfilment. Do not place another paid order or manually grant access just to test the integration. Check the real order is Paid, the checkout link exists, and the Order payment webhook targets `/api/billing/shopify/webhook` on Production.

Webhook requests now emit a fixed `shopify_membership_webhook` diagnostic in Vercel runtime logs and return a `WH_` code on failure. No bodies, signing headers, account-link tokens, customer identifiers or raw database messages are logged. No request log usually means delivery did not reach this deployment; confirm URL, topic and delivery history. `WH_VARIANT_IGNORED` indicates a different variant (also expected for Shopify sample/book orders). `WH_TOPIC_IGNORED` means a topic outside paid/refund/cancel.

- `WH_SIGNATURE`: verify `SHOPIFY_WEBHOOK_SECRET` is the signing secret for the registration method. Manually created Settings → Notifications webhooks use the signing secret shown in that webhook section, not the Dev Dashboard client secret. App-created webhooks use the app's matching signing secret. Update Production and redeploy before retrying the real delivery.
- `WH_SHOP`: wrong shop-domain header; only the configured myshopify.com store is accepted.
- `WH_CONFIG` / `WH_NOT_READY`: missing private configuration/readiness.
- `WH_ORDER_TEST_DISABLED`: test order rejected deliberately. Test-mode grants require an isolated test setup; do not enable them on live accounts just to repair a real payment.
- `WH_ORDER_FORMAT` / `WH_ORDER_QUANTITY` / `WH_ORDER_PRICE` / `WH_ORDER_LINK_FORMAT`: signed payload failed the required paid GBP digital membership format, quantity, £1.99 amount or link-token format. Inspect the real delivery privately. Never paste a raw order payload publicly.
- `WH_DB_AUTH` / `WH_DB_SCHEMA` / `WH_DB_PERMISSION`: confirm server key, billing functions/migration, and service-role-only permissions.
- `WH_DB_ACCOUNT_LINK`: the first order has no usable original checkout link (missing, expired or already redeemed). Preserve the original order and checkout rows for investigation. Do not link an account by email alone.
- `WH_DB_PAID_PERIOD` / `WH_DB_CUSTOMER_CONFLICT`: database validation rejected a date or conflicting customer mapping.
- `WH_DB_WRITE` / `WH_INTERNAL`: another database/server failure; inspect server/database diagnostics privately.
- `WH_RECEIVED`: the signed event was processed/acknowledged. Duplicate orders are idempotent; refunded periods remain revoked.

After correcting the cause, retry/resend the **original paid-order delivery** using Shopify's available delivery controls, or wait for its retry when applicable. A generic Send test notification uses a sample order and cannot activate the real customer's membership. Confirm the matching ledger row and subscription before testing return navigation. Historic delivery recovery must not create a fresh paid date or bypass the original account-link validation.

### Shop-domain mismatch

`WH_SHOP` means the webhook's `X-Shopify-Shop-Domain` differs from the expected permanent domain. Public storefront/API aliases can differ from the permanent Shopify identity. Verify the exact permanent `*.myshopify.com` name in Settings → Domains. Set optional Production `SHOPIFY_WEBHOOK_SHOP_DOMAIN` to that hostname only (no scheme, path or wildcard), then redeploy. The API host and existing database `shop_domain` ledger identity stay unchanged, preserving renewal/refund mappings. Do not whitelist a sample or unrelated store just to pass a test.

Signature verification now runs before shop-domain diagnostics. For a signature-verified request only, `WH_SHOP` logs include `expectedShop` and `receivedShop`; only strictly domain-shaped values are recorded, otherwise `missing-or-invalid`. Invalid signatures still record no header values. No mismatch grants access. If no header is present, investigate the delivery mechanism rather than bypassing the check. A sample webhook can verify signature/domain handling but is not evidence that a real payment was applied.
