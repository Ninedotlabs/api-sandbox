import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Project } from "@/lib/types";
import { renderUi } from "@/test/render";
import { useProjectStore } from "@/store/project-store";
import { IconPicker } from "./icon-picker";

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

const project: Project = {
  id: "p1",
  name: "Shop",
  slug: "shop",
  description: "",
  models: [],
  routes: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function renderPicker(icon?: string | null) {
  const updateProject = vi.fn().mockResolvedValue(undefined);
  useProjectStore.setState({ updateProject });
  const onOpenChange = vi.fn();
  renderUi(<IconPicker project={{ ...project, icon }} open onOpenChange={onOpenChange} />);
  return { updateProject, onOpenChange };
}

it("offers the whole library, grouped", () => {
  renderPicker();

  for (const group of ["General", "Commerce", "Media", "People", "Systems"]) {
    expect(screen.getByText(group)).toBeInTheDocument();
  }
  expect(screen.getByRole("button", { name: "Cart" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Database" })).toBeInTheDocument();
});

it("saves the chosen icon and closes", async () => {
  const { updateProject, onOpenChange } = renderPicker();

  await userEvent.click(screen.getByRole("button", { name: "Cart" }));

  await waitFor(() => expect(updateProject).toHaveBeenCalledWith("p1", { icon: "cart" }));
  expect(onOpenChange).toHaveBeenCalledWith(false);
});

it("marks the current choice", () => {
  renderPicker("cart");
  expect(screen.getByRole("button", { name: "Cart" })).toHaveAttribute("aria-pressed", "true");
  expect(screen.getByText("Using Cart.")).toBeInTheDocument();
});

it("says the icon is automatic when the project never chose one", () => {
  renderPicker();

  expect(screen.getByText("Using the automatic icon.")).toBeInTheDocument();
  // Nothing to reset to, so the reset is offered but disabled.
  expect(screen.getByRole("button", { name: "Use the automatic one" })).toBeDisabled();
});

it("hands a project back to its automatic icon", async () => {
  const { updateProject } = renderPicker("cart");

  await userEvent.click(screen.getByRole("button", { name: "Use the automatic one" }));

  await waitFor(() => expect(updateProject).toHaveBeenCalledWith("p1", { icon: null }));
});
