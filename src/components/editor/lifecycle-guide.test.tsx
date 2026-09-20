import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildChecklist } from "@/lib/onboarding";
import { buildTemplateModels } from "@/lib/templates";
import type { Project } from "@/lib/types";
import { LifecycleGuide } from "./lifecycle-guide";

function project(routes: Project["routes"] = []): Project {
  return {
    id: "p1",
    name: "Store",
    slug: "store",
    description: "",
    models: buildTemplateModels("store"),
    routes,
    createdAt: "",
    updatedAt: "",
  };
}

const actions = { define: vi.fn(), generate: vi.fn(), mock: vi.fn(), request: vi.fn(), respond: vi.fn() };

beforeEach(() => Object.values(actions).forEach((fn) => fn.mockClear()));

it("marks define done and mock current when a resource has fields but no endpoints", async () => {
  const user = userEvent.setup();
  render(<LifecycleGuide steps={buildChecklist(project())} actions={actions} />);
  expect(screen.getByRole("listitem", { name: /DEFINE/ })).toHaveAttribute("data-state", "done");
  expect(screen.getByRole("listitem", { name: /MOCK/ })).toHaveAttribute("data-state", "current");
  expect(screen.getByRole("listitem", { name: /REQUEST/ })).toHaveAttribute("data-state", "todo");
  await user.click(screen.getByRole("button", { name: "Create endpoints" }));
  expect(actions.mock).toHaveBeenCalled();
});

it("marks define current when nothing exists yet", async () => {
  const user = userEvent.setup();
  const empty = { ...project(), models: [] };
  render(<LifecycleGuide steps={buildChecklist(empty)} actions={actions} />);
  expect(screen.getByRole("listitem", { name: /DEFINE/ })).toHaveAttribute("data-state", "current");
  await user.click(screen.getByRole("button", { name: "Add a resource" }));
  expect(actions.define).toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Generate with AI" }));
  expect(actions.generate).toHaveBeenCalled();
});

it("marks every step done once the project is tested and documented", () => {
  const routes = [
    { id: "r1", method: "GET" as const, path: "/products", modelId: null, action: "list" as const, description: "", filters: [] },
  ];
  render(
    <LifecycleGuide steps={buildChecklist(project(routes), { tested: true, viewedDocs: true })} actions={actions} />,
  );
  for (const label of ["DEFINE", "MOCK", "REQUEST", "RESPOND"]) {
    expect(screen.getByRole("listitem", { name: new RegExp(label) })).toHaveAttribute("data-state", "done");
  }
});
