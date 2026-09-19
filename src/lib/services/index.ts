// The one place to swap mock services for HTTP ones when the Express backend exists.
import { mockConsoleService } from "./mock/console-service";
import { mockModelService } from "./mock/model-service";
import { mockProjectService } from "./mock/project-service";
import { mockRouteService } from "./mock/route-service";
import type { ConsoleService, ModelService, ProjectService, RouteService } from "./types";

export type { CreateProjectInput, RemovedModel, RemovedRoute } from "./types";

export const projectService: ProjectService = mockProjectService;
export const modelService: ModelService = mockModelService;
export const routeService: RouteService = mockRouteService;
export const consoleService: ConsoleService = mockConsoleService;
