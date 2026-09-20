import { strictJsonSchema } from "./plan";
import { buildInstruction } from "./prompt";

export interface AiConfig { endpoint: string; apiKey: string; model: string }
export interface GenerateOptions { maxResources: number; recordsPerResource: number; existingNames: string[]; repairNotes?: string[] }

export function buildRequest(config: AiConfig, description: string, opts: GenerateOptions): { url: string; init: RequestInit } {
  const input = [
    { role: "system", content: buildInstruction(opts) },
    { role: "user", content: description },
    ...(opts.repairNotes?.length ? [{ role: "user", content: `Fix these problems and return the full document again:\n- ${opts.repairNotes.join("\n- ")}` }] : []),
  ];
  const body = {
    model: config.model,
    input,
    text: { format: { type: "json_schema", name: "api_plan", strict: true, schema: strictJsonSchema() } },
    max_output_tokens: 8000,
  };
  return {
    url: config.endpoint,
    init: { method: "POST", headers: { "Content-Type": "application/json", "api-key": config.apiKey }, body: JSON.stringify(body), signal: AbortSignal.timeout(30_000) },
  };
}

export function extractText(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;
  const b = body as { output_text?: unknown; output?: unknown };
  if (typeof b.output_text === "string" && b.output_text) return b.output_text;
  if (Array.isArray(b.output)) {
    for (const item of b.output as { type?: string; content?: { type?: string; text?: string }[] }[]) {
      if (item.type !== "message" || !Array.isArray(item.content)) continue;
      const part = item.content.find((c) => c.type === "output_text" && typeof c.text === "string");
      if (part?.text) return part.text;
    }
  }
  return null;
}

export async function callResponses(config: AiConfig, description: string, opts: GenerateOptions, fetchImpl: typeof fetch = fetch): Promise<{ status: number; text: string | null }> {
  const { url, init } = buildRequest(config, description, opts);
  const res = await fetchImpl(url, init);
  const json = await res.json().catch(() => null);
  return { status: res.status, text: res.ok ? extractText(json) : null };
}
