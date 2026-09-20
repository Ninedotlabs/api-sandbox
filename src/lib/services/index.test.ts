/**
 * `NEXT_PUBLIC_USE_MOCK_SERVICES` is read once, at module-evaluation time (see
 * `index.ts`'s own comment on why it must never touch `pg`), so exercising both branches
 * means resetting the module registry and re-importing with the environment variable
 * changed first - the whole suite otherwise runs with it fixed to `"1"` (`vitest.config.ts`).
 */
const ORIGINAL = process.env.NEXT_PUBLIC_USE_MOCK_SERVICES;

afterEach(() => {
  process.env.NEXT_PUBLIC_USE_MOCK_SERVICES = ORIGINAL;
  vi.resetModules();
});

it("selects the mock services when the escape hatch is set", async () => {
  process.env.NEXT_PUBLIC_USE_MOCK_SERVICES = "1";
  vi.resetModules();
  const { projectService } = await import("./index");
  const { mockProjectService } = await import("./mock/project-service");
  expect(projectService).toBe(mockProjectService);
});

it("selects the http services otherwise", async () => {
  process.env.NEXT_PUBLIC_USE_MOCK_SERVICES = "0";
  vi.resetModules();
  const { projectService, modelService, routeService, consoleService } = await import("./index");
  const { httpProjectService } = await import("./http/project-service");
  const { httpModelService } = await import("./http/model-service");
  const { httpRouteService } = await import("./http/route-service");
  const { httpConsoleService } = await import("./http/console-service");
  expect(projectService).toBe(httpProjectService);
  expect(modelService).toBe(httpModelService);
  expect(routeService).toBe(httpRouteService);
  expect(consoleService).toBe(httpConsoleService);
});
