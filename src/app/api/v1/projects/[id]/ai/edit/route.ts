import { z } from "zod";
import { parseEditPlan, PlanError, type ExistingResourceSummary } from "@/lib/ai/plan";
import { callEditResponses, type AiConfig } from "@/lib/ai/request";
import { requireProjectAccess } from "@/lib/api/auth";
import { fail, firstIssue, handle, ok, readJson } from "@/lib/api/respond";
import { applyEditPlanPg } from "@/lib/services/pg/apply-plan";
import { pgProjectService } from "@/lib/services/pg/project-service";
import { pgRecordService } from "@/lib/services/pg/record-service";
import type { Project } from "@/lib/types";

export const runtime = "nodejs";

interface Context {
  params: Promise<{ id: string }>;
}

const bodySchema = z.object({
  instruction: z
    .string({ message: "instruction is required" })
    .trim()
    .min(1, "instruction is required")
    .max(2000, "Keep the instruction under 2000 characters."),
});

function config(): AiConfig | null {
  const { AZURE_AI_ENDPOINT: endpoint, AZURE_AI_API_KEY: apiKey, AZURE_AI_MODEL: model } = process.env;
  return endpoint && apiKey && model ? { endpoint, apiKey, model } : null;
}

/** Summarises the project's current models the way the AI edit prompt expects: a
 * `linkTo` names the target *resource*, not a model id, and `recordIds` lets the model
 * refer to a specific existing record. Built from the project itself (rather than trusted
 * from the caller, as the older client-driven `/api/ai/edit` did), since the project is now
 * the source of truth. */
async function buildExistingResources(project: Project): Promise<ExistingResourceSummary[]> {
  const nameById = new Map(project.models.map((m) => [m.id, m.name]));
  const out: ExistingResourceSummary[] = [];
  for (const model of project.models) {
    const records = await pgRecordService.sampleData(project.id, model.id);
    const recordIds = records.map((r) => String((r as Record<string, unknown>).id));
    out.push({
      name: model.name,
      fields: model.fields.map((f) => ({
        name: f.name,
        type: f.type,
        required: f.required,
        unique: f.unique,
        ...(f.options ? { options: f.options } : {}),
        ...(f.linkTo ? { linkTo: nameById.get(f.linkTo) } : {}),
      })),
      ...(recordIds.length ? { recordIds } : {}),
    });
  }
  return out;
}

/**
 * Edits a project from a natural-language instruction and immediately persists the result -
 * "the existing AI edit, now persisting" per the design spec. `existing` (the resources the
 * AI edit prompt is grounded in) is derived from the project's current state rather than
 * supplied by the caller.
 */
export async function POST(req: Request, context: Context): Promise<Response> {
  return handle(async () => {
    const { id } = await context.params;
    const access = await requireProjectAccess(req, id);
    if (access instanceof Response) return access;

    const parsedBody = bodySchema.safeParse(await readJson(req));
    if (!parsedBody.success) return fail(400, firstIssue(parsedBody.error));

    const project = await pgProjectService.get(id);
    if (!project) return fail(404, "This API no longer exists.");

    const cfg = config();
    if (!cfg) return fail(503, "AI is not configured. Add the Azure settings to .env.local and restart.");

    const { instruction } = parsedBody.data;
    const existingResources = await buildExistingResources(project);

    let repairNotes: string[] | undefined;
    for (let attempt = 0; attempt < 2; attempt++) {
      let result: { status: number; text: string | null };
      try {
        result = await callEditResponses(cfg, instruction, { existing: existingResources, repairNotes });
      } catch (e) {
        if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) return fail(504, "AI took too long. Try again.");
        return fail(502, "AI request failed (network).");
      }
      if (result.status === 401 || result.status === 403) return fail(502, "AI credentials were rejected.");
      if (result.status < 200 || result.status >= 300) return fail(502, `AI request failed (${result.status}).`);

      // As in generate: a bad AI answer is repairable (retried below); a failure persisting
      // a *good* answer is a real error and must reach `handle()` untouched.
      let parsed: { plan: ReturnType<typeof parseEditPlan>["plan"]; warnings: string[] } | null = null;
      try {
        const raw = JSON.parse(result.text ?? "");
        parsed = parseEditPlan(raw, existingResources);
      } catch (e) {
        repairNotes = [e instanceof PlanError ? e.message : "The answer was not valid JSON."];
      }
      if (parsed) {
        const applied = await applyEditPlanPg(id, parsed.plan);
        const updated = await pgProjectService.get(id);
        return ok({ project: updated, ...applied, warnings: parsed.warnings });
      }
    }
    return fail(502, "The model returned an unusable answer. Try rephrasing.");
  });
}
