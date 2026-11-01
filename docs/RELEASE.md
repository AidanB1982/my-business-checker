# App release status

The repository contains a Next.js app. It is not yet a native iOS/Android package. It has not been submitted to either app store. The installable web app now includes a manifest, PNG icons (including Apple and maskable sizes), standalone launch metadata, installation guidance and a service worker with an offline screen. It still needs a hosted HTTPS origin for phone installation. Only the static offline screen is cached; authenticated pages, API responses, financial data and rule sets are not cached. New worker versions activate after existing app windows are closed; normal online navigation always fetches current content.

## Self-employed calculator

The calculator runs locally in the browser with separate draft 2025/26 and 2026/27 rules, and covers England, Wales, Northern Ireland and Scotland. Scottish tables are separate for each tax year; Class 4 NI remains UK-wide. Results show annual business take-home, monthly take-home, incremental Income Tax attributable to business, Class 4 NI, and a monthly set-aside. Tax on other non-savings income is shown separately in the explanation.

Unit fixtures cover allowance and NI thresholds, allowance taper, additional-rate income, other income, losses, money precision, region guards and year/version isolation. Browser tests cover the main result, tax-year changes, Scottish region/year changes, local-only calculation and mobile layout.

The rule snapshots remain **draft / source review pending**. Scottish rate tables match the supplied GOV.UK text; the remaining UK-wide rates are draft. Expected test values validate the implementation against these rates, not independent live-page retrieval. Official current and historical tables must be checked and recorded before removing the preview label. No verified date is invented.

The user has authorized a GitHub update. A GitHub push publishes source code, not an installable app. The user selected an installable web app. Hosting must be configured before it can be distributed; no app-store submission is needed. See docs/DEPLOYMENT.md.

## Before a public release

- Verify the exact HMRC Income Tax and Class 4 tables for each supported year, and review the assumptions and rounding.
- Confirm target/distribution, production app origin and auth callbacks.
- Add operator/contact/privacy details; draft legal copy is not launch-complete.
- Run real email sign-in and account isolation checks against production Supabase.
- Retain current preview notices for unfinished tools, billing and Advanced features.
- Do not expose .env.local or secret credentials in GitHub. No accounts, payments or releases are fabricated.

## Mileage correction — 1 November 2026

The user initially supplied Xero text and then supplied an HMRC extract from https://www.gov.uk/government/publications/rates-and-allowances-travel-mileage-and-fuel-allowances/travel-mileage-and-fuel-rates-and-allowances, headed “Travel — mileage and fuel rates and allowances”, updated 21 May 2026. The extract lists 2026/27 cars/vans at 55p for the first 10,000 miles and 25p thereafter, and rates from 2011 to 2026 at 45p/25p. Both snapshots were checked against that supplied primary-source extract on 1 November 2026. No independent live-page retrieval is claimed. The HMRC URL is now the source for both snapshots; the full article is not copied into the repository. 12,000 miles gives £6,000 for 2026/27 and £5,000 for 2025/26. Tests check both years and clear stale results when the year changes. The scope remains a sole-trader expense preview; this does not implement employee reimbursement, mileage allowance relief, company-car rates or passenger payments.

## Scottish Income Tax — 1 November 2026

The user supplied the current and prior-year table from https://www.gov.uk/scottish-income-tax. The snapshots are draft-2 and include separate Scottish cumulative taxable-income bands. With the standard £12,570 allowance, 2025/26 gross boundaries are £15,397, £27,491, £43,662, £75,000 and £125,140; 2026/27 boundaries are £16,537, £29,526, £43,662, £75,000 and £125,140. Rates are 19%, 20%, 21%, 42%, 45% and 48%. Lower thresholds are converted to taxable-income limits by subtracting the standard allowance. The top-rate threshold works with the tapered allowance (zero by £125,140). The source is a supplied primary-source extract, not independently fetched content.

For £72,000 income and £14,000 expenses with no other income, the Scottish business take-home estimates are £43,209.60 (2025/26) and £43,241.35 (2026/27), with the same £2,416.60 Class 4 NI in both years. Tests cover every band boundary, the next pound, the allowance taper, region/year isolation and incremental business tax with other income. Savings/dividends, pension relief, student loans and the existing exclusions are unchanged.

## Full-toolbox and Advanced update — 1 November 2026

All five tools now have working preview forms/results. Added VAT rolling/future tests, MTD reference-year checks, company-budget salary/dividend comparison, relief-at-source pensions, student/postgraduate estimates with repayment offsets, and payments-on-account cash timing. Self-employed snapshots are draft-3; earlier supplied Scottish/mileage provenance is retained. Newly added financial rules require official review.

Advanced saving, reopening, same-tool comparisons and HTML/CSV export are implemented with RLS and server recalculation. Supabase paid-order tables are added in migration `202611010002_shopify_membership.sql`, not applied remotely. Shopify replaces the proposed Stripe integration. Checkout stays disabled without the server configuration and operator-ready flag. The supplied product still allowed one-time purchases; change to subscription-only and verify a real recurring order/webhook before selling memberships. Local tests do not establish live store connectivity or paid customer access.

## Salary checker and pension projection

Two additional free tools are implemented: `/tools/salary-take-home-calculator` and `/tools/pension-pot-predictor`, with guides, discovery links and Advanced snapshot/report support. The salary estimate uses twelve equal monthly NI/loan calculations and annual tax planning for both years and all four regions. Net pay, relief at source and salary sacrifice are separate methods. The projection is a defined-contribution scenario with flat salary by default, month-end contributions and editable growth/fee/inflation assumptions, not an annuity or State Pension forecast. No new Supabase migration or credentials are required for these tools. See `docs/SALARY-PENSION.md` for limitations and formulas.

## Workspace and visual redesign

The site now shares a new green/white design system, SVG icons, active navigation and a direct workspace entry. The homepage includes an explicitly illustrative salary example calculated with the existing salary engine, not a customer result; decorative bars are labelled illustrative. The calculator catalogue adds category filters combined with text search and a resettable empty state.

The authenticated workspace now shows the real saved-calculation count, current plan and paid-access end date, with calculator shortcuts, saved-work selection, membership management and existing payment recovery. Record counts display Unavailable on errors rather than a fabricated zero. Saved report/CSV access and deletion remain available for existing records after membership expires; new comparisons retain the existing Advanced check. Pricing, sign-in, guides, inputs and result panels share the new responsive presentation. Mobile inputs use 16px text, focus indicators and reduced-motion support remain, and no new database migration, financial rule or billing API changes are introduced.

Validation includes all calculator/API/database tests, browser checks for category/search combinations, mobile overflow, sign-in routing and mocked confirmed-payment return. Desktop and mobile account layouts were visually inspected with a local fixture rather than a production session. No live payment was made during design verification.
