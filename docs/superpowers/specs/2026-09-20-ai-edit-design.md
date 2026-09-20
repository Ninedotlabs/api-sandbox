# AI edit ("Edit with AI") — design spec

## Goal
A second AI action, alongside the existing "Generate with AI": from one instruction, add or change resources (including their fields), add endpoints, and regenerate sample data for the resources it touches — across the whole project, in a single call, previewed before anything is applied.

## Relationship to "Generate with AI"
Generate (`docs/superpowers/specs/2026-09-20-ai-generate-design.md`) already builds most of what this needs: the strict-JSON-schema request, the retry-on-bad-JSON route pattern, per-record validation against the mock engine, and a resumable apply. Edit reuses all of it. The only real difference is *identity*: Generate treats an existing resource name as a clash to rename; Edit treats it as "this is a change to that resource."

## Decisions
- Scope: the whole project. One instruction can add new resources and change existing ones together.
- Additive only: the model may add or change resources, fields, endpoints and data. It is told never to propose removing one, and nothing in the apply step can delete anything — deletions stay on the existing manual delete buttons.
- Preview is grouped by kind: **New resources**, **Changed resources**, **New endpoints** — shown before Apply, same as Generate.
- Entry point: a second button, **Edit with AI**, next to **Generate with AI** in the rail footer. Project-wide, not tied to the current selection.

## 1. Wire format
Extends `wireSchema` (`src/lib/ai/plan.ts`) with one optional top-level array; everything else — `resources[].{name,description,fields,records}` — is unchanged:
```ts
export const editWireSchema = wireSchema.extend({
  customEndpoints: z.array(z.object({
    method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
    path: z.string(),
    resourceName: z.string().nullable(),
    description: z.string(),
  })),
});
```
`strictJsonSchema()` is generalized to take the schema to close (`strictJsonSchema(schema: z.ZodType = wireSchema)`) so both Generate and Edit reuse the same closing logic.

`customEndpoints` covers requests like "add a bestsellers endpoint" that aren't one of the five standard actions. Each one is created as an `action: "custom"` route — the same kind the manual "+ Endpoint" button already creates, so it carries no new execution behaviour; `resourceName` is optional context (attaches the route to that resource if it matches one of the plan's resources, otherwise the route is unattached, same as today's custom routes).

## 2. Parsing (`src/lib/ai/plan.ts`)
```ts
export interface ExistingResourceSummary { name: string; fields: PlanField[] }
export interface CustomEndpointPlan { method: HttpMethod; path: string; resourceName: string | null; description: string }
export interface EditPlan extends ApiPlan { customEndpoints: CustomEndpointPlan[] }

export function parseEditPlan(raw: unknown, existing: ExistingResourceSummary[]): { plan: EditPlan; warnings: string[] }
```
Shares its field/record validation with `parsePlan` (both call the same extracted helpers — resource-name cleaning, field cleaning with the `choice`/`link`/`id` rules, and the two-pass record validation with link-index resolution). The one behavioural difference: resource-name resolution matches against `existing` case-insensitively and, on a match, does **not** rename or warn — that resource is now a "changed resource" target, and its plan field list is validated on top of a *merged* model (its current fields plus the plan's fields, so a required field the plan doesn't mention still isn't flagged and a field the plan changes is checked against its new definition) rather than the plan's fields alone. A brand-new name goes through the same clash-avoidance as Generate (against `existing` names and other new resources in the same plan).

`customEndpoints` validation: cap at 10; `resourceName` resolved against the plan's resources (existing-matched or new) or set to `null`; path/method validated with the existing `validateRoute`-shaped rules (a well-formed path, `:id`-style params only where the action needs them is not enforced here since these are custom); duplicates (same method+path as another entry or an existing route) dropped with a warning.

## 3. Prompt (`src/lib/ai/prompt.ts`)
`buildEditInstruction(opts: { existing: ExistingResourceSummary[] }): string` — describes the same field-type vocabulary as Generate, then:
- Lists each existing resource with its fields (name, type, required/unique, options, link target) so the model knows what's already there.
- States explicitly: "Only include a resource if you are adding it or changing it — do not repeat resources you are leaving untouched. For a resource you are changing, include only the fields you are adding or changing, not its whole existing field list. Never propose removing a resource, field or endpoint; if the instruction asks for a removal, ignore that part."
- Explains `customEndpoints` for anything beyond the standard five actions on a resource.
- Explains that when a resource's data should change, its `records` should be the resource's complete new sample set (same as Generate); a resource whose data shouldn't change should have an empty `records` array.

## 4. Server route
`POST /api/ai/edit` (`src/app/api/ai/edit/route.ts`), same shape as `/api/ai/generate`:
```json
{ "instruction": "Add a Reviews resource with rating and comment, linked to Book", "existing": [ { "name": "Book", "fields": [ ... ] } ] }
```
- 400 if `instruction` is empty or over 2000 characters, or `existing` has more than 20 resources (each with more than 20 fields) — same caps philosophy as Generate.
- 503/502/504 and their exact messages are identical to Generate's (`docs/superpowers/specs/2026-09-20-ai-generate-design.md` §2), reusing `config()`/error-mapping code moved into a small shared `src/lib/ai/errors.ts` (`aiConfig()`, `mapUpstreamError(status)`) so both routes stay in sync.
- Calls `callResponses` (extended with an optional `schema`/`instructionText` pair, or a sibling `callEditResponses` that builds the request from `buildEditInstruction` + `editWireSchema`) with the same retry-once-with-repair-notes behaviour as Generate.
- On success: `parseEditPlan(raw, existing)` → `{ plan, warnings }` → `200 { plan, warnings }`.

## 5. Diff (client-side, pure, `src/lib/ai/diff.ts`)
```ts
export interface FieldChange { name: string; kind: "added" | "changed"; before?: PlanField; after: PlanField }
export interface ResourceDiff { name: string; isNew: boolean; fields: FieldChange[]; recordCount: number /* 0 = data untouched */ }
export interface EndpointDiff { method: HttpMethod; path: string; description: string }
export interface EditDiff { newResources: ResourceDiff[]; changedResources: ResourceDiff[]; newEndpoints: EndpointDiff[] }

export function computeEditDiff(project: Project, plan: EditPlan): EditDiff
```
For each plan resource: if its name matches an existing model, diff fields by name (`added` = not present on the current model; `changed` = present but type/required/unique/options/linkTo differs) and put it in `changedResources` (even with zero field changes, if it has records, so a data-only edit still shows up); otherwise it's a `newResources` entry with every field marked `added`. `newEndpoints` is computed by simulating `generateAllCrud` plus the plan's `customEndpoints` against the *current* project's routes and keeping only the ones that don't already exist — this is a read-only simulation; nothing is created here.

## 6. Applying (`useProjectStore.applyEditPlan(projectId, plan)`)
Resumable, same guarantee as `applyPlan`, but merges instead of overwriting. One pass creates every resource first (so link fields can resolve real ids regardless of order), a second pass updates fields, endpoints and data per resource — the same two-pass shape `applyPlan` already uses, and for the same reason:
```ts
async applyEditPlan(projectId, plan): Promise<{ newResourceCount: number; changedResourceCount: number; endpointCount: number }> {
  try {
    const before = await projectService.get(projectId)!;
    const ids = new Map<string, string>(before.models.map(m => [m.name.toLowerCase(), m.id]));
    let created = 0;
    for (const resource of plan.resources) {
      const key = resource.name.toLowerCase();
      if (!ids.has(key)) { ids.set(key, (await modelService.create(projectId, resource.name)).id); created++; }
    }
    let endpointCount = 0;
    for (const resource of plan.resources) {
      const id = ids.get(resource.name.toLowerCase())!;
      const current = (await projectService.get(projectId))!.models.find(m => m.id === id)!;
      const merged = mergeFields(current.fields, resource.fields, ids); // by name; existing untouched unless the plan names it; new ones appended with a fresh id; a changed existing field keeps its id
      await modelService.update(projectId, { ...current, fields: merged });
      if (resource.records.length) await consoleService.seedRecords(projectId, id, resource.records);
      const project = await projectService.get(projectId);
      const routes = buildCrudRoutes({ ...current, fields: merged }, ALL_CRUD, project?.routes ?? []);
      await routeService.createMany(projectId, routes);
      endpointCount += routes.length;
    }
    const project = (await projectService.get(projectId))!;
    const customRoutes = plan.customEndpoints
      .map(c => ({ ...c, modelId: c.resourceName ? (ids.get(c.resourceName.toLowerCase()) ?? null) : null }))
      .filter(c => !project.routes.some(r => r.method === c.method && r.path === c.path))
      .map(c => ({ id: createId("rt"), method: c.method, path: c.path, modelId: c.modelId, action: "custom" as const, description: c.description, filters: [] }));
    if (customRoutes.length) { await routeService.createMany(projectId, customRoutes); endpointCount += customRoutes.length; }
    return { newResourceCount: created, changedResourceCount: plan.resources.length - created, endpointCount };
  } finally {
    await refresh(projectId);
  }
}
```
`mergeFields(current: Field[], planFields: PlanField[], resolvedIds: Map<string,string>): Field[]` — for each `planFields` entry, find a `current` field with the same name (case-insensitive): if found, keep its `id` and update `type/required/unique/options/linkTo`; if not found, append a new `Field` with a fresh id. Fields in `current` not named by `planFields` are kept exactly as they are. `linkTo` in the merged field is resolved through `resolvedIds` the same way Generate resolves it (by the target resource's name). This function is pure and independently tested. `modelService.update` is called unconditionally, matching `applyPlan`'s existing style — a no-op update when the plan named no field changes for that resource is harmless.

Resumability note, same as `applyPlan`: `newResourceCount`/`changedResourceCount` describe *this run*, computed from `before` at the moment it starts. If a run is retried after a partial failure, the resource(s) created before the failure are already in `before` on the retry and are reported as "changed" rather than "new" — the toast undercounts new resources across a retry the same way `applyPlan`'s `routeCount` already reports "what the resource ends up with", not "what this attempt itself created". This is accepted, not a bug to fix.

## 7. UI
- Rail footer (`src/components/rail/api-tree.tsx`): a second button **Edit with AI** (same size/style as "Generate with AI", a `Wand2` or `Pencil` icon to read as distinct from Generate's `Sparkles`) beneath the New model / New endpoint row. Clicking it sets the workspace `mode` to `"ai-edit"` (extending the existing `"idle" | "new-resource" | "ai"` union).
- `AiEditPanel` (`src/components/ai/ai-edit-panel.tsx`), same states/shape as `AiGeneratePanel` (`idle | generating | preview | applying | error`, same abort/unmount handling, same ⌘/Ctrl+Enter):
  - Kicker `Edit with AI`, heading "What should change?", textarea (`aria-label="Describe what should change"`), example chips: "Add a Reviews resource with rating and comment, linked to Book", "Add a discount field to Product", "Add more variety to Author's sample data".
  - On submit: `POST /api/ai/edit` with `{ instruction, existing: project.models.map(m => ({ name: m.name, fields: toPlanFields(m.fields) })) }`.
  - Preview: `EditPlanPreview` (`src/components/ai/edit-plan-preview.tsx`) renders `computeEditDiff(project, plan)` grouped into the three sections from §5 — new resources reuse the existing `PlanPreview`'s per-resource block; changed resources show each field as `name · TypeBadge(after) · "new" | "was <old type>"`; new endpoints as a flat list of `MethodLabel` + path + description. Warnings shown the same way Generate shows them.
  - Apply button label: `Update the API` when there's nothing new, or `Create N resource(s) and M endpoint(s)` mirroring Generate's phrasing when there's genuinely new material — computed from the diff counts, not the raw plan.
  - Apply calls `applyEditPlan`; toast `"Updated N resource(s), M new endpoint(s)"`; `onApplied` selects the first changed-or-new resource.
  - Errors/Retry: identical pattern to `AiGeneratePanel`.

## 8. Security and cost
Same as Generate (`docs/superpowers/specs/2026-09-20-ai-generate-design.md` §6): server-only key, capped `instruction` (2000 chars) and `existing` (20 resources / 20 fields each), 8000 output tokens, 30s timeout, no execution of AI output.

## 9. Testing
- `plan.test.ts` additions: `parseEditPlan` matches an existing resource by name (no rename); a plan field list for an existing resource is validated against the merged model (a field the plan doesn't mention doesn't need to be present); `customEndpoints` capped, resolved to a resource id or null, duplicates against existing routes dropped with a warning.
- `diff.test.ts`: a new resource → `newResources`; a resource with one changed field and one added field → `changedResources` with both listed correctly; a resource with only new records and no field changes → still listed with `recordCount > 0` and an empty `fields` array; `newEndpoints` excludes routes that already exist.
- `route.test.ts` (edit route): same status/message matrix as Generate's route test, parameterized or duplicated.
- `applyEditPlan` store test: an existing model keeps an untouched field's id and value after an edit that only adds a new field; a brand-new resource in the same plan is created and linked correctly to an existing one; a resumed run (one step failing, then retried) doesn't duplicate fields or routes.
- `ai-edit-panel.test.tsx`: submit → preview shows grouped sections; Apply calls `applyEditPlan` and reports counts; unmount mid-flight is abort-safe (same test shape as Generate's).
- Manual: with a Bookshop-like project already populated, "Add a Reviews resource with rating (number) and comment (text), linked to Book" → preview shows one new resource, five new endpoints, no changed resources → Apply → tree shows Review with those fields and endpoints; existing Book/Author/Order untouched.
