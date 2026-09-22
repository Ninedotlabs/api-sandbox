import { auth } from "@/auth";
import { fail, handle, ok } from "@/lib/api/respond";
import { revokeApiToken } from "@/lib/auth/api-token";
import { recordActivity } from "@/lib/activity/record";

export const runtime = "nodejs";

interface Context {
  params: Promise<{ id: string }>;
}

export async function DELETE(_req: Request, context: Context): Promise<Response> {
  return handle(async () => {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) return fail(401, "Sign in to manage MCP tokens.");

    const { id } = await context.params;
    if (!(await revokeApiToken(userId, id))) return fail(404, "This token no longer exists.");
    await recordActivity({ actorUserId: userId, action: "token.revoke", channel: "ui", targetType: "token", targetId: id });
    return ok({ id });
  });
}
