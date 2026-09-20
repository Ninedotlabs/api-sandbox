# AI Edit — Removals

**Status:** proposed
**Date:** 2026-09-20
**Amends:** `docs/superpowers/specs/2026-09-20-ai-edit-design.md`

## 1. Why

"Edit with AI" cannot remove anything. The model is instructed: *"Never propose removing a resource, field or endpoint. If part of the instruction asks for a removal, ignore that part and do the rest."*

So "I don't want user email in the response" returns an empty plan and the panel says "Nothing to change here — try describing it differently." The user asked for an ordinary edit, the system did nothing, and the message implies they phrased it badly. They didn't.

Reproduced against the live model, every phrasing, every project size:

```
"i dont want user email in response"  -> {"plan":{"resources":[],"customEndpoints":[]}}
"remove the email field from User"    -> {"plan":{"resources":[],"customEndpoints":[]}}
```

The original restriction was reasonable: an AI quietly deleting a user's data is a severe failure, and when the feature shipped there was no undo for deletions. That is no longer true. `RemovedModel` now carries its records, `RemovedProject` carries the records of every model under it, routes already had `RemovedRoute`, and `restoreRecords` exists. Every deletion this feature would perform is now reversible, so the reason for the restriction is gone.

## 2. Wire format

`editWireSchema` gains a `removals` object. The model populates it **only** when the user's instruction explicitly asks for something to go.

```ts
removals: {
  resources: string[];                                  // resource names
  fields: { resource: string; field: string }[];
  endpoints: { method: HttpMethod; path: string }[];
}
```

The instruction changes from a prohibition to a rule with a condition: propose a removal when, and only when, the user asked for one; never as a side effect of a change; never to "tidy up"; and never a resource the user did not name. When an instruction both adds and removes, do both.

## 3. Parsing

`parseEditPlan` validates each removal against the project it was given:

- A resource name that does not exist is dropped with a warning.
- A field removal naming an unknown resource or unknown field is dropped with a warning.
- An endpoint removal that matches no existing route is dropped with a warning.
- A field that is the **last remaining field** on a resource is dropped with a warning — a resource with no fields is not a state the editor can produce, and the user almost certainly meant to remove the resource.
- Removing a resource that another resource links to is allowed; the apply nulls those links the way a manual delete already does.

Removals and additions are independent: a plan may add a field and remove another in one answer.

## 4. Preview

Removals get their own section, last, in the danger colour, above the apply button. This is the consent step and it states consequences, not just names:

- Field: `email — 12 records will lose this value`
- Resource: `Session — deletes 4 records and 5 endpoints`, plus `Question.session will be cleared` for each inbound link
- Endpoint: `DELETE /users/:id`

Counts come from the project's real records, which the diff already has access to. The apply button names removals explicitly, e.g. `Apply 1 change and 1 removal`.

## 5. Applying

`applyEditPlan` performs removals **after** additions and changes, so a plan that replaces a field with a differently-named one never leaves the resource empty in between.

It uses the existing service methods rather than new deletion paths:

- resource: `modelService.remove` → a `RemovedModel`, which already carries its records and routes
- endpoint: `routeService.remove` → a `RemovedRoute`
- field: `modelService.update` with the field omitted, having first snapshotted the resource's records so the values can be restored

The apply result's undo payload grows from `replacedRecords` into one object:

```ts
interface EditUndo {
  replacedRecords: RecordSnapshot[];
  removedModels: RemovedModel[];
  removedRoutes: RemovedRoute[];
  removedFields: { modelId: string; field: Field; records: Record<string, unknown>[] }[];
}
```

and `undoEdit(projectId, undo)` restores all four, in reverse order. The success toast offers Undo whenever anything was removed or replaced — same pattern as every other destructive action in this app, no dialog.

## 6. Safety

- The model may only remove what the instruction named. The preview is the consent step, and it shows consequences with real counts.
- Nothing is removed that the preview did not show — the same preview/apply equivalence the AI edit feature already tests, extended to cover removals.
- Every removal is undoable in one click, and the undo restores record values, not just schema.
- Removals never cascade beyond what is shown: deleting a resource deletes its own records and endpoints, and nulls inbound links, all of which the preview states.

## 7. Testing

- Parsing: each removal kind validated; unknown names dropped with a warning; last-field guard; add-and-remove in one plan.
- Diff: counts are real; inbound links listed; a removal that would be a no-op is not shown.
- Apply: order (additions before removals); each removal kind performed; undo restores schema **and** record values.
- Equivalence: what the preview lists is exactly what apply does, removals included.
- Live: "I don't want user email in the response" against a seeded project produces a field removal, and undo brings the values back.

## 8. Non-goals

- Removing a whole project. That belongs to the project list, not an edit instruction.
- Bulk "remove everything unused" style cleanups — too easy to get wrong, and not what anyone asked for.
