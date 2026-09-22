import { z } from "zod";
import { recordActivity } from "@/lib/activity/record";
import { currentAdminId } from "@/lib/admin/guard";
import { fail, firstIssue, handle, ok, readJson } from "@/lib/api/respond";
import { LAST_ADMIN_MESSAGE, setUserRole } from "@/lib/auth/roles";

export const runtime = "nodejs";

interface Context {
  params: Promise<{ id: string }>;
}

const bodySchema = z.object({
  role: z.enum(["user", "admin"], { message: "role must be user or admin" }),
});

/** Promote or demote an account. Admin browser sessions only; everyone else gets a 404. */
export async function PATCH(req: Request, context: Context): Promise<Response> {
  return handle(async () => {
    const adminId = await currentAdminId();
    if (!adminId) return fail(404, "Not found.");

    const { id } = await context.params;
    const parsed = bodySchema.safeParse(await readJson(req));
    if (!parsed.success) return fail(400, firstIssue(parsed.error));

    try {
      if (!(await setUserRole(id, parsed.data.role))) return fail(404, "This user no longer exists.");
    } catch (error) {
      if (error instanceof Error && error.message === LAST_ADMIN_MESSAGE) return fail(409, LAST_ADMIN_MESSAGE);
      throw error;
    }

    await recordActivity({
      actorUserId: adminId,
      action: "user.role_change",
      channel: "ui",
      targetType: "user",
      targetId: id,
      metadata: { role: parsed.data.role },
    });
    return ok({ id, role: parsed.data.role });
  });
}
