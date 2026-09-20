/**
 * `send`/`log`/`clearLog` have no `/api/v1` endpoint of their own - `src/lib/services/pg/types.ts`
 * documents why: they're a session/browser concern, not something Postgres persists. So instead
 * of inventing new endpoints, `send` calls the *real* mock API at `/api/:slug/*` (the same one
 * `src/app/api/[slug]/[...path]/route.ts` serves to any outside caller) - which both executes the
 * request for real and persists any mutation, and `log`/`clearLog` keep the session's history in
 * memory for this tab, exactly as `mock/console-service.ts` does with its own module-level `Map`.
 *
 * `reset` has no endpoint either. It's done here as `mock/project-service.ts`'s `duplicate` does
 * sample data: read the project's current shape, run the same pure `seedDataset` the `pg`
 * `RecordService.reset` uses, then write it back through the existing per-model records endpoint.
 */
import { createId } from "@/lib/ids";
import { seedDataset } from "@/lib/mock-engine";
import { fillPath } from "@/lib/paths";
import { baseUrl } from "@/lib/slug";
import type { Project } from "@/lib/types";
import type { ConsoleService, LogEntry } from "../types";
import { apiFetch, apiFetchNullable } from "./client";

const logs = new Map<string, LogEntry[]>();

function fetchProject(projectId: string): Promise<Project | null> {
  return apiFetchNullable<Project>(`/api/v1/projects/${projectId}`);
}

function recordsUrl(projectId: string, modelId: string): string {
  return `/api/v1/projects/${projectId}/models/${modelId}/records`;
}

export const httpConsoleService: ConsoleService = {
  async send(projectId, request) {
    const started = performance.now();
    const durationMs = () => Math.max(1, Math.round(performance.now() - started));

    const project = await fetchProject(projectId);
    const route = project?.routes.find((r) => r.id === request.routeId);
    if (!project || !route) {
      return { status: 404, durationMs: durationMs(), body: { error: "This route no longer exists." } };
    }

    const qs = new URLSearchParams(request.query).toString();
    const url = `${baseUrl(project.slug)}${fillPath(route.path, request.params)}${qs ? `?${qs}` : ""}`;
    const init: RequestInit = { method: route.method };
    if (route.method !== "GET" && route.method !== "DELETE") {
      init.headers = { "Content-Type": "application/json" };
      init.body = JSON.stringify(request.body ?? null);
    }
    const raw = await fetch(url, init);
    const body = raw.status === 204 ? undefined : await raw.json().catch(() => undefined);
    const response = { status: raw.status, durationMs: durationMs(), body };

    const entries = logs.get(projectId) ?? [];
    entries.unshift({
      id: createId("log"),
      at: new Date().toISOString(),
      routeId: route.id,
      method: route.method,
      path: route.path,
      request: JSON.parse(JSON.stringify(request)),
      response,
    });
    entries.splice(50);
    logs.set(projectId, entries);

    return response;
  },

  sampleData(projectId, modelId) {
    return apiFetch(recordsUrl(projectId, modelId));
  },

  async seedRecords(projectId, modelId, records) {
    await apiFetch(recordsUrl(projectId, modelId), { method: "PUT", body: JSON.stringify({ records }) });
  },

  async reset(projectId) {
    const project = await fetchProject(projectId);
    if (!project) return;
    const dataset = seedDataset(project);
    await Promise.all(
      project.models.map((model) =>
        apiFetch(recordsUrl(projectId, model.id), { method: "PUT", body: JSON.stringify({ records: dataset[model.id] ?? [] }) }),
      ),
    );
  },

  async log(projectId) {
    return [...(logs.get(projectId) ?? [])];
  },

  async clearLog(projectId) {
    logs.delete(projectId);
  },
};
