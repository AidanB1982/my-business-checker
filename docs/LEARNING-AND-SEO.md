# Workspace, learning and public search

## Database setup

Apply `supabase/migrations/202611050001_learning_progress.sql` after the initial schema. It adds a free workspace-focus preference to the existing own-account profile and private learning progress. No new credentials are needed. Saved progress writes require current Advanced access in both the API and the SQL grading function. Existing progress remains readable and deletable after expiry. Direct table writes and other users' reads/deletes are denied.

The SQL grading keys and the published question definitions are tested for agreement. A revised question needs an updated version in both places; old completion versions do not count towards the current path. Do not treat these educational checks as qualifications or verified professional competence.

## User journeys

- `/account` shows recent saved calculations, assigned unfinished project tasks, unfinished book opening balances and draft invoices under the existing RLS rules. It does not imply that every draft should be posted or that completing a task changes accounting records.
- Users can prioritise Sole trader, Landlord or Personal finances. This saves to their account and reorders the workspace sections and learning paths without hiding other sections.
- `/learn` offers three ordered paths with 15 short lessons. Public lessons and checks remain free. Existing Advanced lesson bodies remain server gated. Advanced saves passed checks across devices.
- Every tool has a curated worked-example loader. It replaces entries and clears the result, but never auto-submits, ticks eligibility/consent statements or saves values. All examples are fictional and use the existing calculation engine.
- Result next steps link to an explanation and a practical next action. Figures are not copied into a new financial record automatically.
- Salary student-loan inputs sit under **More details: student loans**. Other calculators retain their existing optional pension, tax-payment and projection sections. Required confirmations remain visible.
- Graph explanations and original workings describe what each measure represents; they are not a replacement for official guidance or technical review.

## Technical SEO changes

The earlier `robots.txt` blocked every page. Public production pages can now be crawled when `NODE_ENV=production`, the configured site URL uses HTTPS and `VERCEL_ENV` is not `preview`. Development, HTTP-only builds and Vercel previews stay blocked/noindex. Keep `NEXT_PUBLIC_SITE_URL` set to the canonical public origin (`https://my-business-checker.vercel.app` until a permanent domain is chosen), without a path.

The sitemap includes public tools, guides, learning paths, lessons and four substantial topic pages. It excludes accounts, APIs, private bookkeeping and project workspaces. Private routes retain authentication/RLS and noindex protection; robots is not an access-control mechanism. Query parameters do not get their own canonical URLs.

Each tool, guide, topic, path and main public page has a unique description and canonical. Pages connect related guides, examples, lessons and tools. Structured data describes the actual website, articles, breadcrumbs, learning lists and free calculator applications. It does not invent ratings, reviewers, qualifications or guaranteed rich results. A generated social image supports shared links. Images and interactive widgets are not required to read the public core content.

## Google Search Console — owner action required

No Search Console account or verification token is available in this workspace, so ownership verification and sitemap submission cannot be completed here.

1. Open https://search.google.com/search-console and add the public HTTPS site as a URL-prefix property, or verify your permanent domain using DNS if you have one.
2. Choose HTML-tag verification. Put only the supplied `content` token into the Vercel production variable `GOOGLE_SITE_VERIFICATION`. Redeploy and click Verify. For a domain property, follow Google's DNS verification instead.
3. Submit `https://my-business-checker.vercel.app/sitemap.xml` (or your permanent origin).
4. Inspect the homepage, a tool, a guide and a topic URL. Check Google's chosen canonical, rendered page and indexing status. Request indexing where appropriate.
5. Review clicks, impressions, queries, indexing issues and Core Web Vitals after Google gathers data. Do not assume deployment creates immediate indexing or rankings.

`/api/health` exposes only whether public indexing and a verification token are configured; it does not test Google ownership or search performance. Vercel preview URLs must not become the production canonical. Use one preferred public domain and redirect aliases in Vercel.

## Content and performance review

New topic pages cover sole-trader bookkeeping, landlord records, salary/pensions and project planning. Existing official source links and tax-year controls remain visible. Visible editorial panels distinguish the 5 November 2026 content update from the still-pending independent technical review. Draft/technical-review notices are preserved; no independent review or fresh official-source verification is claimed. Before describing material as reviewed, record an actual qualified review, reviewer identity, date, scope and rule version. Keep public operator/contact/privacy information current before a wider launch.

Production build and browser checks cover server-rendered content, mobile overflow, metadata, examples, result invalidation, progress and paywall boundaries. A desktop browser test is not a substitute for field Core Web Vitals; use Search Console and PageSpeed Insights on the deployed public site for real performance assessment. The cloud network does not currently allow checking the live Vercel site.
