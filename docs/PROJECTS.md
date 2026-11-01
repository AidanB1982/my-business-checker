# Shared projects and tasks

Open `/projects` from the main navigation. Signed-out visitors see an introduction; signed-in users see their actual shared workspaces. Production creates no sample projects.

## Enable the database

After the existing application migrations, run **only** `supabase/migrations/202611010003_project_workspaces.sql` once in the same Supabase project's SQL editor. The migration is one transaction and creates eight tables, policies, constraints and functions. It needs no credentials in the SQL. No Edge Function, new environment variable or Shopify change is required.

Until it is applied, the workspace API returns `[PROJECTS_SETUP_REQUIRED]` and the UI shows a setup message. Deploying Next.js does not apply SQL automatically. Refresh `/projects` after running it.

## What is included

- Workspaces containing projects, briefs, statuses and target dates.
- Task board with drag/drop and accessible status selects, searchable/filterable task list, My tasks, due-date calendar and dated timeline.
- Tasks and deliverables with assignments, priorities, estimates, acceptance criteria, checklists, one predecessor dependency and a linked milestone. Completion checks enforce finished checklist items and predecessor tasks. Circular dependencies are rejected.
- Manual milestone sign-off and linked task progress; moving dates does not automatically reschedule dependent work.
- Weekly workload compared with each teammate's capacity. Estimates with start/due dates are spread over weekdays; estimates without a start date are counted in their due-date week. Undated work is reported separately. These are planning estimates, not time records.
- Task discussions, the latest 50 project/task/milestone activity events, filtered task CSV and workspace JSON exports. CSV cells are protected against spreadsheet formula interpretation.
- Owner/editor/viewer permissions and manually shared invitation links, with seven-day expiry, revocation and verified recipient email checks. Only a token hash is stored in the database. The raw token is shown once to the creator, held in a URL fragment and moved to an HTTP-only cookie for sign-in continuation. Invitation cookies last one day; reopening the original link works until its seven-day expiry.

## Plans and sharing

The workspace owner needs active Advanced access to create work, edit records and invite teammates. Invited members do not need their own paid plan for that workspace. Editors can edit workspace work and comment. Viewers can read/export. Owners manage roles and invitations; members can edit their display name/capacity and leave. Ownership cannot be transferred in this release.

If the owner's paid period expires, records remain readable and exportable. Security cleanup (removing access, revoking invitations, leaving or deleting the workspace) remains available. Removing a member leaves their work in place and clears their task assignments.

Limits: 10 owned workspaces per account; 25 projects, 1,000 tasks, 250 milestones, 50 members and 50 active pending invitations per workspace. Task lists and comments are paginated. Comments and activity are retained until their associated records/workspace are deleted. Workspace JSON exports contain work records and the recent activity returned to the user; they are not a complete audit archive or import format.

## Collaboration and verification

Updates refresh every 30 seconds while the tab is visible, on focus and on manual refresh. Project/task/milestone edits carry a version; stale writes return HTTP 409 and preserve the open draft for review. This is shared persistence, not live cursor presence. Invitations do not send email automatically. There are no file attachments, external calendar sync, time tracking or automatic deadline notifications in this release.

Normal signed-in Supabase clients use RLS. No service key is used for project CRUD. SQL functions check membership, owner entitlement, verified email and access caps. Composite foreign keys prevent cross-workspace/project assignment and references. Database tests execute the migration in PostgreSQL via PGlite, including RLS and permission tests. Browser tests bundle the actual client components in a test-only fixture with simulated API responses; there is no production auth bypass. Live OTP and multi-account production checks still require the deployed database migration and real users.

After setup, create a workspace as an Advanced owner, add a project/task/milestone, invite a second verified account, and confirm editor/viewer behavior. Refresh or reopen to confirm persistence. Export records before deleting real workspaces; deletion is permanent.
