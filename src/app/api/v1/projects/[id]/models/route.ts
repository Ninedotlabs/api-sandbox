import { z } from "zod";
import { requireAccess } from "@/lib/api/auth";
import { fail, firstIssue, handle, ok, readJson } from "@/lib/api/respond";
import { requiredString } from "@/lib/api/schemas";
import { pgModelService } from "@/lib/services/pg/model-service";

export const runtime = "nodejs";

interface Context {
  params: Promise<{ id: string }>;
}

const createSchema = z.object({
  name: requiredString("name is required"),
});

export async function POST(req: Request, context: Context): Promise<Response> {
  return handle(async () => {
    const denied = requireAccess(req);
    if (denied) return denied;
    const { id } = await context.params;

    const parsed = createSchema.safeParse(await readJson(req));
    if (!parsed.success) return fail(400, firstIssue(parsed.error));

    const model = await pgModelService.create(id, parsed.data.name);
    return ok(model, 201);
  });
}
