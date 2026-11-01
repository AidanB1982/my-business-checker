# My Business Checker

A Next.js App Router + TypeScript foundation for clear UK small-business calculators and guides. Core tools are free; Advanced is planned at **£1.99/month**.

## Development

Node.js 24 recommended (minimum 22).

```sh
npm ci
cp .env.example .env.local
# Set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY in .env.local or environment settings.
npm run dev
```

The public site runs without Supabase credentials. Accounts require a publishable key, configured auth redirects, and the database migration. See [Supabase setup](docs/SUPABASE.md).

```sh
npm run lint
npm run typecheck
npm test
npm run build
npx playwright install chromium
npx playwright test
```

## Structure

- `src/app/`: homepage, tools, guides, pricing, account, email authentication, informational pages and health endpoint.
- `src/components/`: shared tool finder and client-side calculator preview.
- `src/lib/calculators/`: pure engines with explicit rule snapshots; no database dependency.
- `src/lib/supabase/`: browser and server clients. `src/proxy.ts` refreshes account/auth session cookies.
- `src/content/`: tool catalogue and supporting draft guides.
- `supabase/migrations/`: account, subscription, saved-calculation and immutable rule-set schema with row-level security.
- `tests/`: calculation boundaries, tax/NI fixtures, entitlement checks, PostgreSQL RLS and browser journeys.

## Installable app

The app includes a web manifest, phone icons, standalone mode, installation guidance and a static offline screen. It must be hosted over HTTPS for phone installation. Offline support does not store financial inputs, account pages or tax rules. An already open calculator can continue calculating locally. See [deployment instructions](docs/DEPLOYMENT.md).

## Implemented versus planned

The responsive app structure, five tool routes, five introductory guides, pricing, email-link auth code, account shell and Supabase schema are implemented. The mileage preview defaults to **2026/27** (55p for the first 10,000 miles, then 25p, based on supplied HMRC guidance) and retains **2025/26** (45p, then 25p). Both rate tables match the supplied HMRC extract updated 21 May 2026. The tool remains a preview; live-page retrieval is not claimed. The self-employed tax preview calculates business profit, incremental Income Tax, Class 4 NI, take-home and a monthly set-aside for England, Wales, Northern Ireland and Scotland using separate draft 2025/26 and 2026/27 snapshots. Scottish starter, basic, intermediate, higher, advanced and top bands match the supplied GOV.UK extract; Class 4 NI stays UK-wide. The Scottish band tables were reviewed against the user-supplied GOV.UK text on 1 November 2026; remaining UK-wide rule review is pending. The exclusions shown in the interface remain unsupported. The other three calculators show development notices until their engines are ready. Guides/legal copy also require publication review. No tracking scripts or financial-input persistence are enabled.

Subscription checkout, billing webhooks, saved calculations, report exports, scenario comparisons, Google sign-in and HMRC integration are future work. The app does not collect payments. The project URL is configured, but live Supabase authentication and schema access must be verified after setup.

The preview disallows search-engine crawling via `robots.ts`. Update robots, production origin, legal/operator details, reviewed rules and official sources before launch. A GitHub Actions workflow checks lint, types, tests, build and browser journeys. No deployment or environment publication is automated.

Use the existing checkout in each isolated cloud task; no additional Git worktree is needed. Run `npm run dev` for development or `npm run build` followed by `npm run start` for production-mode validation. Live servers must be restarted in future tasks.
