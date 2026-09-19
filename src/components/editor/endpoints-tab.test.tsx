import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorkspaceProvider } from "@/components/workspace/workspace-context";
import { buildCrudRoutes } from "@/lib/crud";
import type { Model, Project, Route } from "@/lib/types";
import { useProjectStore } from "@/store/project-store";
import { renderUi } from "@/test/render";
import { EndpointsTab } from "./endpoints-tab";

const product: Model = { id: "m1", name: "Product", fields: [] };

function storeProject(): Project {
  return {
    id: "p1",
    name: "Store",
    slug: "store",
    description: "",
    models: [product],
    routes: buildCrudRoutes(product, ["list"], []),
    createdAt: "",
    updatedAt: "",
  };
}

function renderTab(project = storeProject()) {
  renderUi(
    <WorkspaceProvider project={project}>
      <EndpointsTab model={product} />
    </WorkspaceProvider>,
  );
}

it("creates only the standard endpoints that are missing and still ticked", async () => {
  const user = userEvent.setup();
  const addRoutes = vi.fn().mockResolvedValue(undefined);
  useProjectStore.setState({ addRoutes } as never);
  renderTab();

  const existing = screen.getByRole("checkbox", { name: /List all products/ });
  expect(existing).toBeChecked();
  expect(existing).toBeDisabled();

  await user.click(screen.getByRole("checkbox", { name: /Delete a product/ }));
  await user.click(screen.getByRole("button", { name: "Create selected" }));

  expect(addRoutes).toHaveBeenCalledTimes(1);
  const [projectId, routes] = addRoutes.mock.calls[0] as [string, Route[]];
  expect(projectId).toBe("p1");
  expect(routes.map((r) => r.action)).toEqual(["get", "create", "update"]);
  expect(routes.map((r) => r.method)).toEqual(["GET", "POST", "PUT"]);
});
