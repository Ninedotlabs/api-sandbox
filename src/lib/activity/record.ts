import { query } from "@/lib/db/client";
import { createId } from "@/lib/ids";

/**
 * The activity log (see `docs/superpowers/specs/2026-09-22-admin-dashboard-design.md` §3).
 *
 * Recording is best-effort by design: an event describes a request that has already
 * succeeded, so a failed insert (a cold database, or `0003_admin.sql` not applied yet) is
 * written to stderr and swallowed rather than turned into an error for that request.
 */
export type ActivityChannel = "ui" | "api" | "mcp" | "auth";

export const ACTIVITY_CHANNELS: readonly ActivityChannel[] = ["ui", "api", "mcp", "auth"];

/** Sent by `src/mcp/client.ts` so MCP traffic can be told apart from other token clients. */
export const CLIENT_HEADER = "x-universal-api-client";

export interface ActivityInput {
  actorUserId: string | null;
  action: string;
  channel: ActivityChannel;
  targetType?: string | null;
  targetId?: string | null;
  projectId?: string | null;
  metadata?: Record<string, unknown>;
}

/** Bearer-token requests are `api`, or `mcp` when the MCP client identifies itself. */
export function channelForRequest(req: Request, viaToken: boolean): ActivityChannel {
  if (!viaToken) return "ui";
  return req.headers.get(CLIENT_HEADER)?.toLowerCase() === "mcp" ? "mcp" : "api";
}

/** Records an event on behalf of whoever `requireAccess` resolved for this request. */
export function recordRequestActivity(
  access: { userId: string | null; channel: ActivityChannel },
  event: Omit<ActivityInput, "actorUserId" | "channel">,
): Promise<void> {
  return recordActivity({ ...event, actorUserId: access.userId, channel: access.channel });
}

export async function recordActivity(input: ActivityInput): Promise<void> {
  try {
    // The email is snapshotted from `users` in the same statement, so the log still names
    // the person after their account is gone.
    await query(
      `insert into activity_events
         (id, actor_user_id, actor_email, action, target_type, target_id, project_id, channel, metadata)
       values ($1, $2, (select email from users where id = $2), $3, $4, $5, $6, $7, $8)`,
      [
        createId("evt"),
        input.actorUserId,
        input.action,
        input.targetType ?? null,
        input.targetId ?? null,
        input.projectId ?? null,
        input.channel,
        JSON.stringify(input.metadata ?? {}),
      ],
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[activity] Could not record ${input.action}: ${message}\n`);
  }
}
