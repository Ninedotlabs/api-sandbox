import { requireProjectAccess } from "@/lib/api/auth";
import { fail, firstIssue, handle, ok, readJson } from "@/lib/api/respond";
import { modelSchema } from "@/lib/api/schemas";
import { pgModelService } from "@/lib/services/pg/model-service";

export const runtime = "nodejs";

interface Context {
  params: Promise<{ id: string; modelId: string }>;
}

export async function PATCH(req: Request, context: Context): Promise<Response> {
  return handle(async () => {
    const { id, modelId } = await context.params;
    const access = await requireProjectAccess(req, id);
    if (access instanceof Response) return access;

    const parsed = modelSchema.safeParse(await readJson(req));
    if (!parsed.success) return fail(400, firstIssue(parsed.error));

    // The URL's id is authoritative, but everything else - including a field the schema
    // doesn't know about yet - is forwarded exactly as the caller sent it.
    const model = await pgModelService.update(id, { ...parsed.data, id: modelId });
    return ok(model);
  });
}

export async function DELETE(req: Request, context: Context): Promise<Response> {
  return handle(async () => {
    const { id, modelId } = await context.params;
    const access = await requireProjectAccess(req, id);
    if (access instanceof Response) return access;
    const removed = await pgModelService.remove(id, modelId);
    return ok(removed);
  });
}
