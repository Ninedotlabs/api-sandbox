/**
 * The one-time move from the browser's localStorage (the mock services' own store, see
 * `src/lib/services/mock/db.ts`) to the Postgres-backed `/api/v1` management API.
 *
 * This ships, and is exercised end to end, *before* `src/lib/services/index.ts` is ever
 * pointed at the `http` implementation - see `docs/superpowers/plans/2026-09-20-backend-phase1.md`,
 * Task C. That ordering matters for one reason: while the switch hasn't flipped yet, the
 * app's own `projectService` (from `@/lib/services`) still resolves to the *mock* service,
 * which reads the very same localStorage key this module is trying to empty out. Checking
 * "does the server already have projects?" through that abstraction would always answer
 * "yes" (it would just be reading localStorage again) and the banner would never appear.
 * So every request here goes straight to `fetch("/api/v1/...")`, never through
 * `@/lib/services` - that's what actually reaches Postgres regardless of which way the
 * selector in `index.ts` currently points.
 */
import { mockConsoleService } from "@/lib/services/mock/console-service";
import { KEY as LOCAL_DB_KEY } from "@/lib/services/mock/db";
import type { Model, Project } from "@/lib/types";

/** Set once every local project has been offered and the user has acted on the banner
 * (Import completed, even partially). Never set by "Not now" - a deferred decision may be
 * revisited on a later load. */
export const MIGRATED_FLAG_KEY = "universal-api:migrated";

/** The persisted mock-services payload, tolerating anything short of `{ projects: Project[] }`. */
export function readLocalProjects(): Project[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(LOCAL_DB_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return [];
    const projects = (parsed as { projects?: unknown }).projects;
    return Array.isArray(projects) ? (projects as Project[]) : [];
  } catch {
    return [];
  }
}

export function hasMigrated(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(MIGRATED_FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

export function markMigrated(): void {
  try {
    localStorage.setItem(MIGRATED_FLAG_KEY, "1");
  } catch {
    // Storage may be unavailable (private mode, quota). Worst case the banner reappears
    // next load and the user dismisses it again - never a reason to fail the import itself.
  }
}

/** The request body, or `undefined` on anything that isn't valid JSON - mirrors
 * `src/lib/api/respond.ts`'s `readJson`, but for reading a fetch *response*. */
async function readJson(response: Response): Promise<unknown> {
  return response.json().catch(() => undefined);
}

/** POSTs/PATCHes/PUTs straight to `/api/v1`, decoding `{ data }` and throwing the server's own
 * plain-language `{ error }` string on failure - never routed through `@/lib/services` (see
 * the module comment for why). */
async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers as Record<string, string> | undefined) },
  });
  const payload = (await readJson(response)) as { data?: T; error?: string } | undefined;
  if (!response.ok) throw new Error(payload?.error ?? "Something went wrong. Please try again.");
  return payload?.data as T;
}

/**
 * Local projects worth offering to import: there are some, the account hasn't already been
 * migrated, and the server-side project list is empty. Anything that prevents confirming that
 * last point (a network error, an unreachable server) means "don't offer" rather than risking
 * a duplicate import against an account that turns out not to be empty after all.
 */
export async function projectsToOffer(): Promise<Project[]> {
  if (hasMigrated()) return [];
  const local = readLocalProjects();
  if (local.length === 0) return [];
  try {
    const remote = await request<Project[]>("/api/v1/projects");
    return remote.length === 0 ? local : [];
  } catch {
    return [];
  }
}

/** Fresh ids for every field's `linkTo`, remapped from the local model id it pointed at to
 * the new one the server assigned when that model was created. Mirrors the same remap the
 * mock `ProjectService.duplicate` does for a same-account copy. */
function remapLinks(model: Model, modelIdMap: Map<string, string>): Model["fields"] {
  return model.fields.map((f) => (f.type === "link" && f.linkTo ? { ...f, linkTo: modelIdMap.get(f.linkTo) ?? f.linkTo } : f));
}

async function importOneProject(project: Project): Promise<void> {
  const created = await request<Project>("/api/v1/projects", {
    method: "POST",
    body: JSON.stringify({ name: project.name, description: project.description, templateId: null }),
  });

  const modelIdMap = new Map<string, string>();
  for (const model of project.models) {
    const createdModel = await request<Model>(`/api/v1/projects/${created.id}/models`, {
      method: "POST",
      body: JSON.stringify({ name: model.name }),
    });
    modelIdMap.set(model.id, createdModel.id);
  }

  // A second pass, once every model has a server-side id: a field's `linkTo` may point at a
  // model that was still local-only on the first pass.
  for (const model of project.models) {
    const newId = modelIdMap.get(model.id)!;
    await request(`/api/v1/projects/${created.id}/models/${newId}`, {
      method: "PATCH",
      body: JSON.stringify({ id: newId, name: model.name, fields: remapLinks(model, modelIdMap) }),
    });
  }

  if (project.routes.length > 0) {
    const routes = project.routes.map((r) => ({
      method: r.method,
      path: r.path,
      modelId: r.modelId ? (modelIdMap.get(r.modelId) ?? null) : null,
      action: r.action,
      description: r.description,
      filters: r.filters,
    }));
    await request(`/api/v1/projects/${created.id}/routes`, { method: "POST", body: JSON.stringify({ routes }) });
  }

  for (const model of project.models) {
    const newId = modelIdMap.get(model.id)!;
    // The mock dataset lives outside the persisted payload (see `mock/console-service.ts`),
    // so it's read through that service rather than out of `readLocalProjects`'s own data.
    const records = await mockConsoleService.sampleData(project.id, model.id);
    if (records.length > 0) {
      await request(`/api/v1/projects/${created.id}/models/${newId}/records`, {
        method: "PUT",
        body: JSON.stringify({ records }),
      });
    }
  }
}

export interface ImportOutcome {
  id: string;
  name: string;
  ok: boolean;
  error?: string;
}

/**
 * Imports every given project, in order, each independently: one project failing (a name
 * already taken, a dropped connection) never stops the rest. Nothing is ever deleted from
 * localStorage here - that stays the caller's call, and today nothing calls it, since the
 * data costs nothing to keep and is the only safety net if an import half-finishes.
 */
export async function importLocalProjects(projects: Project[]): Promise<ImportOutcome[]> {
  const results: ImportOutcome[] = [];
  for (const project of projects) {
    try {
      await importOneProject(project);
      results.push({ id: project.id, name: project.name, ok: true });
    } catch (e) {
      results.push({
        id: project.id,
        name: project.name,
        ok: false,
        error: e instanceof Error ? e.message : "Could not import this API.",
      });
    }
  }
  return results;
}
