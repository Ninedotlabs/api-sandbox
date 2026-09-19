import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildCrudRoutes } from "@/lib/crud";
import type { Model, Project } from "@/lib/types";
import { renderUi } from "@/test/render";
import { ResourceCard } from "./resource-card";

vi.mock("@/lib/services", () => ({
  consoleService: { sampleData: vi.fn().mockResolvedValue([]) },
}));

const product: Model = {
  id: "m1", name: "Product",
  fields: [{ id: "f1", name: "name", type: "text", required: true, unique: false }],
};
const project: Project = {
  id: "p1", name: "Store", slug: "store", description: "", models: [product],
  routes: buildCrudRoutes(product, ["list", "create"], []), createdAt: "", updatedAt: "",
};

it("shows the summary and toggles panels", async () => {
  const user = userEvent.setup();
  const onToggle = vi.fn();
  const { rerender } = renderUi(
    <ResourceCard project={project} model={product} recordCount={5} maxCount={10} openPanel={null} onToggle={onToggle} />,
  );
  expect(screen.getByText("1 field")).toBeInTheDocument();
  expect(screen.getByText("2 routes")).toBeInTheDocument();
  expect(screen.getByText("5 sample records")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Fields" }));
  expect(onToggle).toHaveBeenCalledWith("fields");

  rerender(<ResourceCard project={project} model={product} recordCount={5} maxCount={10} openPanel="fields" onToggle={onToggle} />);
  expect(screen.getByRole("button", { name: "Fields" })).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByRole("button", { name: "Save fields" })).toBeInTheDocument();
});
