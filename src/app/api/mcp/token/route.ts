import { z } from "zod";
import { auth } from "@/auth";
import { fail, firstIssue, handle, ok, readJson } from "@/lib/api/respond";
import { createApiToken, listApiTokens } from "@/lib/auth/api-token";
import { recordActivity } from "@/lib/activity/record";

export const runtime = "nodejs";

const createSchema = z.object({
  name: z.string().trim().min(1, "Give this token a name.").max(40, "Keep the name under 40 characters."),
});

async function currentUserId(): Promise<string | null> {
  const session = await auth();
  return session?.user?.id ?? null;
}

export async function GET(): Promise<Response> {
  return handle(async () => {
    const userId = await currentUserId();
    if (!userId) return fail(401, "Sign in to manage MCP tokens.");
    return ok(await listApiTokens(userId));
  });
}

export async function POST(req: Request): Promise<Response> {
  return handle(async () => {
    const userId = await currentUserId();
    if (!userId) return fail(401, "Sign in to manage MCP tokens.");

    const parsed = createSchema.safeParse(await readJson(req));
    if (!parsed.success) return fail(400, firstIssue(parsed.error));
    const created = await createApiToken(userId, parsed.data.name);
    await recordActivity({ actorUserId: userId, action: "token.create", channel: "ui", targetType: "token", targetId: created.summary.id, metadata: { name: created.summary.name } });
    return ok(created, 201);
  });
}
