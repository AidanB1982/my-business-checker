# App release status

The repository contains a Next.js app. It is not yet a native iOS/Android package. It has not been submitted to either app store. An installable web app would require a manifest, icons, a secure hosted origin and offline/update behaviour; these are not claimed as implemented.

## Self-employed calculator

The calculator runs locally in the browser with separate draft 2025/26 and 2026/27 rules, and covers England, Wales and Northern Ireland. Scotland is explicitly blocked. Results show annual business take-home, monthly take-home, incremental Income Tax attributable to business, Class 4 NI, and a monthly set-aside. Tax on other non-savings income is shown separately in the explanation.

Unit fixtures cover allowance and NI thresholds, allowance taper, additional-rate income, other income, losses, money precision, region guards and year/version isolation. Browser tests cover the main result, tax-year changes, Scottish guard, local-only calculation and mobile layout.

The rule snapshots remain **draft / source review pending**. Expected test values validate the implementation against the drafted rates, not independent HMRC verification. Official current and historical tables must be checked and recorded before removing the preview label. No verified date is invented.

The user has authorized a GitHub update. A GitHub push publishes source code, not an installable app. Select the distribution target before deploying: installable web app (hosted Next.js) or native mobile app (a separate mobile shell/client using the pure engines and Supabase).

## Before a public release

- Verify the exact HMRC Income Tax and Class 4 tables for each supported year, and review the assumptions and rounding.
- Confirm target/distribution, production app origin and auth callbacks.
- Add operator/contact/privacy details; draft legal copy is not launch-complete.
- Run real email sign-in and account isolation checks against production Supabase.
- Retain current preview notices for unfinished tools, billing and Advanced features.
- Do not expose .env.local or secret credentials in GitHub. No accounts, payments or releases are fabricated.
