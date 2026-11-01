# Native sole-trader and landlord sections

## Source and adaptation

The owner supplied nine workbooks plus `Accounting_for_UK_Landlords_Formatted.docx` and `Accounting_for_UK_Sole_Traders_Formatted.docx`, and explicitly requested their format be used for new app sections rather than distributing the actual files. Selected record-keeping explanations and working structures were adapted into original short app lessons and focused forms. Whole manuscripts, workbooks, extracted manuscript text and reader-download bundles are not committed or served by the app.

The reusable reading pattern is: explanation → small worked example → revealable working/answer → practical checks → related working area. The property reserve structure comes chiefly from the uploaded asset/lifecycle workbook; its user assumptions are not statutory compliance dates. The supplied educational tax examples were not promoted into a universal tax model. Existing tax engines retain their current source-review labels.

## Routes and access

- `/sole-traders`: monthly working, existing tax/mileage/VAT links and four adapted lessons.
- `/landlords`: rent controls, reserve planning, MTD and five adapted lessons.
- `/learn/[slug]`: four free lessons and five Advanced lessons. Paid bodies come from a server-only content module and are rendered only after checking the signed-in user's active paid period. An expired, missing or failed plan check never sends the protected body to the browser. Public summaries/titles remain visible.
- `/tools/sole-trader-working-sheet`: browser-local monthly records summary.
- `/tools/landlord-rent-reconciliation`: browser-local rent and agent statement control.
- `/tools/property-maintenance-reserve`: browser-local 5/15/30-year component reserve scenario.

Navigation, homepage, account, guides, pricing and sitemap link the new routes. Premium lessons retain their safe `/learn/<slug>` destination through the existing HTTP-only email sign-in return cookie; external URLs, queries, escapes and path traversal are not accepted. No Supabase callback URL changes are needed.

All three working areas calculate free. Saving requires existing Advanced access and explicit consent; the server recalculates the canonical snapshot. Existing same-tool comparison, read/export/delete permissions and record ownership checks remain. No migration or new environment variable is needed. These summaries are not a complete operational ledger or auto-import feature.

## Working calculations

### Sole trader: `records-1`

- Receipts = money received − customer refunds.
- Business share per cost = full cost × entered business percentage, rounded per line to a penny.
- Operating working = receipts − business shares. Eligibility, capital allowances and final taxable profit are not decided here.
- Planned reserve = chosen percentage × positive operating working; zero if the working is negative.
- Period cash movement = receipts − all full entered costs − drawings − planned reserve. The private share of mixed costs is deducted from cash too. No opening cash, funding or other transfers are included.
- Unpaid invoices are a separate control. Drawings do not reduce the operating working.
- The monthly reference-year label places April in the year starting that April. Both monthly tools explain that exact 1–5/6 April transaction dates are still required for annual tax reporting.

Fixture: receipts £3,000; materials £300 at 100%; phone £60 at 50%; drawings £500; reserve 25%. Business shares £330, operating working £2,670, planned reserve £667.50, cash movement £1,472.50. This is not a tax computation.

### Landlord: `rent-controls-1`

- Closing arrears = opening arrears + current rent due − collections applied to those obligations.
- Future-period advance collections are separate and cannot be used to create negative arrears.
- Agent control = opening funds + gross collections including identified advances − agent fees − other agent-paid costs − remittances.
- Difference = expected closing agent funds − entered statement closing funds.
- Signed opening/closing balances support amounts owed to the agent. All collections in this form are through one agent for one property and month. Refundable security deposits and direct-bank receipts are outside this control.

Fixture: opening arrears £200, rent due £1,000, applied collections £900, advances £300. Closing arrears £300; gross cash £1,200. With agent opening £100, fees £120, costs £80, remittance £1,000 and actual closing £100, the agent difference is zero. This does not establish rental taxable profit or validate every line's classification.

### Property reserve: `property-reserve-1`

The calendar-year horizon includes the start year and begins on 1 January. Opening reserve means the balance expected on that date; partial current years are not modelled. Each scheduled event uses current cost × (1 + inflation)^(event year − start year) × (1 + contingency), rounded to pence. Repeat interval zero means one event. Later repeats are counted only inside the chosen horizon. Overdue first dates require an explicit decision to bring work into the current planning year.

All work falls at the beginning of its year, before that year's monthly contributions. Show:

- Average contribution = positive (all projected spending − original reserve) / horizon months, rounded up; it ignores timing.
- Timing contribution = maximum positive cumulative shortfall / months contributed before each later-year bill, rounded up. This uses the original reserve and assumes no extra first-year top-up.
- Immediate funding = first-year spending exceeding the original reserve.
- Actual scenario shortfall = largest negative balance immediately after a year's work under the user's entered contribution.
- Closing balance = original reserve + all scenario contributions − all scheduled work.

Fixture: £1,000 held, £4,000 work at the start of the first year, £100/month, five years, zero inflation/contingency. Immediate need £3,000; average contribution £50/month; eventual closing reserve £3,000. The average and positive ending balance do not remove the £3,000 immediate shortfall. No reserve interest, borrowing, investment return, statutory due dates or tax deductibility is inferred.

## Verification

Unit coverage includes classification, negative operating results, signed agent balances, future advances, over-allocation rejection, immediate reserve gaps, later-year timing, repeated events, horizons, inflation/contingency, penny rounding, invalid inputs and validated reports. Access tests cover public reading, active Advanced access, expired/inactive plans, missing configuration and failed plan checks without sending protected bodies.

Browser checks exercise native-section discovery, monthly working, stale-result invalidation, rent controls, reserve shortfalls, mobile overflow, free worked-example reveals, and anonymous premium access. Live customer data and source files are not imported by these checks.
