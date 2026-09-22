# Admin dashboard, roles and activity log

Approved 2026-09-22. Gives one or more accounts an `admin` role and an `/admin` area that shows
every user, every project, what people have been doing, and which app settings are configured.

## 1. Data - `db/migrations/0003_admin.sql`

- `users.role text not null default 'user' check (role in ('user','admin'))`.
- `activity_events`: `id`, `actor_user_id` (nullable, `on delete set null`), `actor_email`
  (snapshot, so the log still reads after a user is deleted), `action` (`project.create`,
  `route.delete`, `auth.sign_in`, ...), `target_type`, `target_id`, `project_id` (no FK - the
  project may be deleted later and the event must survive), `channel` (`ui` | `api` | `mcp` |
  `auth`), `metadata jsonb`, `created_at`. Indexed on `created_at desc` and
  `(actor_user_id, created_at desc)`.
- The migration promotes `mohithingorani2003@gmail.com` if that account already exists.

## 2. Roles and access

- `ADMIN_EMAILS` (comma-separated, case-insensitive) promotes a matching account on every
  sign-in. It only ever promotes; demotion happens in the dashboard.
- Role is read with its own query (`getUserRole`), **not** added to the Auth.js adapter's
  selects. Code can deploy before the migration runs; a missing `role` column or
  `activity_events` table must mean "not an admin" / "nothing logged", never a broken sign-in.
- The session exposes `user.role` so the client can show the Admin nav link. The link is
  cosmetic; every admin page and admin API checks the role on the server.
- `/admin/*` pages call `notFound()` for anyone who isn't an admin.
- `requireProjectAccess` skips the owner check for admins **signed in through the browser**.
  An admin's API/MCP token stays scoped to their own projects, so a leaked token never
  becomes access to everyone's data.
- Handlers that re-scope a project read by owner use `access.ownerScope` (undefined for an
  admin), and duplicate can read another owner's project while giving the copy to the admin.
- The last remaining admin can't be demoted.

## 3. Activity logging

- `recordActivity()` is best-effort: a failed insert is written to stderr and swallowed, so
  logging can never fail the request it describes.
- Called from every `/api/v1` write handler, MCP token create/revoke, role changes, and the
  Auth.js `signIn` event.
- Channel: browser session -> `ui`; bearer token -> `api`, or `mcp` when the request carries
  `X-Universal-Api-Client: mcp` (the MCP client now sends it).
- Mock API traffic (`/api/<slug>/*`) is deliberately not logged.

## 4. Dashboard (`/admin`)

- **Overview** - counts (users, admins, projects, endpoints, records, events in last 24h) and
  the 10 most recent events.
- **Users** - email, name, role, joined, last active (latest of session activity, token use,
  logged event), project count, token count; promote/demote.
- **User detail** - their projects (openable), token names and last use, active sessions
  (expiry only - never the session token), their activity.
- **Projects** - every project with owner, endpoint and record counts, a link to open it.
- **Activity** - full log, filter by user, action and channel, 50 per page.
- **Settings** - each known env setting shown as configured / missing. Values are never sent
  to the browser; `ADMIN_EMAILS` is the one exception, since it lists emails, not a secret.

## 5. Known limitation

Undoing a project deletion re-creates it owned by whoever pressed undo. If an admin deletes and
then restores another user's project, the admin becomes its owner. Restoring ownership would
need the removed-project payload to carry `ownerId`, which it doesn't today.

## 6. Testing

Unit tests for `ADMIN_EMAILS` parsing, settings redaction, channel detection and best-effort
recording; Postgres tests (run when `PG_TEST_DATABASE_URL` is set) for roles, the last-admin
guard, activity recording and the admin queries.
