import { createId } from "@/lib/ids";
import { ensureDataset, executeRoute, seedDataset, type Dataset, type EngineResult } from "@/lib/mock-engine";
import type { Project } from "@/lib/types";
import type { ConsoleService, LogEntry } from "../types";
import { findProject } from "./db";
import { delay } from "./latency";

const datasets = new Map<string, Dataset>();
const logs = new Map<string, LogEntry[]>();

export function resetMockDatasets() {
  datasets.clear();
  logs.clear();
}

function datasetFor(project: Project): Dataset {
  const existing = datasets.get(project.id);
  if (existing) return ensureDataset(project, existing);
  const fresh = seedDataset(project);
  datasets.set(project.id, fresh);
  return fresh;
}

/**
 * Removes and returns a single model's records from the dataset, without touching any other
 * model's — unlike `datasetFor`, this never lazily generates sample data for the rest of the
 * project. Used by `ModelService.remove`/`ProjectService.remove` to capture what a delete is
 * about to destroy, mirroring `records.model_id` being `ON DELETE CASCADE` on Postgres.
 */
export function takeModelRecords(projectId: string, modelId: string): Record<string, unknown>[] {
  const dataset = datasets.get(projectId);
  if (!dataset) return [];
  const records = dataset[modelId] ?? [];
  delete dataset[modelId];
  return records;
}

/** Puts a model's records back into the dataset exactly as given (used by Undo). Setting an
 * empty array still records the model as "known", so a later read doesn't mistake it for an
 * untouched model and lazily generate fresh sample data for it. */
export function putModelRecords(projectId: string, modelId: string, records: Record<string, unknown>[]): void {
  const dataset = datasets.get(projectId) ?? {};
  dataset[modelId] = records as Dataset[string];
  datasets.set(projectId, dataset);
}

export const mockConsoleService: ConsoleService = {
  async send(projectId, request) {
    const started = performance.now();
    const project = findProject(projectId);
    const route = project?.routes.find((r) => r.id === request.routeId);
    const result: EngineResult =
      project && route
        ? executeRoute(project, route, request, datasetFor(project))
        : { status: 404, body: { error: "This route no longer exists." } };
    const settled = await delay(result);
    const response = { ...settled, durationMs: Math.max(1, Math.round(performance.now() - started)) };
    if (route) {
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
    }
    return response;
  },

  async sampleData(projectId, modelId) {
    const project = findProject(projectId);
    return delay(project ? (datasetFor(project)[modelId] ?? []) : []);
  },

  async seedRecords(projectId, modelId, records) {
    const project = findProject(projectId);
    if (project) {
      datasetFor(project)[modelId] = records.map((record, i) => ({ ...record, id: String(record.id ?? i + 1) }));
    }
    return delay(undefined);
  },

  async reset(projectId) {
    datasets.delete(projectId);
    return delay(undefined);
  },

  async log(projectId) {
    return delay([...(logs.get(projectId) ?? [])]);
  },

  async clearLog(projectId) {
    logs.delete(projectId);
    return delay(undefined);
  },
};
