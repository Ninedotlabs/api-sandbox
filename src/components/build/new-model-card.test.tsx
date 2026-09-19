import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Model, Project } from "@/lib/types";
import { useProjectStore } from "@/store/project-store";
import { NewModelCard } from "./new-model-card";

const project: Project = {
  id: "p1", name: "Store", slug: "store", description: "", models: [{ id: "m1", name: "Product", fields: [] }],
  routes: [], createdAt: "", updatedAt: "",
};

it("creates on Enter, validates duplicates, cancels on Escape", async () => {
  const user = userEvent.setup();
  const created: Model = { id: "m2", name: "Customer", fields: [] };
  const createModel = vi.fn().mockResolvedValue(created);
  useProjectStore.setState({ createModel } as never);
  const onCreated = vi.fn();
  const onCancel = vi.fn();
  render(<NewModelCard project={project} onCreated={onCreated} onCancel={onCancel} />);
  const input = screen.getByLabelText("New model name");
  await user.type(input, "product{Enter}");
  expect(screen.getByRole("alert")).toHaveTextContent("A model with this name already exists.");
  await user.clear(input);
  await user.type(input, "Customer{Enter}");
  expect(createModel).toHaveBeenCalledWith("p1", "Customer");
  expect(onCreated).toHaveBeenCalledWith(created);
  await user.keyboard("{Escape}");
  expect(onCancel).toHaveBeenCalled();
});
