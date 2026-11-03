# Accounting review pack — external sign-off pending

Status: software checks are implemented; an independent accountant has **not** signed off this package. Do not describe it as independently approved. Commission a UK accountant with sole-trader and residential-landlord experience before launch and retain their written findings, corrections and final acceptance.

## Reproducible review case

Run `npx vitest run tests/unit/bookkeeping-premium.test.ts`. It creates a new real PostgreSQL-compatible database, applies the migrations, posts through the actual RPCs, exports, restores into a second fresh database and compares every exported row. It checks these manually calculated figures; expected figures are constants rather than outputs copied from the calculation under test.

All amounts below are GBP, January 2026, non-VAT registered, accrual bookkeeping:

| Event | Amount | Treatment |
| --- | ---: | --- |
| Opening bank | 10,000 | Asset |
| Opening equipment | 2,000 | Asset |
| Opening property | 150,000 | Asset |
| Opening mortgage | 100,000 | Liability |
| Opening supplier account | 500 | Liability, allocated to supplier |
| Opening owner balance | 61,500 | Balancing equity |
| Owner contribution | 1,000 | Capital, not sales |
| Customer invoice | 2,400 | Sales and receivable |
| Customer part payment | 1,000 | Bank and receivable |
| Supplier invoice | 600 | Repairs and payable |
| Supplier part payment | 200 | Bank and payable |
| Insurance paid | 120 | Expense |
| Mortgage payment | 750 | 500 principal, 250 interest |
| Drawings | 400 | Owner balance, not expense |
| Equipment purchase | 900 | Asset |
| Equipment depreciation | 100 | Expense and asset reduction |
| Loan received | 2,000 | Liability, not income |
| Refundable tenant deposit | 500 | Liability, not rent |
| Bank-to-cash transfer | 100 | Internal transfer, no income/cost |

Expected closing amounts: bank **12,030**, cash **100**, equipment **2,800**, property **150,000**, customer debt **1,400**, supplier debt **900**, mortgage **99,500**, loan **2,000**, refundable deposits **500**. Profit **1,330**; assets **166,330**; liabilities **102,900**; equity **63,430**. External money in **4,500**, out **2,370**, net movement **2,130**. Bank statement signed off at 12,030, period locked through 31 January. Customer invoice retains its original blue branding after the current profile changes to red. One deduplicated logo is preserved, without copying a blob into every invoice.

## Accountant review scope

Review sole-trader sales and landlord rent independently (the review fixture above combines transaction classes to exercise posting mechanics). Inspect invoice-date recognition, period cutoffs and earned/incurred versus advance invoices; opening debts and later settlement; partial payments and correction/reversal dates; deposits; capital versus repairs; mortgage principal versus interest; depreciation; assets and negative balances; annual carry-forward; bank reconciliation; report/export agreement; and issued invoice numbering and required non-VAT details. Repeat with split payments, overpayments rejected, reversals before/after cutoff, and cross-period statements. Existing engine, database and invoice tests cover these mechanics; accounting suitability requires human review.

The package does **not** calculate taxable profit, VAT controls/returns, capital allowances, landlord finance-cost tax relief or HMRC submissions. It does not support statutory company accounts, inventory, payroll, multiple bank accounts within a book or automatic bank feeds. Determine whether accrual bookkeeping is appropriate for each customer; do not imply that these reports select their tax basis or fulfil MTD obligations.

## Acceptance record

- Reviewer name, qualification and date: **pending**
- Reviewed commit and migrations: **pending**
- Sole-trader and landlord findings: **pending**
- Corrections and retest evidence: **pending**
- Written acceptance, limitations and launch decision: **pending**
- Hosted disaster-recovery rehearsal: see BOOKKEEPING-RECOVERY.md; **pending operator rehearsal**
