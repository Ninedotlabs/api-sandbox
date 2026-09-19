import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildCrudRoutes } from "@/lib/crud";
import type { Project } from "@/lib/types";
import { renderUi } from "@/test/render";
import { RequestForm } from "./request-form";

const product = {
  id: "m1",
  name: "Product",
  fields: [
    { id: "f1", name: "name", type: "text" as const, required: true, unique: false },
    { id: "f2", name: "price", type: "number" as const, required: true, unique: false },
  ],
};
const routes = buildCrudRoutes(product, ["create", "get"], []);
const create = routes.find((r) => r.action === "create")!;
const get = routes.find((r) => r.action === "get")!;
const project: Project = { id: "p1", name: "Store", slug: "store", description: "", models: [product], routes, createdAt: "", updatedAt: "" };

it("builds the body from a schema form", async () => {
  const user = userEvent.setup();
  const onSend = vi.fn();
  renderUi(<RequestForm project={project} route={create} sending={false} onSend={onSend} />);
  expect(screen.getByText("/api/store/products")).toBeInTheDocument();
  await user.type(screen.getByLabelText(/^name/), "Lamp");
  await user.type(screen.getByLabelText(/^price/), "25");
  await user.click(screen.getByRole("button", { name: "Send request" }));
  expect(onSend).toHaveBeenCalledWith({ params: {}, query: {}, body: { name: "Lamp", price: 25 } });
});

it("reports invalid JSON in advanced mode", async () => {
  const user = userEvent.setup();
  const onSend = vi.fn();
  renderUi(<RequestForm project={project} route={create} sending={false} onSend={onSend} />);
  await user.click(screen.getByRole("switch", { name: "Advanced: JSON" }));
  const box = screen.getByLabelText("Request body JSON");
  await user.clear(box);
  await user.click(box);
  await user.paste("{bad");
  await user.click(screen.getByRole("button", { name: "Send request" }));
  expect(screen.getByRole("alert")).toHaveTextContent("That isn't valid JSON");
  expect(onSend).not.toHaveBeenCalled();
});

it("asks for path values", async () => {
  const user = userEvent.setup();
  const onSend = vi.fn();
  renderUi(<RequestForm project={project} route={get} sending={false} onSend={onSend} />);
  await user.type(screen.getByLabelText("id"), "3");
  expect(screen.getByText("/api/store/products/3")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Send request" }));
  expect(onSend).toHaveBeenCalledWith({ params: { id: "3" }, query: {}, body: undefined });
});
