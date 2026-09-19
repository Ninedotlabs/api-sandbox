import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Model, Project, Route } from "@/lib/types";
import { renderUi } from "@/test/render";
import { UseItTab } from "./use-it-tab";

const product: Model = {
  id: "m1",
  name: "Product",
  fields: [{ id: "f1", name: "name", type: "text", required: true, unique: false }],
};

const create: Route = {
  id: "r1",
  method: "POST",
  path: "/products",
  modelId: "m1",
  action: "create",
  description: "Add a product",
  filters: [],
};

const project: Project = {
  id: "p1",
  name: "Store",
  slug: "store",
  description: "",
  models: [product],
  routes: [create],
  createdAt: "",
  updatedAt: "",
};

it("shows the cURL snippet and switches to Python", async () => {
  const user = userEvent.setup();
  const { container } = renderUi(<UseItTab project={project} route={create} />);

  const code = () => container.querySelector("pre")!;
  expect(code()).toHaveTextContent("curl -X POST http://localhost:3000/api/store/products");
  expect(code()).toHaveTextContent("-d '{");

  await user.click(screen.getByRole("tab", { name: "Python" }));
  expect(code()).toHaveTextContent("requests.post(");
});
