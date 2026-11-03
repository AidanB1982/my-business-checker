# Subprojects, construction costs and depreciation

## Deploy

Apply these new migrations once, in order, in Supabase SQL Editor:

1. `202611030005_project_hierarchy.sql`, after `202611010003_project_workspaces.sql`.
2. `202611030006_construction_assets.sql`, after bookkeeping migrations 001–004.

No new keys, service roles, storage buckets or scheduled jobs are needed. Deploying Next.js does not run SQL. Existing projects become standalone/main projects with zero budgets and commitments. Existing journals and invoice amounts are not rewritten.

## Planning

Projects retain a free-text name and description. Choose an optional main project to create one level of subprojects; there are no preset kitchen/roof/bathroom categories. A main project's task focus, progress and budget include its children. Budget and unspent commitments on each row describe that row's own work; children are added once. Top-level budget cards exclude other top-level projects. Do not enter the entire group budget on the parent and repeat it on the children.

Tasks retain owners, dates, dependencies, milestones, discussions and checklists. Timeline now includes dated main/subproject bars as well as tasks and milestones, marking overdue work and naming task dependencies. It is a Gantt-style view of entered dates: rescheduling one task does not shift others automatically. Parent planning completion requires its own tasks and subprojects to be complete. Reopen the parent before adding unfinished work under it. Project budgets and progress are shared according to existing owner/editor/viewer permissions.

Unspent commitments are manual planning amounts for orders not yet recorded as costs. Reduce them as costs enter the books, otherwise the forecast deliberately counts both the commitment and the recorded cost. The owner sees budget less assigned costs and remaining commitments. Bookkeeping figures are owner-only; invited editors/viewers do not receive the owner's book, invoice, cost or asset data.

## Bookkeeping project costs

Open Bookkeeping → Projects & assets, choose the correct business/property book, and create a cost project. Optionally link a project in a planning workspace you own. Create cost subprojects under the corresponding cost parent. Hierarchy and planning links are fixed after creation. Names/descriptions are retained independently of planning deletion. An unlinked cost child contributes to its linked financial parent's planning figures; a separately linked child contributes to its own planning project. Planning rollups then include those rows once.

A planning status change never posts a journal. Review capital-versus-repair treatment separately; the label “Kitchen” alone does not decide it.

- Existing paid purchases or supplier bills: assign one complete unreversed entry with one debit category. Repair/running-cost allocation changes project metadata only. Capital allocation posts debit construction, credit the original cost/asset category on the chosen allocation date. It does not repeat the bank payment or create another payable. Later bill settlement changes bank/payable only and does not add project cost.
- New capital payment: use only if the payment is not already in the books. It posts debit construction, credit bank/cash once. Describe what the payment was for.
- Multi-category or mixed invoices need separate records/accounting review; this release does not split a single invoice among projects. Equipment that already has legacy manual depreciation cannot simply be moved at its original purchase price; request an accountant-reviewed carrying-value adjustment.
- Before completion, Reverse / unassign cost reverses a new construction payment or a capital reclassification, keeping the original visible. Removing an expense allocation leaves the original purchase untouched. Locked/reconciled periods remain protected. Generic ledger reversals of active project allocations or registered-asset journals are blocked so registers cannot silently diverge.

Current project cost totals include assigned capital and expense amounts; they are not filtered by the general report period. Review source entries under Cost workings. Financial entries remain immutable. Completion, depreciation and corrections append journals/audit records. Writes require the book owner's active Advanced membership, enforced in SQL, not just the UI. Read/export remain after expiry.

## Completion and depreciation

Complete each finished cost subproject separately. Only its own capital amount moves from construction to equipment or property; unfinished siblings stay in construction. Complete children before their cost parent. A parent with no own capital can be closed without creating an asset. The transfer is debit completed asset, credit construction: it creates neither another payment nor an immediate expense.

Set the available-for-use date and review the accounting treatment explicitly. Equipment can have a fixed straight-line policy: useful life 1–1200 months and residual value from zero to cost. The convention is the **first full calendar month after the available-for-use month**. The cumulative charge at month end is `round((cost − residual) × elapsed full months / useful-life months)`, capped at the useful life, less charges already posted. Thus rounded monthly amounts reconcile exactly to the depreciable amount. A catch-up preview shows the amount before the user explicitly posts it. Only completed month-ends through today are allowed; repeated requests cannot post the same charge twice.

Charges debit depreciation expense and credit accumulated depreciation (a contra-asset), preserving gross equipment cost. Manual legacy equipment depreciation is restricted to the unregistered equipment pool. Property, land and residential investment properties do not receive an automatic depreciation policy. No tax deduction, capital allowance or landlord finance-cost relief is inferred.

Completed-asset policies and completion transfers are fixed in this release. Disposals, impairment, revaluation, policy changes, reassignment and post-completion corrections need an accountant-reviewed adjustment workflow; no automated disposal or edit route is offered. Review before completion. New later work belongs in a new project.

## Exports, recovery and review

Accountant ZIPs include an asset register and project-cost file. The register cuts off assets and depreciation at the selected report end. Cost allocations/voids carry their effective dates. The portable backup now uses envelope version 2 with sixteen bookkeeping tables, including projects, cost links, assets and charge history. Version-one backups remain supported. Full collaborative planning data still has its own workspace JSON export and is not included in a single-book restore; financial planning-link UUIDs are retained without restoring shared-team access.

The restore verifier checks construction/asset/charge ledger agreement, real database constraints, exact exported rows, financial reports, ownership, locks and bank checks in a new isolated database. Tests use the actual posting functions for partial completion, capital-versus-repair allocation, supplier-bill settlement, cumulative depreciation, residual caps, duplicate retries, read-only access and locks. These checks do not replace independent accounting approval. Extend the pending review in ACCOUNTING-REVIEW.md to cover this workflow before launch. Hosted recovery rehearsal and daily backup setup remain operator work described in BOOKKEEPING-RECOVERY.md.
