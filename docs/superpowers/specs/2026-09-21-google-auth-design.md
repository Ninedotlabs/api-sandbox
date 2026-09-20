# Google Sign-in and Per-User Ownership — Design

**Status:** proposed
**Date:** 2026-09-21

## 1. Decisions

Settled with the project owner before design:

- **Google OAuth** as the only provider, via Auth.js v5.
- **First sign-in claims** every existing ownerless project. There is one person's data in this database and they are about to become user number one.
- **Sign-in required for the whole app.** The mock API endpoints (`/api/<slug>/*`) stay fully public and unauthenticated — that is the product, and the entire point is that anything can call them.
- **Per-user API tokens**, created and revoked in the UI, replacing the single environment token for MCP.

## 2. What already exists

The schema was written with this in mind. `users`, `accounts`, `sessions` and `verification_tokens` already match the Auth.js Postgres adapter's expected shape, `projects.owner_id` already references `users(id)`, and `api_tokens(user_id, name, token_hash, created_at, last_used_at)` is already there.

One detail to verify during implementation: the adapter expects to be able to insert a user row and have an id available. Our `users.id` is `text primary key` with no default. Either the adapter supplies the id or the column needs a default — confirm against the adapter's actual inserts rather than assuming, and add a migration only if needed.

## 3. Sign-in

- `auth.ts` at the project root configures Auth.js v5 with the Google provider and the Postgres adapter, using `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` and `AUTH_SECRET` from the environment. Database sessions, not JWT — we already have a `sessions` table, and database sessions can be revoked.
- `/api/auth/[...nextauth]/route.ts` mounts the handlers.
- A sign-in page in the existing visual system: the product name, one sentence on what it does, and a single "Continue with Google" button. No carousel, no marketing.
- Middleware redirects unauthenticated requests for app pages to sign-in. **`/api/<slug>/*` is exempt** — it must never redirect, never 401, and never set a cookie. A mock API that suddenly demands a session would break every client pointed at it.

## 4. Claiming existing projects

On the first successful sign-in, in a transaction:

1. Count rows in `users`. Proceed only if this is the first user.
2. `update projects set owner_id = $1 where owner_id is null`.

Guarded by the count so a second user never inherits the first one's work. Anything created before sign-in existed becomes the first account's, which is what the owner expects and is reversible by reassignment.

If the database somehow already has more than one user when an ownerless project exists, claim nothing and log it. Silently handing one person's data to another is the worst possible failure here.

## 5. Ownership and scoping

Every `/api/v1` handler resolves a user (session cookie or bearer token) and scopes to it. A project not owned by the caller is **404, not 403** — a 403 confirms the project exists, which leaks the existence of other people's work.

The service layer gains the owner as an explicit parameter rather than reading a global. `pgProjectService.list(ownerId)`, `get(id, ownerId)` and so on, so an unscoped query becomes a type error instead of a silent leak. The mock services mirror it for tests.

`/api/<slug>/*` does **not** scope. It resolves the project by slug alone, exactly as today.

## 6. Per-user tokens

- A Tokens section in settings: create a named token, see its prefix, creation date and last use, revoke it.
- The token is shown **once**, at creation, with a copy button and a plain warning that it will not be shown again. Only a SHA-256 hash is stored, so a database leak does not yield working tokens.
- Format `ua_<base64url>`, matching what already exists.
- `requireAccess` resolves a bearer token by hash to a user, updates `last_used_at`, and rejects unknown or revoked tokens. Comparison stays `timingSafeEqual` on the hash.
- `UNIVERSAL_API_TOKEN` is **removed** once per-user tokens work. A permanent superuser credential that cannot be revoked without a redeploy is a liability the moment real accounts exist.

## 7. MCP

MCP authenticates with a per-user token, so Claude acts as that user and sees only their projects. The `/mcp` page's connect snippets read from the user's own tokens, and the page gains a line saying a token grants full access to that account's projects and should be treated as a password.

The tool definitions do not change. Scoping happens underneath, in the API.

## 8. Risks

- **Locking yourself out.** If middleware is wrong or the Google credentials are misconfigured, the app becomes unusable with no way in. Sign-in must be verified end to end against real credentials before the middleware gate is enabled by default, and the middleware must fail open to the sign-in page rather than to an error.
- **The claim step is one-way.** It runs once, in a transaction, guarded by the user count. Worth a manual verification against a copy before it runs against real data.
- **Scoping is the security boundary.** A handler that forgets the owner filter leaks another account's projects. Hence the explicit parameter: forgetting it should not compile. Tests must cover, for every endpoint, that a second user cannot read or mutate the first user's project.
- **Redirect URI drift.** Vercel preview deployments get new URLs; only the stable production domain and `localhost` are registered, so previews will not be able to sign in. Accepted and documented.

## 9. Testing

- Claim-on-first-login: claims when the users table is empty beforehand; claims nothing when a second user signs in; is transactional.
- Scoping: for every `/api/v1` endpoint, a second user gets 404 for the first user's project, on both reads and writes.
- Tokens: created once and hashed; the plaintext never returns after creation; revocation takes effect immediately; an unknown token is rejected.
- Public mock APIs: `/api/<slug>/*` answers with no session and no token, including after middleware lands.
- Sign-in flow itself: verified by hand against real Google credentials, since no unit test proves an OAuth handshake works.
