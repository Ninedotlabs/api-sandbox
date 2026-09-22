import { requireProjectAccess } from "@/lib/api/auth";
import { fail, firstIssue, handle, ok, readJson } from "@/lib/api/respond";
import { removedModelSchema } from "@/lib/api/schemas";
import { pgModelService } from "@/lib/services/pg/model-service";
import { recordRequestActivity } from "@/lib/activity/record";

export const runtime = "nodejs";

interface Context {
  params: Promise<{ id: string; modelId: string }>;
}

export async function POST(req: Request, context: Context): Promise<Response> {
  return handle(async () => {
    const { id, modelId } = await context.params;
    const access = await requireProjectAccess(req, id);
    if (access instanceof Response) return access;

    const parsed = removedModelSchema.safeParse(await readJson(req));
    if (!parsed.success) return fail(400, firstIssue(parsed.error));

    const removed = { ...parsed.data, model: { ...parsed.data.model, id: modelId } };
    const model = await pgModelService.restore(id, removed);
    await recordRequestActivity(access, { action: "model.restore", targetType: "model", targetId: modelId, projectId: id });
    return ok(model);
  });
}
