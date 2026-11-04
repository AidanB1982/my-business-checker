# Private owner dashboard

The owner dashboard is at `/account/owner`. Its link appears in the owner's workspace only after the database permission check succeeds. A paid subscription does **not** confer owner access. The dashboard never lists users, emails or financial records.

## Setup

1. Apply `supabase/migrations/202611040001_owner_dashboard.sql` in the Supabase SQL editor, after the initial schema. It does not require a service-role key or change billing.
2. Find your existing account's UUID under **Authentication → Users**. In the SQL editor, replace the placeholder below with that UUID, then run:

```sql
insert into public.app_owners(user_id)
values ('YOUR_EXISTING_SUPABASE_USER_UUID'::uuid)
on conflict do nothing;
```

3. Deploy the code and reopen **My workspace → App owner dashboard** while signed into that account. Other accounts receive a not-found response. The aggregate database RPC checks the owner permission again, so calling it outside the page does not bypass access control.

Only a trusted database administrator can add or remove owners. To revoke access, delete that UUID from `public.app_owners`; the next request is denied. Never grant browser roles direct access to `app_owners`, `app_activity` or `auth.users`.

## What the figures mean

- **Registered accounts:** current `auth.users` records excluding anonymous sessions; includes accounts awaiting confirmation. Deleted users no longer count. This is not a historical signup total or visitor count.
- **New accounts:** current non-anonymous accounts created in the last rolling 30 days.
- **Advanced memberships:** one per current account, status active/trialing and access expiry in the future, matching the app's entitlement rules. It is not revenue or a guarantee of renewal.
- **Recorded active users:** unique accounts with optional usage records, today plus the previous 6/29 UTC days. They count once per window across devices, tools and days. These are **not all active users** because sharing is optional and off by default.
- **Most visited tools:** distinct sharing accounts per tool in the last 30 UTC days. Views do not establish that a calculation was run. Do not sum tool counts to obtain unique users.
- **Daily activity:** unique sharing accounts per UTC date, including zero days. This cannot reconstruct use before tracking began.

Totals are calculated in PostgreSQL rather than by downloading users or relying on a paginated API list. They are requested afresh on every owner dashboard load. Missing database setup or read failures are never shown as a real zero count.

## Optional usage records

In **My workspace → Optional usage sharing**, users can enable sharing on their current browser. It remains off unless enabled explicitly. Stop sharing on each browser to stop future records there. **Delete my usage history** deletes all that user's recorded activity and turns sharing off on the current browser; another browser still opted in may record future visits.

Only fixed, allowlisted section/tool labels are accepted. User identity and UTC day come from the authenticated database session; callers cannot supply another user or date. Each account/day/page is deduplicated. The server rejects extra fields, financial values, arbitrary URLs and absent consent. Signed-out and anonymous sessions are not recorded. Hosting infrastructure may separately maintain operational request logs.

Application usage records contain only account UUID, UTC day and page label. No IP address, user agent, browser/device identifier, query string, calculation inputs/results or invoice data is stored in that table. Deleting an account cascades to its activity.

Reports exclude records older than 90 UTC days. Old rows are deleted on the next successful usage write. For guaranteed daily cleanup during idle periods, enable **Supabase Cron** in the project and run the following once through the SQL editor (requires `pg_cron`):

```sql
select cron.schedule(
  'mbc-usage-retention',
  '15 2 * * *',
  $$delete from public.app_activity
    where activity_day < (now() at time zone 'UTC')::date - 89$$
);
```

Until that scheduled job is configured, deletion of older records is activity-triggered rather than guaranteed at a fixed hour. The app's privacy notice states this. Set and review the operator's privacy information before public launch.
