import { executeRoute, generateRecords, seedDataset, type Dataset, type EngineResult } from "./mock-engine";
import type { Model, Project, Route } from "./types";

const EXAMPLE_SEED = 7;

function bodyFrom(model: Model, dataset: Dataset): Record<string, unknown> {
  const record: Record<string, unknown> = { ...generateRecords(model, 1, dataset)[0] };
  delete record.id;
  return record;
}

function hasBody(route: Route): boolean {
  return route.action === "create" || route.action === "update";
}

export function exampleRequest(route: Route, project: Project): Record<string, unknown> | null {
  const model = project.models.find((m) => m.id === route.modelId);
  if (!model || !hasBody(route)) return null;
  return bodyFrom(model, seedDataset(project, 2, EXAMPLE_SEED));
}

export function exampleResponse(route: Route, project: Project): EngineResult {
  const dataset = seedDataset(project, 2, EXAMPLE_SEED);
  const model = project.models.find((m) => m.id === route.modelId);
  const body = model && hasBody(route) ? bodyFrom(model, dataset) : undefined;
  return executeRoute(project, route, { params: { id: "1" }, query: {}, body }, dataset);
}
