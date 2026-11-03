# Plain-English bookkeeping — Advanced

`/bookkeeping` is a first native bookkeeping release for sole traders and individual landlords. Creating books, posting entries, reversals, locking periods and signing off reconciliations require an active Advanced subscription **in the database**, including direct RPC callers. Account records are private to their owner. Expired subscribers retain read/export access to their existing books. Public visitors see a feature description; no production sample records are created.

## Enable it

Run **only** `supabase/migrations/202611030001_bookkeeping.sql` once in the existing Supabase SQL Editor, after the existing migrations. It is transactional. It creates five tables and the controlled functions/policies. No Edge Function, service key or new environment variable is needed. Deploying Next.js does not apply SQL automatically. Until migration, the app returns `BOOKS_SETUP_REQUIRED`.

## Start a book

Choose a sole-trader business or one landlord property, its name and its first date. Each property is a separate book; consolidated portfolio/business reports are not included. One bank account and cash-in-hand account are supported per book. Use GBP gross amounts, with accrual bookkeeping: invoices recognise income when recorded; bills recognise costs when recorded. This is not a cash-basis tax-return engine and has no VAT control/returns. VAT-registered businesses need an accountant-reviewed VAT workflow outside this release.

Confirm balances immediately before the start date. The system balances net assets/liabilities to opening owner capital. Starting balances are fixed once confirmed. All-zero balances require explicit confirmation. Opening receivable/payable amounts are control totals; use the opening-receipt / opening-bill-payment actions to clear them without recognising income/expense again. They are not individual aged opening invoices. Choose dates and opening values carefully; there is no opening-balance editing or migration importer in this release.

## Guided records

- Current customer/rent receipts and costs paid now; record the business portion only.
- Unpaid invoice/rent and supplier-bill records with counterparty/reference. These are ledger records, not legal invoice generation or delivery. Select the original when recording a partial or full payment. Paying a bill or collecting an invoice does not recognise the expense/income twice. Outstanding invoices/bills show age since record date, not contractual overdue dates. There are no reminders or credit-note workflows.
- Owner contributions, drawings, loans and mortgage funds actually received into the bank. Borrowing is a liability; drawings reduce equity. For direct-to-solicitor mortgage completions or complex acquisitions, obtain accountant help before entering records.
- Loan/mortgage payments split into principal and interest. Principal reduces the liability, interest enters bookkeeping costs. Repayments cannot exceed recorded principal as of the date.
- Equipment/property purchases from existing recorded funds, a manually calculated depreciation entry, tenant deposit receipts/refunds, and bank/cash transfers. Refundable tenant deposits are liabilities, not rental income. There is no deposit protection, depreciation-policy or tax allowance engine. Depreciation and deposit refunds cannot exceed their recorded asset/liability at the date.

Entries are reviewed locally before explicit posting. The API compiles the guided event into journal lines. Database functions atomically post header/lines and enforce paid access, ownership, dates, locks and balanced journals. Integer pence avoids floating-point journal amounts. Deferred database constraint triggers independently reject empty/unbalanced committed journals. Direct authenticated edits/deletes/inserts to all ledger tables are denied. Posting requests and reversals use unique request IDs for retries.

## Reports and controls

Profit and loss covers the chosen date range. Balance sheet and trial balance include all posted history through the chosen end date, including opening balances and accumulated earlier profits. Bank overdrafts are shown as liabilities. Opening balances do not create current income. Cash movement is net bank/cash movement per event; internal transfers are excluded. Negative reports remain visible. Click P&L account names or trial-balance accounts to inspect the ledger. Money-owed lists use balances as of the report end date. These are **bookkeeping reports, not statutory accounts or taxable-profit calculations**. Landlord finance-cost restrictions/relief, capital allowances, property valuations, owner income tax, VAT, HMRC/MTD submissions and Companies House filing are outside this release.

Correct a posted entry by a full reversal and then record the correct entry. The original is retained. Reverse invoice/bill payments first before reversing the original document. Opening balances and reversal entries cannot themselves be reversed. A correction dated in a later period affects that later period, preserving earlier reports. There is no arbitrary journal editor, partial credit-note wizard or editable posted record.

Reconcile manually against actual bank statements: use the opening bank balance for the first check and the previous signed-off closing balance thereafter. Tick bank entries, enter the closing balance and confirm only a zero difference. No entry can be matched twice, and selected entries must belong to this book and fall on/before the statement date. Unmatched older entries remain outstanding and can clear on a later statement. New bank entries cannot be backdated into a reconciled period. Statement sign-offs cannot be removed in this release. No bank feed, statement CSV import or automatic matching is included.

Period locks are forward-only. Once locked, no journal can be dated in that period. There is no unlock action. Owners must check reports and bank statements first. The latest 100 control events are shown; all posted journals remain in the exported ledger. Limits are 20 books per account and 5,000 journal entries per book.

CSV ledger and complete-book JSON exports remain available after expiry. JSON is not an import format. Print/save-PDF displays the current report dates; CSV/JSON include the whole book. No receipts/attachments, multi-user permissions, multi-currency, bank integrations, payroll or tax filing are claimed. These require subsequent separate work.

## Validation

Engine tests check double entry, profit/cash differences, owner movements, borrowing, mortgage principal/interest, deposits, unpaid documents, partial payments, prior-period equity, overdrafts, transfers, reversals, dates, penny validation and safe CSV. PostgreSQL/PGlite tests execute the migration and verify subscription enforcement, isolation, direct-write denial, balance constraints, duplicate retries, locks, reconciliation and overpayments. API tests verify the server builds trusted lines and rejects forged fields. Browser tests bundle the real UI with a local test-only API fixture; no auth bypass is shipped. Production multi-account sign-in, real statement checks and accountant review still require the deployed migration and actual users.
