import { exampleRequest, exampleResponse } from "./examples";
import type { EngineResult } from "./mock-engine";
import { groupRoutes } from "./routes";
import type { Model, Project, Route } from "./types";

export interface DocEndpoint {
  route: Route;
  request: Record<string, unknown> | null;
  response: EngineResult;
}

export interface DocSection {
  id: string;
  title: string;
  model: Model | null;
  endpoints: DocEndpoint[];
}

export function buildDocs(project: Project): DocSection[] {
  return groupRoutes(project)
    .filter((g) => g.routes.length > 0)
    .map((g) => ({
      id: g.key,
      title: g.title,
      model: g.model,
      endpoints: g.routes.map((route) => ({
        route,
        request: exampleRequest(route, project),
        response: exampleResponse(route, project),
      })),
    }));
}
