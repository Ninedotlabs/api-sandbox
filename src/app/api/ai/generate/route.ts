import { NextResponse } from "next/server";
import { z } from "zod";
import { parsePlan, PlanError } from "@/lib/ai/plan";
import { callResponses, type AiConfig } from "@/lib/ai/request";

export const runtime = "nodejs";

const bodySchema = z.object({
  description: z.string().trim().min(1).max(2000),
  existingResourceNames: z.array(z.string()).default([]),
  maxResources: z.number().int().min(1).max(6).default(6),
  recordsPerResource: z.number().int().min(0).max(12).default(8),
});

function config(): AiConfig | null {
  const { AZURE_AI_ENDPOINT: endpoint, AZURE_AI_API_KEY: apiKey, AZURE_AI_MODEL: model } = process.env;
  return endpoint && apiKey && model ? { endpoint, apiKey, model } : null;
}

const err = (status: number, error: string) => NextResponse.json({ error }, { status });

export async function POST(req: Request) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return err(400, "Describe the API you want (up to 2000 characters).");
  const cfg = config();
  if (!cfg) return err(503, "AI is not configured. Add the Azure settings to .env.local and restart.");
  const { description, existingResourceNames, maxResources, recordsPerResource } = parsed.data;

  let repairNotes: string[] | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    let result: { status: number; text: string | null };
    try {
      result = await callResponses(cfg, description, { maxResources, recordsPerResource, existingNames: existingResourceNames, repairNotes });
    } catch (e) {
      if (e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError")) return err(504, "AI took too long. Try again.");
      return err(502, "AI request failed (network).");
    }
    if (result.status === 401 || result.status === 403) return err(502, "AI credentials were rejected.");
    if (result.status < 200 || result.status >= 300) return err(502, `AI request failed (${result.status}).`);
    try {
      const raw = JSON.parse(result.text ?? "");
      const { plan, warnings } = parsePlan(raw, existingResourceNames);
      return NextResponse.json({ plan, warnings });
    } catch (e) {
      repairNotes = [e instanceof PlanError ? e.message : "The answer was not valid JSON."];
    }
  }
  return err(502, "The model returned an unusable answer. Try rephrasing.");
}
