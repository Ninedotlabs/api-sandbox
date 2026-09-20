import { z } from "zod";
import { auth } from "@/auth";
import { fail, firstIssue, handle, ok, readJson } from "@/lib/api/respond";
import { createApiToken, listApiTokens } from "@/lib/auth/api-token";

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
    return ok(await createApiToken(userId, parsed.data.name), 201);
  });
}
