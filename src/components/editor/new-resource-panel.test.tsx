import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Model, Project } from "@/lib/types";
import { useProjectStore } from "@/store/project-store";
import { NewResourcePanel } from "./new-resource-panel";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const project: Project = {
  id: "p1",
  name: "Shop",
  slug: "shop",
  description: "",
  models: [{ id: "m1", name: "Product", fields: [] }],
  routes: [],
  createdAt: "",
  updatedAt: "",
};

it("validates, creates on Enter and reports the new resource", async () => {
  const user = userEvent.setup();
  const created: Model = { id: "m2", name: "Customer", fields: [] };
  const createModel = vi.fn().mockResolvedValue(created);
  useProjectStore.setState({ createModel } as never);
  const onCreated = vi.fn();
  const onCancel = vi.fn();
  render(<NewResourcePanel project={project} onCreated={onCreated} onCancel={onCancel} />);

  const input = screen.getByLabelText("Resource name");
  expect(input).toHaveFocus();
  await user.type(input, "product{Enter}");
  expect(screen.getByRole("alert")).toHaveTextContent("A model with this name already exists.");
  expect(createModel).not.toHaveBeenCalled();

  await user.clear(input);
  await user.type(input, "Customer");
  expect(screen.getByText("/customers")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Create resource" }));
  expect(createModel).toHaveBeenCalledWith("p1", "Customer");
  expect(onCreated).toHaveBeenCalledWith(created);

  await user.keyboard("{Escape}");
  expect(onCancel).toHaveBeenCalled();
});
