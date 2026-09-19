import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildCrudRoutes } from "@/lib/crud";
import type { Model, Project } from "@/lib/types";
import { useProjectStore } from "@/store/project-store";
import { renderUi } from "@/test/render";
import { RouteList } from "./route-list";

const product: Model = { id: "m1", name: "Product", fields: [] };
const routes = buildCrudRoutes(product, ["list", "create"], []);
const project: Project = {
  id: "p1", name: "Store", slug: "store", description: "", models: [product], routes, createdAt: "", updatedAt: "",
};

it("lists routes with method chips and opens the inline editor", async () => {
  const user = userEvent.setup();
  useProjectStore.setState({ saveRoute: vi.fn(), deleteRoute: vi.fn(), restoreRoute: vi.fn() } as never);
  renderUi(<RouteList project={project} routes={routes} />);
  expect(screen.getByText("List all products")).toBeInTheDocument();
  expect(screen.getAllByText("GET")).toHaveLength(1);
  expect(screen.getByRole("link", { name: /Test List all products/ })).toHaveAttribute("href", "/projects/p1/console?route=" + routes[0].id);
  await user.click(screen.getByRole("button", { name: "Edit List all products" }));
  expect(screen.getByLabelText("Path")).toHaveValue("/products");
});
