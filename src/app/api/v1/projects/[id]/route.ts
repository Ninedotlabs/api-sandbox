import { z } from "zod";
import { requireProjectAccess } from "@/lib/api/auth";
import { fail, firstIssue, handle, ok, readJson } from "@/lib/api/respond";
import { requiredString } from "@/lib/api/schemas";
import { pgProjectService } from "@/lib/services/pg/project-service";

export const runtime = "nodejs";

interface Context {
  params: Promise<{ id: string }>;
}

const patchSchema = z.object({
  name: requiredString("name is required").optional(),
  description: z.string().optional(),
  slug: requiredString("slug is required").optional(),
});

export async function GET(req: Request, context: Context): Promise<Response> {
  return handle(async () => {
    const { id } = await context.params;
    const access = await requireProjectAccess(req, id);
    if (access instanceof Response) return access;
    const project = access.userId ? await pgProjectService.get(id, access.userId) : await pgProjectService.get(id);
    if (!project) return fail(404, "This API no longer exists.");
    return ok(project);
  });
}

export async function PATCH(req: Request, context: Context): Promise<Response> {
  return handle(async () => {
    const { id } = await context.params;
    const access = await requireProjectAccess(req, id);
    if (access instanceof Response) return access;

    const parsed = patchSchema.safeParse(await readJson(req));
    if (!parsed.success) return fail(400, firstIssue(parsed.error));

    const project = await pgProjectService.update(id, parsed.data);
    return ok(project);
  });
}

export async function DELETE(req: Request, context: Context): Promise<Response> {
  return handle(async () => {
    const { id } = await context.params;
    const access = await requireProjectAccess(req, id);
    if (access instanceof Response) return access;
    const removed = await pgProjectService.remove(id);
    return ok(removed);
  });
}
