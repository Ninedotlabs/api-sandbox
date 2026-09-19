import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildCrudRoutes } from "@/lib/crud";
import type { Model, Project, Route } from "@/lib/types";
import { renderUi } from "@/test/render";
import { CrudGeneratorDialog } from "./crud-generator-dialog";

const product: Model = { id: "m1", name: "Product", fields: [] };
const project: Project = {
  id: "p1", name: "Store", slug: "store", description: "", models: [product],
  routes: buildCrudRoutes(product, ["list"], []), createdAt: "", updatedAt: "",
};

it("disables existing endpoints and creates the selected ones", async () => {
  const user = userEvent.setup();
  const onGenerate = vi.fn().mockResolvedValue(undefined);
  renderUi(<CrudGeneratorDialog project={project} model={product} open onOpenChange={vi.fn()} onGenerate={onGenerate} />);

  expect(screen.getByRole("checkbox", { name: /List all products/ })).toBeDisabled();
  expect(screen.getAllByText("/api/store/products/:id", { selector: "code" })).toHaveLength(3);
  await user.click(screen.getByRole("checkbox", { name: /Delete a product/ }));
  await user.click(screen.getByRole("button", { name: "Create 3 endpoints" }));

  const routes = onGenerate.mock.calls[0][0] as Route[];
  expect(routes.map((r) => r.action)).toEqual(["get", "create", "update"]);
});
