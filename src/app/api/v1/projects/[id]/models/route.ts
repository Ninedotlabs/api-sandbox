import { z } from "zod";
import { requireProjectAccess } from "@/lib/api/auth";
import { fail, firstIssue, handle, ok, readJson } from "@/lib/api/respond";
import { requiredString } from "@/lib/api/schemas";
import { pgModelService } from "@/lib/services/pg/model-service";
import { recordRequestActivity } from "@/lib/activity/record";

export const runtime = "nodejs";

interface Context {
  params: Promise<{ id: string }>;
}

const createSchema = z.object({
  name: requiredString("name is required"),
});

export async function POST(req: Request, context: Context): Promise<Response> {
  return handle(async () => {
    const { id } = await context.params;
    const access = await requireProjectAccess(req, id);
    if (access instanceof Response) return access;

    const parsed = createSchema.safeParse(await readJson(req));
    if (!parsed.success) return fail(400, firstIssue(parsed.error));

    const model = await pgModelService.create(id, parsed.data.name);
    await recordRequestActivity(access, { action: "model.create", targetType: "model", targetId: model.id, projectId: id, metadata: { name: model.name } });
    return ok(model, 201);
  });
}
