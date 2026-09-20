/**
 * The one place `mock` and `http` are chosen between.
 *
 * `mock` when `NEXT_PUBLIC_USE_MOCK_SERVICES=1` - the escape hatch that keeps component tests
 * running without a database - and `http` (real requests against `/api/v1`, backed by
 * Postgres) otherwise.
 *
 * There is no `pg` branch here, deliberately. This module is reachable from every "use
 * client" component in the app (`project-store.ts` -> `console-panel.tsx`,
 * `import-banner.tsx`, etc.), and Next/Turbopack compiles a real browser bundle for that
 * reachable graph regardless of what a runtime `typeof window` check would pick - a static
 * *or* dynamic `import` of anything under `./pg/*` here fails `next build` with "Module not
 * found: Can't resolve 'tls'/'net'/'util/types'", because the `pg` driver needs Node core
 * modules the browser bundle can't provide. (Confirmed by actually trying it - see the
 * commit history for this file.) That's fine: nothing calls the `http` services' methods at
 * module-evaluation time (they only run from client-triggered event handlers and
 * `useEffect`s, which never execute during the server-side render Next also does of a "use
 * client" tree), so always resolving to `http` outside the mock escape hatch is safe. Server
 * code that genuinely needs Postgres - every `/api/v1/**` and `/api/[slug]/[...path]` route
 * handler - already imports `pg*Service` directly from `@/lib/services/pg/*`, never through
 * this barrel, and should keep doing that.
 */
import { httpConsoleService } from "./http/console-service";
import { httpModelService } from "./http/model-service";
import { httpProjectService } from "./http/project-service";
import { httpRouteService } from "./http/route-service";
import { mockConsoleService } from "./mock/console-service";
import { mockModelService } from "./mock/model-service";
import { mockProjectService } from "./mock/project-service";
import { mockRouteService } from "./mock/route-service";
import type { ConsoleService, ModelService, ProjectService, RouteService } from "./types";

export type { CreateProjectInput, LogEntry, RemovedModel, RemovedProject, RemovedRoute } from "./types";

// A direct `process.env.NEXT_PUBLIC_...` access (not destructured) so Next's build can inline it.
const useMock = process.env.NEXT_PUBLIC_USE_MOCK_SERVICES === "1";

export const projectService: ProjectService = useMock ? mockProjectService : httpProjectService;
export const modelService: ModelService = useMock ? mockModelService : httpModelService;
export const routeService: RouteService = useMock ? mockRouteService : httpRouteService;
export const consoleService: ConsoleService = useMock ? mockConsoleService : httpConsoleService;
