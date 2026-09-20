import { z } from "zod";
import { requireAccess } from "@/lib/api/auth";
import { fail, firstIssue, handle, ok, readJson } from "@/lib/api/respond";
import { requiredString } from "@/lib/api/schemas";
import { pgProjectService } from "@/lib/services/pg/project-service";
import type { TemplateId } from "@/lib/types";

export const runtime = "nodejs";

const TEMPLATE_IDS = ["blog", "store", "todo"] as const satisfies readonly TemplateId[];

const createSchema = z.object({
  name: requiredString("name is required"),
  description: z.string().optional(),
  templateId: z.enum(TEMPLATE_IDS).nullable().optional(),
});

export async function GET(req: Request): Promise<Response> {
  return handle(async () => {
    const denied = requireAccess(req);
    if (denied) return denied;
    const projects = await pgProjectService.list();
    return ok(projects);
  });
}

export async function POST(req: Request): Promise<Response> {
  return handle(async () => {
    const denied = requireAccess(req);
    if (denied) return denied;

    const parsed = createSchema.safeParse(await readJson(req));
    if (!parsed.success) return fail(400, firstIssue(parsed.error));

    const project = await pgProjectService.create({
      name: parsed.data.name,
      description: parsed.data.description ?? "",
      templateId: parsed.data.templateId ?? null,
    });
    return ok(project, 201);
  });
}
