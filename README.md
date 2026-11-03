# My Business Checker

An installable Next.js/TypeScript app for UK small-business estimates. Core tools are free; Advanced is £1.99/month with Shopify recurring billing when configured.

## Development

Advanced also includes [plain-English bookkeeping](docs/BOOKKEEPING.md) at `/bookkeeping`, with guided setup, profit and loss, balance sheets, monthly health checks, branded customer invoices, manual bank reconciliation, construction projects and equipment depreciation, accountant ZIP packs and portable backups. Apply the bookkeeping migrations in the documented order before use. See the [accounting review pack](docs/ACCOUNTING-REVIEW.md) and [restore runbook](docs/BOOKKEEPING-RECOVERY.md); independent sign-off and hosted recovery rehearsal remain pending. It is an accrual bookkeeping workspace, not a VAT/tax-filing package.

Node.js 24 recommended (minimum 22).

```sh
npm ci
cp .env.example .env.local
# Set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY for accounts.
npm run dev
```

The calculators run locally without an account. Email/password sign-in, registration and password resets use the configured Supabase project. Existing email-link users can set their first password through Forgot password. See [Supabase setup](docs/SUPABASE.md), [deployment](docs/DEPLOYMENT.md) and [Shopify billing](docs/SHOPIFY.md).

The signed-in `/account` workspace starts with expandable section tiles for sole traders, landlords, projects, bookkeeping, calculators and guides. **Colours & graphs** offers Forest, Ocean, Plum, Warm cream, Pale sky and Soft rose app themes with independent chart palettes, saved locally on the browser under `mbc-appearance-v1`. Preferences do not sync between devices or affect calculations, invoice branding or PDF exports; no SQL migration is needed.

Shared **Projects & tasks** are available at `/projects`: workspaces, boards, milestones, deliverables, discussions, weekly workload and team permissions. Owners need Advanced; invited teammates participate under that workspace plan. Apply the new project SQL migration once before use; see [project setup and features](docs/PROJECTS.md).

```sh
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npm run test:e2e
# Or use preinstalled Chromium:
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

## Implemented tools — development previews

- **Self-employed tax:** separate 2025/26 and 2026/27 rules for England, Wales, Northern Ireland and Scotland; profit, marginal business Income Tax, Class 4 NI, take-home and a monthly set-aside. Net relief-at-source pensions, one undergraduate student loan plus postgraduate loan, prior repayments and a separate Self Assessment/payments-on-account cash estimate are supported within the displayed assumptions.
- **VAT:** twelve monthly taxable-turnover entries and a separate next-30-days-alone test. It does not establish the first date of a historic breach or cover every exception.
- **MTD:** reference-year gross self-employment/property income, scheduled thresholds, exemption uncertainty and existing obligations.
- **Salary/dividends:** same company-budget comparison including employer NI, annual director employee NI, Corporation Tax/marginal relief, associated-company thresholds, personal tax and dividends. Employment Allowance requires explicit eligibility confirmation.
- **Salary take-home:** monthly payroll planning with student/postgraduate loans, salary sacrifice, net-pay pensions and relief at source (gross percentage or actual cash percentage). Employer contributions are shown separately; additional RAS tax relief is not silently credited to payslip take-home.
- **Pension pot:** current salary/pot, employee/employer percentages, contribution basis and target age; flat salary by default, editable growth/fees/inflation, a no-growth baseline, year-by-year chart/table and illustrative gross withdrawals. No State Pension or guaranteed income.
- **Mileage:** defaults to 2026/27 at 55p for the first 10,000 miles then 25p; preserves 2025/26 at 45p/25p. An expense estimate, not a tax saving.

Scottish and mileage rate tables match the primary-source extracts supplied by the owner. Newly added rules retain draft/source-review labels. Tests verify the drafted calculations and boundaries, not independent current HMRC validation. Pensions exclude MPAA, annual-allowance taper/carry-forward and salary sacrifice; loans exclude remaining-balance caps and multiple undergraduate plans. Read each result's assumptions.

## Native sole-trader and landlord sections

`/sole-traders` and `/landlords` adapt the supplied Blackwood Publishing books/workbooks into native working areas and ten lessons (five free, five Advanced). No original DOCX/XLSX files are distributed. `/learn/[slug]` checks premium access on the server and preserves a safe lesson destination through sign-in.

The native sections include three free working areas: sole-trader monthly working, landlord rent/agent reconciliation, and property maintenance reserve planning. Advanced users can save canonical snapshots, compare matching tools and export the existing reports. These are focused workings, not complete bookkeeping ledgers, rental-tax engines or compliance certification. See [native section scope](docs/NATIVE-SECTIONS.md).

A rental-yield and mortgage planner brings the catalogue to eleven: gross/effective/net operating yields, repayment or interest-only borrowing, first-year cash flow, cash invested/return, break-even metrics, a higher-rate scenario and a mortgage schedule. See [rental planner assumptions](docs/RENTAL-YIELD.md).

## Advanced workspace

Active subscribers can explicitly save named financial inputs/results, reopen snapshots, compare two saved calculations from the same tool across years and download CSV or self-contained HTML reports (printable to PDF). The save API recalculates on the server; it never trusts a browser total. RLS and server checks restrict each user's data and paid writes. Expired users can still read/export/delete their own records. No ordinary calculation is automatically stored.

## Shopify integration status

The owner selected `blackwoodpublishing.myshopify.com` and supplied product/plan JSON. Default membership variant `60314386301273`, selling plan `697055314265`, price £1.99 monthly.

The checkout adapter, raw-body HMAC verification, atomic paid-order ledger, duplicate suppression, renewal mapping, expiry and refund/cancellation reversal are implemented and locally tested. Checkout is **disabled** until server credentials, the billing migration, subscription-only/tax settings and real Shopify webhook/order tests are complete. Source pushes do not establish a working paid subscription. See [required setup and limits](docs/SHOPIFY.md). No Stripe integration is used.

## Structure

- `src/app/`: public tools/guides/pricing, account/saved/compare pages, auth, owned-record APIs and Shopify checkout/webhook routes.
- `src/lib/calculators/`, `src/rules/`: pure engines and versioned rules.
- `src/lib/reports/`: reproducible metrics, safe HTML/CSV export.
- `src/lib/shopify/`, `src/lib/supabase/`: server billing, trusted checkout linking, browser/server clients.
- `supabase/migrations/`: original account/RLS schema and the new private Shopify billing migration.
- `public/sw.js`: only the static offline screen is cached; no account pages, financial inputs or tax rules.
- `tests/`: calculator boundaries, real embedded-PostgreSQL RLS/ledger tests, API/signature checks and browser journeys.

The installable app needs HTTPS hosting and real-phone testing. GitHub Actions runs checks; Vercel deployment is separate. Keep preview labels and crawler restrictions until official rule review and operator/privacy/contact details are completed. Accounts/payments are never fabricated for tests.

Use the existing checkout in each isolated cloud task; no extra Git worktree is needed. Processes must restart in future tasks. Start with `npm run dev` or build and run `npm run start` for production-mode checks.

Project descriptions, subprojects, Gantt-style dates, budgets and private linked asset costs are documented in [Projects and assets](docs/PROJECT-ASSETS.md), including migrations 005 and 006.
