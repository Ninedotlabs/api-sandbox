# AI generation ("Generate with AI") — design spec

## Goal
From a one-paragraph description, generate a complete mock API in the current project: resources with fields, the standard endpoints, and sample records. The user previews the result and applies it in one step. Model: the "Luna" deployment on Azure AI Foundry, called through its OpenAI-compatible Responses API.

## Decisions
- Method: one call with structured output (JSON Schema, strict), validated with zod, previewed, then applied through the existing services. Per-resource data generation and chat-style editing are explicitly later.
- The model is called only from the server (Next.js route handler). The API key lives in `.env.local` and is never sent to the browser. The pasted key from the chat is treated as compromised and must be rotated.
- Preview then Apply. Nothing changes in the project until Apply.
- Generation targets the **current project** and adds to it; it never deletes or edits existing resources. Names that clash with existing resources are suffixed (`Product` → `Product2`) and flagged in the preview.

## 1. Configuration
`.env.local` (gitignored; `.env.example` is committed with empty values):
```
AZURE_AI_ENDPOINT=https://<resource>.services.ai.azure.com/openai/v1/responses
AZURE_AI_API_KEY=
AZURE_AI_MODEL=Luna
```
`AZURE_AI_MODEL` is the deployment name sent as `model`. `npm run ai:check` (a small script in `scripts/ai-check.mjs`) sends a minimal request and prints the HTTP status and the first 200 characters of the reply so the three values can be verified before using the UI.

## 2. Server route
`POST /api/ai/generate` (`src/app/api/ai/generate/route.ts`, Node runtime).

Request body (validated with zod):
```json
{ "description": "A bookstore with books, authors and orders", "existingResourceNames": ["Product"], "maxResources": 6, "recordsPerResource": 8 }
```
Behaviour:
1. Reject with 400 if `description` is empty or over 2000 characters.
2. Reject with 503 `{ error: "AI is not configured." }` if any env var is missing.
3. Build the Responses API request (`src/lib/ai/request.ts`):
   - `model`: `AZURE_AI_MODEL`
   - `input`: a system-style instruction (`src/lib/ai/prompt.ts`) plus the description. The instruction explains the field types, that `id` is automatic, that link fields reference another generated resource by name, that records must satisfy required/unique, and asks for realistic, varied data.
   - `text.format`: `{ type: "json_schema", name: "api_plan", strict: true, schema }` where `schema` is generated from the zod plan schema (`z.toJSONSchema` from zod 4).
   - `max_output_tokens`: 8000.
   - Headers: `api-key: <key>` and `Content-Type: application/json`. 30 s timeout via `AbortSignal.timeout`.
4. Extract the text (`output[].content[].text` of the first `message` item, or `output_text` when present), `JSON.parse`, then `parsePlan()` (§3). If the model's JSON fails validation, retry once with the validation errors appended to the input ("Fix these problems and return the full document again"). On the second failure return 502 `{ error: "The model returned an unusable answer. Try rephrasing." }`.
5. Return 200 `{ plan }`. Upstream 401/403 → 502 `{ error: "AI credentials were rejected." }`; timeout → 504 `{ error: "AI took too long. Try again." }`. Never include the upstream response body or the key in errors.

## 3. Plan shape and validation (`src/lib/ai/plan.ts`)
```ts
type PlanField = { name: string; type: FieldType; required: boolean; unique: boolean; options?: string[]; linkTo?: string /* resource name */ };
type PlanResource = { name: string; description: string; fields: PlanField[]; records: Record<string, unknown>[] };
type ApiPlan = { resources: PlanResource[] };
```
`parsePlan(raw: unknown, existingNames: string[]): { plan: ApiPlan; warnings: string[] }` applies, in order:
- zod shape validation (types from `FIELD_TYPES`; 1–6 resources; 0–12 fields; 0–12 records).
- resource names → `validateModelName`; clashes with `existingNames` or within the plan are suffixed with a number and a warning is added.
- field names → `validateFieldName`; `id` fields are dropped with a warning; duplicates dropped.
- `choice` needs ≥1 option; `link` must reference a resource in the plan (after renaming) or it becomes `text` with a warning.
- records: keys not in fields are dropped; each record is checked with the mock engine's `validateBody(model, record, "create", dataset)`; invalid records are dropped with a warning; records for link fields keep the referenced record index (`"1"`, `"2"` … ids are assigned in order).
- Empty plan (no resources) → throws `PlanError("The description didn't produce any resources.")`.

## 4. Applying (`useProjectStore.applyPlan(projectId, plan)`)
Sequence, all through existing services: for each resource `createModel(name)` → `saveModel({ ...model, fields })` (link `linkTo` resolved to the created model ids) → `addRoutes(buildCrudRoutes(model, all five, existing))` → `consoleService.seedRecords(projectId, modelId, records)`. `seedRecords` is a new `ConsoleService` method: replaces that model's records in the in-memory dataset with the given ones (ids assigned `"1"`, `"2"` … if missing). If any step fails, the error is shown and already-created resources stay (they are valid on their own); the toast offers no automatic rollback in v1.

## 5. UI
- Entry points: **Generate with AI** (secondary button with a `Sparkles` icon) in the rail footer next to `+ Resource`, and as the DEFINE step's second button in the lifecycle guide.
- `AiGeneratePanel` in the editor pane (replaces the guide/editor while open, like the new-resource panel):
  - Kicker `GENERATE WITH AI`, heading "Describe the API you need", textarea (autofocus, 2000 chars, Enter with ⌘/Ctrl sends), examples as three small clickable chips that fill the textarea ("A bookstore…", "A task tracker…", "A fitness app…"), **Generate** primary button, Cancel.
  - While generating: the button shows a spinner and the text "Asking Luna…"; the textarea is disabled.
  - Preview: one panel per resource: name, description, fields as `name · TypeBadge · required/unique marks`, the five endpoints as `MethodLabel + path`, "8 sample records" with the first two shown in a light `CodePanel`. Warnings listed above the resources in a warning-tinted note. Buttons: **Apply** (primary, `Create 3 resources, 15 endpoints`), **Regenerate**, **Discard**.
  - Apply: progress text ("Creating Book…"), then the tree updates, the first generated resource is selected, toast "Generated 3 resources and 15 endpoints".
  - Errors: inline note with the server's plain message and a **Retry** button. Not-configured (503) shows "AI is not configured. Add the Azure settings to .env.local and restart." — message only.
- The rail's `+ Resource` and the AI panel are mutually exclusive: opening one closes the other. Workspace page state: `mode: "idle" | "new-resource" | "ai"`.

## 6. Security and cost
- Key only on the server; `.env*` gitignored; `.env.example` committed.
- The route is unauthenticated in v1 (single-user local app). Cap: `description` ≤ 2000 chars, `maxResources` ≤ 6, `recordsPerResource` ≤ 12, `max_output_tokens` 8000. When the Express backend exists, this route moves there and gets auth like everything else.
- No AI output is executed; it is data, validated before use.

## 7. Testing
- `plan.test.ts`: valid plan passes; name clash suffixed with warning; `id` field dropped; unknown link → text with warning; invalid record dropped; empty plan throws.
- `request.test.ts`: request body shape (model, json_schema format, strict) and text extraction from both Responses API output shapes.
- Route test (`route.test.ts` with a mocked `fetch`): 400 on empty description; 503 when unconfigured; 200 with a plan on a valid upstream reply; retry once on invalid JSON then 502; 502 on upstream 401; 504 on timeout.
- `applyPlan` store test with the mock services: creates models with fields, routes in canonical order, seeds records (`consoleService.sampleData` returns them).
- `ai-generate-panel.test.tsx`: submit calls `/api/ai/generate` (mocked fetch), preview lists resources/endpoints/warnings, Apply calls `applyPlan` and selects the first resource, error shows Retry.
- Manual: `npm run ai:check` against the real deployment; generate a bookstore; send `GET /books` in the console and see AI-written records.
