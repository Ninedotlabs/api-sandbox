import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TooltipProvider } from "@/components/ui/tooltip";
import { WorkspaceProvider } from "@/components/workspace/workspace-context";
import type { Model, Project, Route } from "@/lib/types";
import { useProjectStore } from "@/store/project-store";
import { renderUi } from "@/test/render";
import { EndpointEditor } from "./endpoint-editor";

const product: Model = {
  id: "m1",
  name: "Product",
  fields: [{ id: "f1", name: "name", type: "text", required: true, unique: false }],
};

const route: Route = {
  id: "r1",
  method: "GET",
  path: "/products",
  modelId: "m1",
  action: "list",
  description: "Old name",
  filters: [],
};

function projectWith(r: Route): Project {
  return {
    id: "p1",
    name: "Store",
    slug: "store",
    description: "",
    models: [product],
    routes: [r],
    createdAt: "",
    updatedAt: "",
  };
}

/** Rendered under the same single `TooltipProvider` that `renderUi` adds, so a rerender updates props instead of remounting. */
function tree(r: Route) {
  return (
    <WorkspaceProvider project={projectWith(r)}>
      <EndpointEditor route={r} />
    </WorkspaceProvider>
  );
}

it("keeps the header rename when the Request tab is saved afterwards", async () => {
  const user = userEvent.setup();
  const saveRoute = vi.fn().mockResolvedValue(undefined);
  useProjectStore.setState({ saveRoute } as never);
  const { rerender } = renderUi(tree(route));

  await user.click(screen.getByRole("button", { name: "Endpoint description: Old name" }));
  const description = screen.getByLabelText("Endpoint description");
  await user.clear(description);
  await user.type(description, "New name{Enter}");
  expect(saveRoute).toHaveBeenCalledWith("p1", { ...route, description: "New name" });

  // The store would refresh the project; the editor is not remounted.
  const renamed = { ...route, description: "New name" };
  rerender(<TooltipProvider>{tree(renamed)}</TooltipProvider>);

  const path = screen.getByLabelText("Path");
  await user.clear(path);
  await user.type(path, "/all-products");
  await user.click(screen.getByRole("button", { name: "Save route" }));

  expect(saveRoute).toHaveBeenLastCalledWith("p1", { ...renamed, path: "/all-products" });
});
