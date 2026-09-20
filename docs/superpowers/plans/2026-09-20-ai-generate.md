# AI Generation ("Generate with AI") — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** From a text description, generate resources, fields, the five standard endpoints and sample records for the current project via the Azure AI Foundry "Luna" deployment (OpenAI-compatible Responses API), preview them, and apply them through the existing services.

**Architecture:** Pure modules in `src/lib/ai` build the request, extract and validate the model's answer into an `ApiPlan`. A Next.js route handler (`/api/ai/generate`) is the only place that talks to Azure and reads the key from the server environment. A store action `applyPlan` turns a plan into models, routes and seeded sample data through the existing services (plus one new `consoleService.seedRecords`). The UI is a centre-pane panel with describe → preview → apply.

**Tech Stack:** Next.js 16 route handlers (Node runtime), zod 4 (`z.toJSONSchema`), native `fetch`, Vitest (node environment for the route test, jsdom for components), existing stores/services.

**Spec:** `docs/superpowers/specs/2026-09-20-ai-generate-design.md`

## Global Constraints

- The Azure key is read only on the server from `process.env.AZURE_AI_API_KEY`; never `NEXT_PUBLIC_*`; never logged; never included in error responses. `.env.local` is gitignored; `.env.example` is committed (add `!.env.example` to `.gitignore` because it has `.env*`).
- Env vars: `AZURE_AI_ENDPOINT` (full URL ending in `/openai/v1/responses`), `AZURE_AI_API_KEY`, `AZURE_AI_MODEL` (deployment name; default in `.env.example` is `gpt-5.6-luna`).
- Request caps: `description` 1–2000 chars, `maxResources` 1–6 (default 6), `recordsPerResource` 0–12 (default 8), `max_output_tokens` 8000, timeout 30 s.
- Wire format for the model (strict JSON schema): every object has `additionalProperties: false` and all keys required; optional values are `null`; record values are strings in `{ field, value }` pairs and are coerced by field type on our side.
- Error messages to the UI, verbatim: 400 `"Describe the API you want (up to 2000 characters)."`, 503 `"AI is not configured. Add the Azure settings to .env.local and restart."`, 502 credentials `"AI credentials were rejected."`, 502 unusable `"The model returned an unusable answer. Try rephrasing."`, 504 `"AI took too long. Try again."`, other upstream `"AI request failed (<status>)."`.
- Validation of generated content reuses `validateModelName`, `validateFieldName`, `FIELD_TYPES` and the mock engine's `validateBody`. Generated content is data, never executed.
- Every user-triggered awaited call has try/catch and a plain-language error; no dialogs; no emoji; UI uses the existing primitives (`Kicker`, `MethodLabel`, `TypeBadge`, `CodePanel`, `Button`).
- Before every commit: `npm test`, `npx tsc --noEmit`, `npm run lint`, `npm run build` clean. Commit trailer names the model doing the work.

---

## File Map

```
.env.example, .gitignore (+!.env.example), package.json (script ai:check), scripts/ai-check.mjs
src/lib/ai/plan.ts (+test)          zod wire schema, strict JSON schema, parsePlan → ApiPlan + warnings
src/lib/ai/prompt.ts                instruction text builder
src/lib/ai/request.ts (+test)       buildRequest(), extractText(), callResponses()
src/app/api/ai/generate/route.ts (+test)   POST handler
src/lib/services/{types,index}.ts, mock/console-service.ts (+test)   seedRecords
src/store/project-store.ts (+test)  applyPlan
src/components/ai/ai-generate-panel.tsx (+test), src/components/ai/plan-preview.tsx
src/components/rail/api-tree.tsx, src/components/editor/lifecycle-guide.tsx, src/app/projects/[projectId]/page.tsx   entry points + mode state
```

---

### Task 1: Plan schema, parsing and request building (pure)

**Files:**
- Create: `src/lib/ai/plan.ts`, `src/lib/ai/prompt.ts`, `src/lib/ai/request.ts`
- Test: `src/lib/ai/plan.test.ts`, `src/lib/ai/request.test.ts`

**Interfaces (produced):**
```ts
// plan.ts
export interface PlanField { name: string; type: FieldType; required: boolean; unique: boolean; options?: string[]; linkTo?: string }
export interface PlanResource { name: string; description: string; fields: PlanField[]; records: Record<string, unknown>[] }
export interface ApiPlan { resources: PlanResource[] }
export class PlanError extends Error {}
export const wireSchema: z.ZodType            // what the model must return (records as entries)
export function strictJsonSchema(): Record<string, unknown>   // JSON schema for text.format, closed objects, all keys required
export function parsePlan(raw: unknown, existingNames: string[]): { plan: ApiPlan; warnings: string[] }
// prompt.ts
export function buildInstruction(opts: { maxResources: number; recordsPerResource: number; existingNames: string[] }): string
// request.ts
export interface AiConfig { endpoint: string; apiKey: string; model: string }
export function buildRequest(config: AiConfig, description: string, opts: { maxResources: number; recordsPerResource: number; existingNames: string[]; repairNotes?: string[] }): { url: string; init: RequestInit }
export function extractText(body: unknown): string | null
export async function callResponses(config, description, opts, fetchImpl = fetch): Promise<{ status: number; text: string | null }>
```

- [ ] **Step 1: Write the failing tests**

`src/lib/ai/plan.test.ts`:
```ts
import { parsePlan, PlanError, strictJsonSchema } from "./plan";

const good = {
  resources: [
    {
      name: "Book", description: "A book for sale",
      fields: [
        { name: "title", type: "text", required: true, unique: false, options: null, linkTo: null },
        { name: "price", type: "number", required: true, unique: false, options: null, linkTo: null },
        { name: "genre", type: "choice", required: false, unique: false, options: ["Fiction", "Science"], linkTo: null },
        { name: "author", type: "link", required: false, unique: false, options: null, linkTo: "Author" },
      ],
      records: [
        { entries: [{ field: "title", value: "Dune" }, { field: "price", value: "12.5" }, { field: "genre", value: "Fiction" }, { field: "author", value: "1" }] },
        { entries: [{ field: "title", value: "Cosmos" }, { field: "price", value: "abc" }] },
      ],
    },
    { name: "Author", description: "", fields: [{ name: "name", type: "text", required: true, unique: false, options: null, linkTo: null }], records: [{ entries: [{ field: "name", value: "Frank Herbert" }] }] },
  ],
};

it("accepts a good plan and coerces record values by type", () => {
  const { plan, warnings } = parsePlan(good, []);
  expect(plan.resources.map((r) => r.name)).toEqual(["Book", "Author"]);
  expect(plan.resources[0].records[0]).toEqual({ title: "Dune", price: 12.5, genre: "Fiction", author: "1" });
  expect(plan.resources[0].records).toHaveLength(1);
  expect(warnings).toEqual(["Book: dropped 1 sample record that did not match the schema."]);
});

it("renames clashes, drops id fields and unknown links", () => {
  const raw = {
    resources: [{
      name: "Product", description: "",
      fields: [
        { name: "id", type: "text", required: true, unique: true, options: null, linkTo: null },
        { name: "name", type: "text", required: true, unique: false, options: null, linkTo: null },
        { name: "owner", type: "link", required: false, unique: false, options: null, linkTo: "Nobody" },
      ],
      records: [],
    }],
  };
  const { plan, warnings } = parsePlan(raw, ["Product"]);
  expect(plan.resources[0].name).toBe("Product2");
  expect(plan.resources[0].fields.map((f) => [f.name, f.type])).toEqual([["name", "text"], ["owner", "text"]]);
  expect(warnings).toContain("Renamed Product to Product2 because a resource with that name already exists.");
  expect(warnings).toContain("Product2: dropped the id field; ids are added automatically.");
  expect(warnings).toContain("Product2: owner linked to an unknown resource, changed to text.");
});

it("rejects an empty or malformed plan", () => {
  expect(() => parsePlan({ resources: [] }, [])).toThrow(PlanError);
  expect(() => parsePlan({ nope: true }, [])).toThrow(PlanError);
});

it("produces a closed strict JSON schema", () => {
  const schema = strictJsonSchema() as { properties: Record<string, unknown>; additionalProperties: boolean; required: string[] };
  expect(schema.additionalProperties).toBe(false);
  expect(schema.required).toEqual(["resources"]);
  expect(JSON.stringify(schema)).not.toContain('"$schema"');
});
```

`src/lib/ai/request.test.ts`:
```ts
import { buildRequest, callResponses, extractText } from "./request";

const config = { endpoint: "https://x.services.ai.azure.com/openai/v1/responses", apiKey: "k", model: "Luna" };

it("builds a strict json_schema request with the api-key header", () => {
  const { url, init } = buildRequest(config, "A bookstore", { maxResources: 6, recordsPerResource: 8, existingNames: [] });
  expect(url).toBe(config.endpoint);
  expect((init.headers as Record<string, string>)["api-key"]).toBe("k");
  const body = JSON.parse(init.body as string);
  expect(body.model).toBe("Luna");
  expect(body.text.format).toMatchObject({ type: "json_schema", name: "api_plan", strict: true });
  expect(body.max_output_tokens).toBe(8000);
  expect(JSON.stringify(body.input)).toContain("A bookstore");
});

it("appends repair notes to the input", () => {
  const { init } = buildRequest(config, "x", { maxResources: 6, recordsPerResource: 8, existingNames: [], repairNotes: ["Book: dropped the id field"] });
  expect(init.body as string).toContain("Fix these problems");
});

it("extracts text from both Responses API shapes", () => {
  expect(extractText({ output_text: "{}" })).toBe("{}");
  expect(extractText({ output: [{ type: "message", content: [{ type: "output_text", text: "{\"a\":1}" }] }] })).toBe('{"a":1}');
  expect(extractText({ output: [] })).toBeNull();
});

it("calls fetch and returns status and text", async () => {
  const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ output_text: "{}" }), { status: 200 }));
  const res = await callResponses(config, "x", { maxResources: 6, recordsPerResource: 8, existingNames: [] }, fetchImpl as unknown as typeof fetch);
  expect(res).toEqual({ status: 200, text: "{}" });
});
```

- [ ] **Step 2: Run them and confirm they fail** — `npm test -- src/lib/ai`.

- [ ] **Step 3: `src/lib/ai/plan.ts`**

```ts
import { z } from "zod";
import { FIELD_TYPES } from "@/lib/field-types";
import { validateBody, type Dataset } from "@/lib/mock-engine";
import type { Field, FieldType, Model } from "@/lib/types";
import { validateFieldName, validateModelName } from "@/lib/validation";

export class PlanError extends Error {}

const typeEnum = z.enum(FIELD_TYPES.map((t) => t.type) as [FieldType, ...FieldType[]]);

export const wireSchema = z.object({
  resources: z.array(
    z.object({
      name: z.string(),
      description: z.string(),
      fields: z.array(
        z.object({ name: z.string(), type: typeEnum, required: z.boolean(), unique: z.boolean(), options: z.array(z.string()).nullable(), linkTo: z.string().nullable() }),
      ),
      records: z.array(z.object({ entries: z.array(z.object({ field: z.string(), value: z.string() })) })),
    }),
  ),
});
type Wire = z.infer<typeof wireSchema>;

export interface PlanField { name: string; type: FieldType; required: boolean; unique: boolean; options?: string[]; linkTo?: string }
export interface PlanResource { name: string; description: string; fields: PlanField[]; records: Record<string, unknown>[] }
export interface ApiPlan { resources: PlanResource[] }

/** Closed objects + all keys required, as OpenAI-style strict structured outputs demand. */
export function strictJsonSchema(): Record<string, unknown> {
  const schema = z.toJSONSchema(wireSchema) as Record<string, unknown>;
  delete schema.$schema;
  const close = (node: unknown): void => {
    if (!node || typeof node !== "object") return;
    const n = node as Record<string, unknown>;
    if (n.type === "object" && n.properties && typeof n.properties === "object") {
      n.additionalProperties = false;
      n.required = Object.keys(n.properties as object);
      Object.values(n.properties as object).forEach(close);
    }
    if (n.items) close(n.items);
    if (Array.isArray(n.anyOf)) n.anyOf.forEach(close);
  };
  close(schema);
  return schema;
}

function uniqueName(name: string, taken: Set<string>): string {
  if (!taken.has(name.toLowerCase())) return name;
  let n = 2;
  while (taken.has(`${name}${n}`.toLowerCase())) n++;
  return `${name}${n}`;
}

function coerce(field: PlanField, value: string): unknown {
  switch (field.type) {
    case "number": { const n = Number(value); return value.trim() === "" || Number.isNaN(n) ? value : n; }
    case "boolean": return value.toLowerCase() === "true" ? true : value.toLowerCase() === "false" ? false : value;
    case "json": { try { return JSON.parse(value); } catch { return value; } }
    default: return value;
  }
}

export function parsePlan(raw: unknown, existingNames: string[]): { plan: ApiPlan; warnings: string[] } {
  const parsed = wireSchema.safeParse(raw);
  if (!parsed.success) throw new PlanError("The model's answer did not match the expected shape.");
  const warnings: string[] = [];
  const taken = new Set(existingNames.map((n) => n.toLowerCase()));
  const renames = new Map<string, string>();

  // 1. Resource names
  const resources = parsed.data.resources.slice(0, 6).flatMap((r): Wire["resources"] => {
    const cleaned = r.name.trim().replace(/[^A-Za-z0-9 ]/g, "");
    if (validateModelName(cleaned, [])) { warnings.push(`Skipped a resource with an unusable name (${JSON.stringify(r.name)}).`); return []; }
    const name = uniqueName(cleaned, taken);
    if (name !== cleaned) warnings.push(`Renamed ${cleaned} to ${name} because a resource with that name already exists.`);
    taken.add(name.toLowerCase());
    renames.set(r.name, name);
    return [{ ...r, name }];
  });
  if (resources.length === 0) throw new PlanError("The description didn't produce any resources.");
  const planNames = new Set(resources.map((r) => r.name));

  // 2. Fields and records
  const plan: ApiPlan = { resources: [] };
  for (const r of resources) {
    const fields: PlanField[] = [];
    for (const f of r.fields.slice(0, 12)) {
      const fname = f.name.trim();
      if (fname.toLowerCase() === "id") { warnings.push(`${r.name}: dropped the id field; ids are added automatically.`); continue; }
      const asFields = fields.map((x, i) => ({ id: String(i), name: x.name, type: x.type, required: x.required, unique: x.unique }) as Field);
      if (validateFieldName(fname, asFields)) { warnings.push(`${r.name}: dropped field ${JSON.stringify(f.name)} (invalid or duplicate name).`); continue; }
      let field: PlanField = { name: fname, type: f.type, required: f.required, unique: f.unique };
      if (f.type === "choice") {
        const options = (f.options ?? []).map((o) => o.trim()).filter(Boolean);
        if (options.length === 0) { warnings.push(`${r.name}: ${fname} had no choices, changed to text.`); field = { ...field, type: "text" }; }
        else field.options = options;
      }
      if (f.type === "link") {
        const target = f.linkTo ? (renames.get(f.linkTo) ?? f.linkTo) : null;
        if (!target || !planNames.has(target)) { warnings.push(`${r.name}: ${fname} linked to an unknown resource, changed to text.`); field = { ...field, type: "text" }; }
        else field.linkTo = target;
      }
      fields.push(field);
    }
    plan.resources.push({ name: r.name, description: r.description.trim(), fields, records: [] });
  }

  // 3. Records, validated with the mock engine against a dataset built from the plan itself
  const models: Model[] = plan.resources.map((r, i) => ({
    id: `plan-${i}`, name: r.name,
    fields: r.fields.map((f, j) => ({ id: `plan-${i}-${j}`, name: f.name, type: f.type, required: f.required, unique: f.unique, options: f.options, linkTo: f.linkTo ? `plan-${plan.resources.findIndex((x) => x.name === f.linkTo)}` : undefined })),
  }));
  const dataset: Dataset = Object.fromEntries(models.map((m) => [m.id, []]));
  resources.forEach((r, i) => {
    const model = models[i];
    const byName = new Map(plan.resources[i].fields.map((f) => [f.name, f]));
    let dropped = 0;
    for (const rec of r.records.slice(0, 12)) {
      const body: Record<string, unknown> = {};
      for (const e of rec.entries) { const f = byName.get(e.field); if (f) body[f.name] = coerce(f, e.value); }
      // Links point at records that may come later; validate them after all records exist.
      const linkFree = { ...body }; for (const f of model.fields) if (f.type === "link") delete linkFree[f.name];
      const errors = validateBody(model, linkFree, "create", dataset);
      if (errors.length) { dropped++; continue; }
      const id = String(dataset[model.id].length + 1);
      dataset[model.id].push({ ...body, id });
      plan.resources[i].records.push(body);
    }
    if (dropped) warnings.push(`${r.name}: dropped ${dropped} sample record${dropped === 1 ? "" : "s"} that did not match the schema.`);
  });
  return { plan, warnings };
}
```
Note for the implementer: the first test expects the `price: "abc"` record to be dropped by `validateBody` ("should be a number") — `coerce` leaves non-numeric strings as strings on purpose.

- [ ] **Step 4: `src/lib/ai/prompt.ts`**

```ts
import { FIELD_TYPES } from "@/lib/field-types";

export function buildInstruction(opts: { maxResources: number; recordsPerResource: number; existingNames: string[] }): string {
  const types = FIELD_TYPES.map((t) => `${t.type} (${t.description.toLowerCase()})`).join(", ");
  return [
    "You design mock REST APIs. From the user's description, return a JSON document with the resources their API stores.",
    `Return at most ${opts.maxResources} resources. Each resource has a singular PascalCase name (e.g. Product), a one-sentence description, up to 12 fields and exactly ${opts.recordsPerResource} sample records.`,
    `Field types: ${types}. Field names are camelCase and start with a letter. Never include an id field; ids are added automatically.`,
    "Use type choice with an options list for small fixed sets, and type link with linkTo set to another resource's name for relationships; link values in records are the 1-based index of the target record (\"1\", \"2\", ...).",
    "Every record must include all required fields, respect unique fields, use realistic varied values, and give every value as a string (numbers like \"12.5\", booleans \"true\"/\"false\", dates \"2026-01-31\").",
    opts.existingNames.length ? `These resource names already exist and must not be reused: ${opts.existingNames.join(", ")}.` : "",
  ].filter(Boolean).join("\n");
}
```

- [ ] **Step 5: `src/lib/ai/request.ts`**

```ts
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
```

- [ ] **Step 6: Run tests, `npx tsc --noEmit`, lint; commit** — `git commit -m "feat: AI plan schema, parser and Responses API request builder"`.

---

### Task 2: Route handler, env config and `ai:check`

**Files:**
- Create: `src/app/api/ai/generate/route.ts`, `src/app/api/ai/generate/route.test.ts`, `.env.example`, `scripts/ai-check.mjs`
- Modify: `.gitignore` (add `!.env.example`), `package.json` (`"ai:check": "node scripts/ai-check.mjs"`)

**Interfaces:** `POST /api/ai/generate` body `{ description: string; existingResourceNames?: string[]; maxResources?: number; recordsPerResource?: number }` → 200 `{ plan: ApiPlan; warnings: string[] }` or `{ error: string }` with the statuses/messages from Global Constraints.

- [ ] **Step 1: Failing route test** — `src/app/api/ai/generate/route.test.ts` (first line `// @vitest-environment node`):
```ts
// @vitest-environment node
import { POST } from "./route";

const ok = JSON.stringify({ output_text: JSON.stringify({ resources: [{ name: "Book", description: "", fields: [{ name: "title", type: "text", required: true, unique: false, options: null, linkTo: null }], records: [] }] }) });
const post = (body: unknown) => POST(new Request("http://t/api/ai/generate", { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" } }));

beforeEach(() => {
  process.env.AZURE_AI_ENDPOINT = "https://x/openai/v1/responses";
  process.env.AZURE_AI_API_KEY = "k";
  process.env.AZURE_AI_MODEL = "Luna";
  vi.restoreAllMocks();
});

it("rejects an empty description", async () => {
  const res = await post({ description: "  " });
  expect(res.status).toBe(400);
  expect(await res.json()).toEqual({ error: "Describe the API you want (up to 2000 characters)." });
});

it("returns 503 when not configured", async () => {
  delete process.env.AZURE_AI_API_KEY;
  const res = await post({ description: "A shop" });
  expect(res.status).toBe(503);
});

it("returns a parsed plan", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(ok, { status: 200 }));
  const res = await post({ description: "A bookstore", existingResourceNames: [] });
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.plan.resources[0].name).toBe("Book");
  expect(body.warnings).toEqual([]);
});

it("retries once on an unusable answer, then fails with 502", async () => {
  const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ output_text: "not json" }), { status: 200 }));
  const res = await post({ description: "A bookstore" });
  expect(spy).toHaveBeenCalledTimes(2);
  expect(res.status).toBe(502);
  expect(await res.json()).toEqual({ error: "The model returned an unusable answer. Try rephrasing." });
});

it("maps upstream 401 and timeouts", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("nope", { status: 401 }));
  expect((await post({ description: "x" })).status).toBe(502);
  vi.spyOn(globalThis, "fetch").mockRejectedValue(Object.assign(new Error("t"), { name: "TimeoutError" }));
  expect((await post({ description: "x" })).status).toBe(504);
});
```

- [ ] **Step 2: Confirm failure.**

- [ ] **Step 3: `src/app/api/ai/generate/route.ts`**
```ts
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
```

- [ ] **Step 4: `.env.example`, `.gitignore`, `scripts/ai-check.mjs`, package script**

`.env.example`:
```
AZURE_AI_ENDPOINT=https://<resource>.services.ai.azure.com/openai/v1/responses
AZURE_AI_API_KEY=
AZURE_AI_MODEL=gpt-5.6-luna
```
`.gitignore`: append `!.env.example` after the `.env*` line.

`scripts/ai-check.mjs` (reads `.env.local` without extra deps):
```js
import { readFileSync } from "node:fs";
const env = Object.fromEntries(readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const { AZURE_AI_ENDPOINT, AZURE_AI_API_KEY, AZURE_AI_MODEL } = env;
if (!AZURE_AI_ENDPOINT || !AZURE_AI_API_KEY || !AZURE_AI_MODEL) { console.error("Missing AZURE_AI_ENDPOINT, AZURE_AI_API_KEY or AZURE_AI_MODEL in .env.local"); process.exit(1); }
const res = await fetch(AZURE_AI_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/json", "api-key": AZURE_AI_API_KEY }, body: JSON.stringify({ model: AZURE_AI_MODEL, input: "Reply with the single word OK.", max_output_tokens: 20 }) });
const text = await res.text();
console.log(`HTTP ${res.status}`);
console.log(text.slice(0, 200));
process.exit(res.ok ? 0 : 1);
```
`package.json` scripts: `"ai:check": "node scripts/ai-check.mjs"`.

- [ ] **Step 5: Run tests (route test in node env), tsc, lint, build; commit** — `git commit -m "feat: /api/ai/generate route with Azure config and ai:check script"`.

---

### Task 3: `seedRecords` and `applyPlan`

**Files:**
- Modify: `src/lib/services/types.ts`, `src/lib/services/mock/console-service.ts`, `src/lib/services/mock/services.test.ts` (append), `src/store/project-store.ts`, `src/store/project-store.test.ts` (append)

**Interfaces:**
- `ConsoleService.seedRecords(projectId, modelId, records: Record<string, unknown>[]): Promise<void>` — replaces the model's records in the in-memory dataset (creating the dataset if needed via `datasetFor`); each record gets `id` `"1"`, `"2"` … when missing.
- `useProjectStore.applyPlan(projectId, plan: ApiPlan): Promise<{ modelIds: string[]; routeCount: number }>`.

- [ ] **Step 1: Failing tests**

Append to `services.test.ts`:
```ts
it("seeds records for a model and serves them", async () => {
  const p = await newStore();
  const product = p.models[0];
  await mockConsoleService.seedRecords(p.id, product.id, [{ name: "Lamp", price: 25 }, { name: "Desk", price: 120 }]);
  const rows = await mockConsoleService.sampleData(p.id, product.id);
  expect(rows.map((r) => r.id)).toEqual(["1", "2"]);
  expect(rows[0]).toMatchObject({ name: "Lamp", price: 25 });
});
```
Append to `project-store.test.ts`:
```ts
it("applies an AI plan: models with fields, five routes each, seeded records", async () => {
  const p = await useProjectStore.getState().createProject({ name: "Books", description: "", templateId: null });
  const result = await useProjectStore.getState().applyPlan(p.id, {
    resources: [
      { name: "Author", description: "", fields: [{ name: "name", type: "text", required: true, unique: false }], records: [{ name: "Ann" }] },
      { name: "Book", description: "", fields: [{ name: "title", type: "text", required: true, unique: false }, { name: "author", type: "link", required: false, unique: false, linkTo: "Author" }], records: [{ title: "Dune", author: "1" }] },
    ],
  });
  const project = useProjectStore.getState().projects.find((x) => x.id === p.id)!;
  expect(project.models.map((m) => m.name)).toEqual(["Author", "Book"]);
  const book = project.models[1];
  expect(book.fields.find((f) => f.name === "author")!.linkTo).toBe(project.models[0].id);
  expect(project.routes.filter((r) => r.modelId === book.id).map((r) => r.action)).toEqual(["list", "get", "create", "update", "delete"]);
  expect(result).toEqual({ modelIds: project.models.map((m) => m.id), routeCount: 10 });
  expect(await consoleService.sampleData(p.id, book.id)).toEqual([{ title: "Dune", author: "1", id: "1" }]);
});
```
(import `consoleService` from `@/lib/services` and `setMockLatency(0)` in `beforeEach` as the file already does.)

- [ ] **Step 2: Confirm failure.** **Step 3: Implement** `seedRecords` (in `console-service.ts`, using `datasetFor(project)` then `dataset[modelId] = records.map((r, i) => ({ ...r, id: String(r.id ?? i + 1) }))`) and `applyPlan` in the store:
```ts
async applyPlan(projectId, plan) {
  const ids = new Map<string, string>();
  const modelIds: string[] = [];
  let routeCount = 0;
  for (const r of plan.resources) {
    const created = await modelService.create(projectId, r.name);
    ids.set(r.name, created.id);
    modelIds.push(created.id);
  }
  for (const r of plan.resources) {
    const id = ids.get(r.name)!;
    const model: Model = { id, name: r.name, fields: r.fields.map((f) => ({ id: createId("fld"), name: f.name, type: f.type, required: f.required, unique: f.unique, ...(f.options ? { options: f.options } : {}), ...(f.linkTo ? { linkTo: ids.get(f.linkTo) } : {}) })) };
    await modelService.update(projectId, model);
    const current = await projectService.get(projectId);
    const routes = buildCrudRoutes(model, ["list", "get", "create", "update", "delete"], current?.routes ?? []);
    await routeService.createMany(projectId, routes);
    routeCount += routes.length;
    await consoleService.seedRecords(projectId, id, r.records);
  }
  await refresh(projectId);
  return { modelIds, routeCount };
}
```
(`buildCrudRoutes`, `createId`, `consoleService` are imported; `ApiPlan` type from `@/lib/ai/plan`.)
- [ ] **Step 4: Tests, tsc, lint; commit** — `git commit -m "feat: seedRecords and applyPlan"`.

---

### Task 4: UI — Generate with AI panel and entry points

**Files:**
- Create: `src/components/ai/ai-generate-panel.tsx`, `src/components/ai/plan-preview.tsx`, `src/components/ai/ai-generate-panel.test.tsx`
- Modify: `src/app/projects/[projectId]/page.tsx` (replace `creating: boolean` with `mode: "idle" | "new-resource" | "ai"`; `Editor` renders `NewResourcePanel` for `new-resource` and `AiGeneratePanel` for `ai`), `src/components/rail/api-tree.tsx` (rename `creating/onCreatingChange` to `mode/onModeChange` with values above; the footer gains a **Generate with AI** button (`Sparkles` icon) → `onModeChange("ai")`; `+ Resource` → `onModeChange("new-resource")`), `src/components/editor/lifecycle-guide.tsx` (DEFINE step gets a second, secondary button "Generate with AI" → `actions.generate`), tests for api-tree/lifecycle-guide updated for the renamed props.

**Interfaces:**
- `<AiGeneratePanel project onApplied(firstModelId) onCancel />` — internal states `idle | generating | preview | applying | error`; calls `fetch("/api/ai/generate", …)` with `{ description, existingResourceNames: project.models.map(m => m.name) }`; on 200 shows `<PlanPreview plan warnings />`; Apply → `useProjectStore.applyPlan` → toast `Generated N resources and M endpoints` → `onApplied(modelIds[0])`.
- `<PlanPreview plan warnings />` renders per resource: name + description, fields as `name` (mono) + `TypeBadge` + `required`/`unique` marks, the five endpoints via `crudOptions(model)` rendered with `MethodLabel` + mono path, `N sample records` with the first two in a light `CodePanel`.

- [ ] **Step 1: Failing test** — `ai-generate-panel.test.tsx`:
```tsx
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Project } from "@/lib/types";
import { useProjectStore } from "@/store/project-store";
import { renderUi } from "@/test/render";
import { AiGeneratePanel } from "./ai-generate-panel";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const project: Project = { id: "p1", name: "Shop", slug: "shop", description: "", models: [], routes: [], createdAt: "", updatedAt: "" };
const plan = { resources: [{ name: "Book", description: "A book", fields: [{ name: "title", type: "text", required: true, unique: false }], records: [{ title: "Dune" }] }] };

it("generates, previews and applies", async () => {
  const user = userEvent.setup();
  const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ plan, warnings: ["Renamed X to X2."] }), { status: 200 }));
  const applyPlan = vi.fn().mockResolvedValue({ modelIds: ["m9"], routeCount: 5 });
  useProjectStore.setState({ applyPlan } as never);
  const onApplied = vi.fn();
  renderUi(<AiGeneratePanel project={project} onApplied={onApplied} onCancel={vi.fn()} />);
  await user.type(screen.getByLabelText("Describe the API you need"), "A bookstore");
  await user.click(screen.getByRole("button", { name: "Generate" }));
  expect(await screen.findByText("Book")).toBeInTheDocument();
  expect(screen.getByText("Renamed X to X2.")).toBeInTheDocument();
  expect(screen.getByText("GET")).toBeInTheDocument();
  expect(JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string)).toMatchObject({ description: "A bookstore", existingResourceNames: [] });
  await user.click(screen.getByRole("button", { name: "Create 1 resource, 5 endpoints" }));
  await waitFor(() => expect(applyPlan).toHaveBeenCalledWith("p1", plan));
  expect(onApplied).toHaveBeenCalledWith("m9");
});

it("shows the server error with a Retry button", async () => {
  const user = userEvent.setup();
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ error: "AI is not configured. Add the Azure settings to .env.local and restart." }), { status: 503 }));
  renderUi(<AiGeneratePanel project={project} onApplied={vi.fn()} onCancel={vi.fn()} />);
  await user.type(screen.getByLabelText("Describe the API you need"), "A shop");
  await user.click(screen.getByRole("button", { name: "Generate" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("AI is not configured");
  expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
});
```
- [ ] **Step 2: Confirm failure.** **Step 3: Implement** the panel (textarea with `aria-label="Describe the API you need"`, three example chips, ⌘/Ctrl+Enter submits, "Asking Luna…" while generating, preview with Apply/Regenerate/Discard, error note with Retry), `PlanPreview`, the mode refactor in the page/tree/guide, and update the affected tests (`api-tree.test.tsx` "asks the page to start creating" → `onModeChange("new-resource")`; add one for the AI button → `onModeChange("ai")`; `lifecycle-guide.test.tsx` gets `generate` in `actions`).
- [ ] **Step 4: Full checks; commit** — `git commit -m "feat: Generate with AI panel and entry points"`.
- [ ] **Step 5 (human):** with `.env.local` filled: `npm run ai:check` → `HTTP 200`; in the app: Generate with AI → "A bookstore with books, authors and orders" → preview → Apply → tree shows the resources → console `GET /books` returns AI-written records.
