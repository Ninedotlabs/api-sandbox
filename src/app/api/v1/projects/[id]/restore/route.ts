import { requireAccess } from "@/lib/api/auth";
import { fail, firstIssue, handle, ok, readJson } from "@/lib/api/respond";
import { removedProjectSchema } from "@/lib/api/schemas";
import { pgProjectService } from "@/lib/services/pg/project-service";

export const runtime = "nodejs";

interface Context {
  params: Promise<{ id: string }>;
}

export async function POST(req: Request, context: Context): Promise<Response> {
  return handle(async () => {
    const access = await requireAccess(req);
    if (access instanceof Response) return access;
    const { id } = await context.params;

    const parsed = removedProjectSchema.safeParse(await readJson(req));
    if (!parsed.success) return fail(400, firstIssue(parsed.error));

    // The URL's id is authoritative: a caller can't restore under a different id than the
    // one it's asking for, whatever the body's project.id says.
    const removed = { ...parsed.data, project: { ...parsed.data.project, id } };
    if (access.userId) await pgProjectService.restore(removed, access.userId);
    else await pgProjectService.restore(removed);
    const restored = access.userId ? await pgProjectService.get(id, access.userId) : await pgProjectService.get(id);
    return ok(restored);
  });
}
