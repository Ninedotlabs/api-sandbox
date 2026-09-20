import { buildCrudRoutes } from "./crud";
import { buildChecklist } from "./onboarding";
import { buildTemplateModels } from "./templates";
import type { Project } from "./types";

const base: Project = { id: "p1", name: "S", slug: "s", description: "", models: [], routes: [], createdAt: "", updatedAt: "" };

it("starts with nothing done", () => {
  expect(buildChecklist(base).map((s) => s.done)).toEqual([false, false, false, false, false]);
});

it("tracks progress from the project and UI flags", () => {
  const models = buildTemplateModels("todo");
  const project = { ...base, models, routes: buildCrudRoutes(models[0], ["list"], []) };
  const steps = buildChecklist(project, { tested: true });
  expect(steps.map((s) => [s.id, s.done])).toEqual([
    ["model", true], ["fields", true], ["routes", true], ["test", true], ["docs", false],
  ]);
});
