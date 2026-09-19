import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NewProjectCard } from "./new-project-card";

it("creates an API from a template", async () => {
  const user = userEvent.setup();
  const onCreate = vi.fn().mockResolvedValue(undefined);
  render(<NewProjectCard existingProjects={[]} onCreate={onCreate} />);
  await user.type(screen.getByLabelText("New API name"), "My Store");
  expect(screen.getByText("/api/my-store")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: /Store/ }));
  await user.click(screen.getByRole("button", { name: "Create" }));
  expect(onCreate).toHaveBeenCalledWith({ name: "My Store", description: "", templateId: "store" });
});

it("shows validation inline", async () => {
  const user = userEvent.setup();
  const onCreate = vi.fn();
  render(<NewProjectCard existingProjects={[]} onCreate={onCreate} />);
  await user.click(screen.getByRole("button", { name: "Create" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Give your API a name.");
  expect(onCreate).not.toHaveBeenCalled();
});

it("surfaces a creation error inline and keeps the typed name", async () => {
  const user = userEvent.setup();
  const onCreate = vi.fn().mockRejectedValue(new Error("boom"));
  render(<NewProjectCard existingProjects={[]} onCreate={onCreate} />);
  await user.type(screen.getByLabelText("New API name"), "My Store");
  await user.click(screen.getByRole("button", { name: "Create" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("boom");
  expect(screen.getByLabelText("New API name")).toHaveValue("My Store");
});
