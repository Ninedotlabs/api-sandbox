import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

it("creates a custom route and opens its editor", async () => {
  const user = userEvent.setup();
  const addRoutes = vi.fn().mockResolvedValue(undefined);
  useProjectStore.setState({ addRoutes, saveRoute: vi.fn(), deleteRoute: vi.fn(), restoreRoute: vi.fn() } as never);
  renderUi(<ResourceRoutesPanel project={project} model={product} />);
  await user.click(screen.getByRole("button", { name: "Custom route" }));
  const [, routes] = addRoutes.mock.calls[0] as [string, Route[]];
  expect(routes[0]).toMatchObject({ method: "GET", path: "/new-route", modelId: "m1", action: "custom" });
});
