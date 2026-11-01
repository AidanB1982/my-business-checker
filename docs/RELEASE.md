# App release status

The repository contains a Next.js app. It is not yet a native iOS/Android package. It has not been submitted to either app store. The installable web app now includes a manifest, PNG icons (including Apple and maskable sizes), standalone launch metadata, installation guidance and a service worker with an offline screen. It still needs a hosted HTTPS origin for phone installation. Only the static offline screen is cached; authenticated pages, API responses, financial data and rule sets are not cached. New worker versions activate after existing app windows are closed; normal online navigation always fetches current content.

## Self-employed calculator

The calculator runs locally in the browser with separate draft 2025/26 and 2026/27 rules, and covers England, Wales and Northern Ireland. Scotland is explicitly blocked. Results show annual business take-home, monthly take-home, incremental Income Tax attributable to business, Class 4 NI, and a monthly set-aside. Tax on other non-savings income is shown separately in the explanation.

Unit fixtures cover allowance and NI thresholds, allowance taper, additional-rate income, other income, losses, money precision, region guards and year/version isolation. Browser tests cover the main result, tax-year changes, Scottish guard, local-only calculation and mobile layout.

The rule snapshots remain **draft / source review pending**. Expected test values validate the implementation against the drafted rates, not independent HMRC verification. Official current and historical tables must be checked and recorded before removing the preview label. No verified date is invented.

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
