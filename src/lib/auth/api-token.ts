import { createHash, randomBytes } from "node:crypto";
import { query } from "@/lib/db/client";
import { createId } from "@/lib/ids";

const TOKEN_PREFIX = "ua_";

export interface ApiTokenSummary {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
}

interface ApiTokenRow {
  id: string;
  name: string;
  created_at: Date;
  last_used_at: Date | null;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function fromRow(row: ApiTokenRow): ApiTokenSummary {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at.toISOString(),
    lastUsedAt: row.last_used_at?.toISOString() ?? null,
  };
}

export async function listApiTokens(userId: string): Promise<ApiTokenSummary[]> {
  const { rows } = await query<ApiTokenRow>(
    `select id, name, created_at, last_used_at
     from api_tokens where user_id = $1 order by created_at desc`,
    [userId],
  );
  return rows.map(fromRow);
}

export async function createApiToken(userId: string, name: string): Promise<{ token: string; summary: ApiTokenSummary }> {
  const token = `${TOKEN_PREFIX}${randomBytes(32).toString("base64url")}`;
  const { rows } = await query<ApiTokenRow>(
    `insert into api_tokens (id, user_id, name, token_hash)
     values ($1, $2, $3, $4)
     returning id, name, created_at, last_used_at`,
    [createId("tok"), userId, name.trim(), hashToken(token)],
  );
  return { token, summary: fromRow(rows[0]) };
}

export async function revokeApiToken(userId: string, tokenId: string): Promise<boolean> {
  const result = await query("delete from api_tokens where id = $1 and user_id = $2", [tokenId, userId]);
  return result.rowCount === 1;
}

export async function authenticateApiToken(token: string): Promise<string | null> {
  if (!token.startsWith(TOKEN_PREFIX) || token.length < 24) return null;
  const { rows } = await query<{ user_id: string }>(
    `update api_tokens set last_used_at = now()
     where token_hash = $1
     returning user_id`,
    [hashToken(token)],
  );
  return rows[0]?.user_id ?? null;
}
