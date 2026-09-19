import { ensureDataset, executeRoute, seedDataset, type Dataset, type EngineResult } from "@/lib/mock-engine";
import type { Project } from "@/lib/types";
import type { ConsoleService } from "../types";
import { findProject } from "./db";
import { delay } from "./latency";

const datasets = new Map<string, Dataset>();

export function resetMockDatasets() {
  datasets.clear();
}

function datasetFor(project: Project): Dataset {
  const existing = datasets.get(project.id);
  if (existing) return ensureDataset(project, existing);
  const fresh = seedDataset(project);
  datasets.set(project.id, fresh);
  return fresh;
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
    return { ...settled, durationMs: Math.max(1, Math.round(performance.now() - started)) };
  },

  async sampleData(projectId, modelId) {
    const project = findProject(projectId);
    return delay(project ? (datasetFor(project)[modelId] ?? []) : []);
  },

  async reset(projectId) {
    datasets.delete(projectId);
    return delay(undefined);
  },
};
