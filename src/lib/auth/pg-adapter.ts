import type { Adapter, AdapterSession, AdapterUser, VerificationToken } from "@auth/core/adapters";
import { query } from "@/lib/db/client";
import { createId } from "@/lib/ids";

/**
 * A hand-written Auth.js adapter over our own `users` / `accounts` / `sessions` /
 * `verification_tokens` tables (`db/migrations/0001_init.sql`), instead of the published
 * `@auth/pg-adapter` package.
 *
 * That package's SQL is hard-coded against a different shape than ours: it names columns
 * `"userId"`, `"providerAccountId"`, `"sessionToken"`, `"emailVerified"` (quoted camelCase)
 * and a `verification_token` (singular) table, none of which match this schema's
 * consistent snake_case (`user_id`, `provider_account_id`, `session_token`,
 * `email_verified`, `verification_tokens`). Renaming our columns to fit the package would
 * mean editing an already-applied migration for a dependency's convention; writing the
 * ~150 lines of SQL ourselves, against the Adapter interface Auth.js documents, is the
 * smaller and more honest change. This is the verification the design doc asked for
 * ("confirm against the adapter's actual inserts rather than assuming they match") -
 * see `pg-adapter.test.ts` for the round-trip proof against a real database.
 *
 * `users.id` has no database default (`text primary key`, no `default`), and the
 * off-the-shelf adapter's `createUser` insert never supplies one - it expects the
 * database to generate it. Ours does the opposite: `createUser` below generates the id
 * itself with `createId`, the same helper every other table in this app uses. No
 * migration is needed for that reason; see the task report for why.
 */
interface UserRow {
  id: string;
  name: string | null;
  email: string;
  email_verified: Date | null;
  image: string | null;
}

function userFromRow(row: UserRow): AdapterUser {
  return { id: row.id, name: row.name, email: row.email, emailVerified: row.email_verified, image: row.image };
}

interface SessionRow {
  session_token: string;
  user_id: string;
  expires: Date;
}

function sessionFromRow(row: SessionRow): AdapterSession {
  return { sessionToken: row.session_token, userId: row.user_id, expires: row.expires };
}

export const pgAdapter: Adapter = {
  async createUser(user) {
    const id = createId("usr");
    const { rows } = await query<UserRow>(
      `insert into users (id, name, email, email_verified, image)
       values ($1, $2, $3, $4, $5)
       returning id, name, email, email_verified, image`,
      [id, user.name ?? null, user.email, user.emailVerified, user.image ?? null],
    );
    return userFromRow(rows[0]);
  },

  async getUser(id) {
    const { rows } = await query<UserRow>(
      "select id, name, email, email_verified, image from users where id = $1",
      [id],
    );
    return rows[0] ? userFromRow(rows[0]) : null;
  },

  async getUserByEmail(email) {
    const { rows } = await query<UserRow>(
      "select id, name, email, email_verified, image from users where email = $1",
      [email],
    );
    return rows[0] ? userFromRow(rows[0]) : null;
  },

  async getUserByAccount({ provider, providerAccountId }) {
    const { rows } = await query<UserRow>(
      `select u.id, u.name, u.email, u.email_verified, u.image
       from users u
       join accounts a on a.user_id = u.id
       where a.provider = $1 and a.provider_account_id = $2`,
      [provider, providerAccountId],
    );
    return rows[0] ? userFromRow(rows[0]) : null;
  },

  async updateUser(user) {
    const { rows } = await query<UserRow>(
      `update users set
         name = coalesce($2, name),
         email = coalesce($3, email),
         email_verified = coalesce($4, email_verified),
         image = coalesce($5, image)
       where id = $1
       returning id, name, email, email_verified, image`,
      [user.id, user.name ?? null, user.email ?? null, user.emailVerified ?? null, user.image ?? null],
    );
    return userFromRow(rows[0]);
  },

  async deleteUser(userId) {
    await query("delete from users where id = $1", [userId]);
  },

  async linkAccount(account) {
    await query(
      `insert into accounts
         (user_id, type, provider, provider_account_id, refresh_token, access_token,
          expires_at, token_type, scope, id_token, session_state)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        account.userId,
        account.type,
        account.provider,
        account.providerAccountId,
        account.refresh_token ?? null,
        account.access_token ?? null,
        account.expires_at ?? null,
        account.token_type ?? null,
        account.scope ?? null,
        account.id_token ?? null,
        account.session_state ?? null,
      ],
    );
  },

  async unlinkAccount({ provider, providerAccountId }) {
    await query("delete from accounts where provider = $1 and provider_account_id = $2", [provider, providerAccountId]);
  },

  async createSession({ sessionToken, userId, expires }) {
    await query("insert into sessions (session_token, user_id, expires) values ($1, $2, $3)", [
      sessionToken,
      userId,
      expires,
    ]);
    return { sessionToken, userId, expires };
  },

  async getSessionAndUser(sessionToken) {
    const { rows } = await query<SessionRow & UserRow>(
      `select s.session_token, s.user_id, s.expires,
              u.id, u.name, u.email, u.email_verified, u.image
       from sessions s
       join users u on u.id = s.user_id
       where s.session_token = $1`,
      [sessionToken],
    );
    const row = rows[0];
    if (!row) return null;
    return { session: sessionFromRow(row), user: userFromRow(row) };
  },

  async updateSession({ sessionToken, expires }) {
    if (!expires) return null;
    const { rows } = await query<SessionRow>(
      "update sessions set expires = $2 where session_token = $1 returning session_token, user_id, expires",
      [sessionToken, expires],
    );
    return rows[0] ? sessionFromRow(rows[0]) : null;
  },

  async deleteSession(sessionToken) {
    await query("delete from sessions where session_token = $1", [sessionToken]);
  },

  async createVerificationToken(token) {
    await query("insert into verification_tokens (identifier, token, expires) values ($1, $2, $3)", [
      token.identifier,
      token.token,
      token.expires,
    ]);
    return token;
  },

  async useVerificationToken({ identifier, token }) {
    const { rows } = await query<VerificationToken>(
      "delete from verification_tokens where identifier = $1 and token = $2 returning identifier, token, expires",
      [identifier, token],
    );
    return rows[0] ?? null;
  },
};
