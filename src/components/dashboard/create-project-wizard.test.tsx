import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateProjectWizard } from "./create-project-wizard";

it("walks through the three steps and creates the API", async () => {
  const user = userEvent.setup();
  const onCreate = vi.fn().mockResolvedValue(undefined);
  render(<CreateProjectWizard existingProjects={[]} initialTemplate={null} onCreate={onCreate} />);

  expect(screen.getByText("Step 1 of 3")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Next" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Give your API a name.");

  await user.type(screen.getByLabelText("API name"), "My Store");
  expect(screen.getByText("/api/my-store")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Next" }));

  await user.click(screen.getByRole("button", { name: /Products, customers and orders/ }));
  await user.click(screen.getByRole("button", { name: "Next" }));

  expect(screen.getByText("Product, Customer, Order")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Create API" }));
  expect(onCreate).toHaveBeenCalledWith({ name: "My Store", description: "", templateId: "store" });
});

it("lets you go back", async () => {
  const user = userEvent.setup();
  render(<CreateProjectWizard existingProjects={[]} initialTemplate="todo" onCreate={vi.fn()} />);
  await user.type(screen.getByLabelText("API name"), "Tasks");
  await user.click(screen.getByRole("button", { name: "Next" }));
  expect(screen.getByRole("button", { name: /Tasks with due dates/ })).toHaveAttribute("aria-pressed", "true");
  await user.click(screen.getByRole("button", { name: "Back" }));
  expect(screen.getByLabelText("API name")).toHaveValue("Tasks");
});
