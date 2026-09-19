import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NewProjectRow } from "./new-project-row";

it("creates a project from a template", async () => {
  const user = userEvent.setup();
  const onCreate = vi.fn().mockResolvedValue(undefined);
  render(<NewProjectRow existingProjects={[]} onCreate={onCreate} />);
  await user.type(screen.getByLabelText("Project name"), "My Store");
  await user.click(screen.getByRole("radio", { name: "Store" }));
  await user.click(screen.getByRole("button", { name: "Create" }));
  expect(onCreate).toHaveBeenCalledWith({ name: "My Store", description: "", templateId: "store" });
});

it("shows the template choices as a radiogroup with Blank selected", () => {
  render(<NewProjectRow existingProjects={[]} onCreate={vi.fn()} />);
  expect(screen.getByRole("radiogroup")).toBeInTheDocument();
  expect(screen.getByRole("radio", { name: "Blank" })).toBeChecked();
});

it("asks for a name before creating", async () => {
  const user = userEvent.setup();
  const onCreate = vi.fn();
  render(<NewProjectRow existingProjects={[]} onCreate={onCreate} />);
  await user.click(screen.getByRole("button", { name: "Create" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Give your API a name.");
  expect(onCreate).not.toHaveBeenCalled();
});

it("shows a rejected creation inline and keeps the name", async () => {
  const user = userEvent.setup();
  const onCreate = vi.fn().mockRejectedValue(new Error("boom"));
  render(<NewProjectRow existingProjects={[]} onCreate={onCreate} />);
  await user.type(screen.getByLabelText("Project name"), "My Store");
  await user.click(screen.getByRole("button", { name: "Create" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("boom");
  expect(screen.getByLabelText("Project name")).toHaveValue("My Store");
});
