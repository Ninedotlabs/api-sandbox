import { z } from "zod";
import { PlanError, parsePlan } from "@/lib/ai/plan";
import { callResponses, type AiConfig } from "@/lib/ai/request";
import { requireAccess } from "@/lib/api/auth";
import { fail, firstIssue, handle, ok, readJson } from "@/lib/api/respond";
import { applyPlanPg } from "@/lib/services/pg/apply-plan";
import { pgProjectService } from "@/lib/services/pg/project-service";

export const runtime = "nodejs";

interface Context {
  params: Promise<{ id: string }>;
}

const bodySchema = z.object({
  description: z
    .string({ message: "description is required" })
    .trim()
    .min(1, "description is required")
    .max(2000, "Keep the description under 2000 characters."),
  maxResources: z.number().int().min(1).max(6).default(6),
  recordsPerResource: z.number().int().min(0).max(12).default(8),
});

function config(): AiConfig | null {
  const { AZURE_AI_ENDPOINT: endpoint, AZURE_AI_API_KEY: apiKey, AZURE_AI_MODEL: model } = process.env;
  return endpoint && apiKey && model ? { endpoint, apiKey, model } : null;
}

/**
 * Generates an API plan from a natural-language description and immediately persists it -
 * "the existing AI generate, now persisting" per the design spec. Unlike the earlier
 * `/api/ai/generate` (which only returns a plan for the caller to apply itself), the
 * existing resource names used to avoid a collision are derived from the project's current
 * models rather than supplied by the caller, since the project is now the source of truth.
 */
export async function POST(req: Request, context: Context): Promise<Response> {
  return handle(async () => {
    const denied = requireAccess(req);
    if (denied) return denied;
    const { id } = await context.params;

    const parsedBody = bodySchema.safeParse(await readJson(req));
    if (!parsedBody.success) return fail(400, firstIssue(parsedBody.error));

    const project = await pgProjectService.get(id);
    if (!project) return fail(404, "This API no longer exists.");

    const cfg = config();
    if (!cfg) return fail(503, "AI is not configured. Add the Azure settings to .env.local and restart.");

    const { description, maxResources, recordsPerResource } = parsedBody.data;
    const existingResourceNames = project.models.map((m) => m.name);

    let repairNotes: string[] | undefined;
    for (let attempt = 0; attempt < 2; attempt++) {
      let result: { status: number; text: string | null };
      try {
        result = await callResponses(cfg, description, {
          maxResources,
          recordsPerResource,
          existingNames: existingResourceNames,
          repairNotes,
        });
      } catch (e) {
        if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) return fail(504, "AI took too long. Try again.");
        return fail(502, "AI request failed (network).");
      }
      if (result.status === 401 || result.status === 403) return fail(502, "AI credentials were rejected.");
      if (result.status < 200 || result.status >= 300) return fail(502, `AI request failed (${result.status}).`);

      // Parsing/interpreting the model's answer is repairable (we ask it to try again below);
      // a failure persisting the plan it produced is a real, non-repairable error and must
      // propagate to `handle()` untouched rather than being mistaken for a bad AI answer.
      let parsed: { plan: ReturnType<typeof parsePlan>["plan"]; warnings: string[] } | null = null;
      try {
        const raw = JSON.parse(result.text ?? "");
        parsed = parsePlan(raw, existingResourceNames);
      } catch (e) {
        repairNotes = [e instanceof PlanError ? e.message : "The answer was not valid JSON."];
      }
      if (parsed) {
        const applied = await applyPlanPg(id, parsed.plan);
        const updated = await pgProjectService.get(id);
        return ok({ project: updated, modelIds: applied.modelIds, routeCount: applied.routeCount, warnings: parsed.warnings }, 201);
      }
    }
    return fail(502, "The model returned an unusable answer. Try rephrasing.");
  });
}
