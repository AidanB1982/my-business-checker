# Bookkeeping backup and recovery

## What is implemented and tested

The owner can download an accountant report ZIP for selected dates and a separate compressed portable backup for all dates in one book. Exports remain readable after Advanced expires. A database snapshot RPC exports all rows from twelve explicitly named bookkeeping tables in a single statement snapshot, including full invoices, draft/issued snapshots, contacts, audit, locks, bank checks, branding assets and the owner-wide invoice number watermark. It refuses oversized exports rather than silently truncating them. The report ZIP is not a restore file.

The portable JSON envelope contains a SHA-256 checksum of canonically ordered data. This detects accidental changes, not malicious edits or authenticity: anyone able to edit a file can recompute its checksum. Store backups encrypted, restrict access, record a checksum separately, and apply a retention policy. Downloads contain personal and financial data.

Run from a trusted checkout matching the backup's application version:

```sh
npm ci
npm run verify:bookkeeping-backup -- /secure/path/bookkeeping-backup.json.gz
```

The verifier always creates a fresh **in-memory** PGlite database. It has no production connection argument and never contacts Supabase. It enforces compressed and decompressed size bounds, format/ownership/table/column allowlists, inserts parameterised values in dependency order, commits with actual database constraints, compares every exported row, checks trial balance, balance sheet, invoice/ledger agreement and reconciliation chains, resets identity counters, and verifies ownership isolation. It restores no subscriptions or login credentials. A successful result is a local restore rehearsal, not permission to overwrite production.

Automated evidence: `tests/unit/bookkeeping-premium.test.ts` posts the accounting example via actual database functions and restores its compressed backup into another fresh database. Negative cases cover checksum changes, missing tables and cross-book records. Existing financial/database suites cover posting restrictions, immutable records, reconciliation and locks.

## Hosted recovery and daily backups — operator work still required

A single-book export is **not** a full Supabase project disaster-recovery backup. It omits authentication, subscriptions, other books, shared projects and infrastructure configuration. Automatic daily backup scheduling, off-site storage, retention, monitoring and hosted recovery are not configured by this change. Choose a Supabase backup/PITR plan or another supported PostgreSQL backup service and verify its coverage and retention against the business's recovery objectives.

Before launch:

1. Set recovery point/time objectives, retention and named operators. Configure managed daily backups and failure alerts, with a separate access-controlled location where supported. Confirm auth, schema and application records coverage.
2. Take a provider-supported full backup and restore to an isolated hosted project. Disable outbound emails, billing webhooks and live integrations. Never use production credentials in a test deployment. Document provider restore commands and results.
3. Compare row counts, reports, control totals, original invoice snapshots, ownership policies, bank reconciliation chains and period locks. Run the local verifier on a recent portable backup as an additional book-level check. Check every owner's invoice number sequence across **all** restored books; a single-book watermark is not a safe way to merge into a live account.
4. Test an isolated deployed app against the restored database. Confirm sign-in and read/write authorization, expired-membership behaviour, exports and tenant isolation. Record elapsed recovery time and actual restore point.
5. Approve any production recovery separately, pause writes, take a current safety backup, record the cutover/rollback plan and migrate only using a reviewed operator procedure. This repository deliberately provides no production overwrite/import endpoint.
6. Retain a dated rehearsal log with operator, backup timestamp, application revision, environment, checks, failures, corrections and sign-off. Repeat after schema changes and periodically thereafter.

Hosted rehearsal evidence: **pending**. Independent accounting acceptance: **pending**, tracked in ACCOUNTING-REVIEW.md.

## Deploying this release

Apply `202611030004_premium_bookkeeping.sql` after the existing bookkeeping, contacts and invoices migrations, using the Supabase SQL editor. No new environment variables or API credentials are needed. The new RPC is owner-scoped; the service-role key is not used. Until applied, the exports show the existing setup-required error. Existing invoice profiles default to the standard colour and no logo.
