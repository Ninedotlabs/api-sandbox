import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TooltipProvider } from "@/components/ui/tooltip";
import { buildCrudRoutes } from "@/lib/crud";
import type { Model, Project, Route } from "@/lib/types";
import { useProjectStore } from "@/store/project-store";
import { renderUi } from "@/test/render";
import { ResourceRoutesPanel } from "./resource-routes-panel";

const product: Model = { id: "m1", name: "Product", fields: [] };
const project: Project = {
  id: "p1", name: "Store", slug: "store", description: "", models: [product],
  routes: buildCrudRoutes(product, ["list"], []), createdAt: "", updatedAt: "",
};

it("adds only the missing standard endpoints that are still ticked", async () => {
  const user = userEvent.setup();
  const addRoutes = vi.fn().mockResolvedValue(undefined);
  useProjectStore.setState({ addRoutes, saveRoute: vi.fn(), deleteRoute: vi.fn(), restoreRoute: vi.fn() } as never);
  renderUi(<ResourceRoutesPanel project={project} model={product} />);
  expect(screen.getByRole("checkbox", { name: /List all products/ })).toBeDisabled();
  await user.click(screen.getByRole("checkbox", { name: /Delete a product/ }));
  await user.click(screen.getByRole("button", { name: "Add 3 endpoints" }));
  const routes = addRoutes.mock.calls[0][1] as Route[];
  expect(routes.map((r) => r.action)).toEqual(["get", "create", "update"]);
});

it("excludes already-created actions from the count after the project updates", async () => {
  const user = userEvent.setup();
  const addRoutes = vi.fn().mockResolvedValue(undefined);
  useProjectStore.setState({ addRoutes, saveRoute: vi.fn(), deleteRoute: vi.fn(), restoreRoute: vi.fn() } as never);
  const { rerender } = renderUi(<ResourceRoutesPanel project={project} model={product} />);
  await user.click(screen.getByRole("button", { name: "Add 4 endpoints" }));

  const created = buildCrudRoutes(product, ["get", "create"], project.routes);
  const updatedProject: Project = { ...project, routes: [...project.routes, ...created] };
  rerender(
    <TooltipProvider>
      <ResourceRoutesPanel project={updatedProject} model={product} />
    </TooltipProvider>,
  );

  expect(screen.queryByRole("button", { name: "Add 4 endpoints" })).not.toBeInTheDocument();
  const button = screen.getByRole("button", { name: "Add 2 endpoints" });
  expect(button).not.toBeDisabled();
  await user.click(button);
  const routes = addRoutes.mock.calls[1][1] as Route[];
  expect(routes.map((r) => r.action)).toEqual(["update", "delete"]);
});

it("creates a custom route", async () => {
  const user = userEvent.setup();
  const addRoutes = vi.fn().mockResolvedValue(undefined);
  useProjectStore.setState({ addRoutes, saveRoute: vi.fn(), deleteRoute: vi.fn(), restoreRoute: vi.fn() } as never);
  renderUi(<ResourceRoutesPanel project={project} model={product} />);
  await user.click(screen.getByRole("button", { name: "Custom route" }));
  const [, routes] = addRoutes.mock.calls[0] as [string, Route[]];
  expect(routes[0]).toMatchObject({ method: "GET", path: "/new-route", modelId: "m1", action: "custom" });
});
