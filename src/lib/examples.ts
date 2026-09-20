import { executeRoute, generateRecords, seedDataset, type DataRecord, type Dataset, type EngineResult } from "./mock-engine";
import { applyResponseShape, runResponseQuery, type ShapedResponse } from "./response-shape";
import { baseUrl } from "./slug";
import type { Model, Project, Route, RouteResponse } from "./types";

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

/**
 * What a caller actually gets from this endpoint's Response section, rendered against the
 * project's real (seeded) records - so the endpoint editor's live preview shows the truth,
 * not a guess. `draftResponse` is the editor's in-progress, not-yet-saved `response`, so the
 * preview updates as the user types.
 */
export function previewResponseShape(route: Route, draftResponse: RouteResponse | undefined, project: Project): ShapedResponse {
  const draftRoute: Route = { ...route, response: draftResponse };
  const dataset = seedDataset(project, 3, EXAMPLE_SEED);
  const model = project.models.find((m) => m.id === draftRoute.modelId);
  const params: Record<string, string> = draftRoute.action === "get" || draftRoute.action === "update" || draftRoute.action === "delete" ? { id: "1" } : {};
  const body = model && hasBody(draftRoute) ? bodyFrom(model, dataset) : undefined;
  const engineResult = executeRoute(project, draftRoute, { params, query: {}, body }, dataset);

  let records: DataRecord[] | undefined;
  if (draftRoute.action === "custom" && draftResponse?.query) {
    const queriedModel = project.models.find((m) => m.id === draftResponse.query!.modelId);
    records = queriedModel ? runResponseQuery(queriedModel, dataset[queriedModel.id] ?? [], draftResponse.query!) : [];
  }

  return applyResponseShape(draftRoute, engineResult, { params, query: {}, body, records });
}

/** The example request as an HTTP message: request line, headers, then the body when there is one. */
export function exampleRequestText(route: Route, project: Project): string {
  const body = exampleRequest(route, project);
  const lines = [`${route.method} ${baseUrl(project.slug)}${route.path}`];
  if (body) lines.push("Content-Type: application/json", "", JSON.stringify(body, null, 2));
  return lines.join("\n");
}
