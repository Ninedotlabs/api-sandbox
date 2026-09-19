import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Project, Route } from "@/lib/types";
import { renderUi } from "@/test/render";
import { RouteEditor } from "./route-editor";

const list: Route = { id: "r1", method: "GET", path: "/products", modelId: null, action: "custom", description: "List", filters: [] };
const hello: Route = { id: "r2", method: "GET", path: "/hello", modelId: null, action: "custom", description: "Hello", filters: [] };
const project: Project = {
  id: "p1", name: "Store", slug: "store", description: "", models: [], routes: [list, hello], createdAt: "", updatedAt: "",
};

it("blocks a method + path conflict, then saves a valid path", async () => {
  const user = userEvent.setup();
  const onSave = vi.fn().mockResolvedValue(undefined);
  renderUi(<RouteEditor project={project} route={hello} onSave={onSave} />);

  const path = screen.getByLabelText("Path");
  await user.clear(path);
  await user.type(path, "/products");
  await user.click(screen.getByRole("button", { name: "Save route" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Two routes can't share the same method and path.");
  expect(onSave).not.toHaveBeenCalled();

  await user.clear(path);
  await user.type(path, "/hello-world");
  await user.click(screen.getByRole("button", { name: "Save route" }));
  expect(onSave).toHaveBeenCalledWith({ ...hello, path: "/hello-world" });
});

it("previews the response", () => {
  renderUi(<RouteEditor project={project} route={hello} onSave={vi.fn()} />);
  expect(screen.getByText(/This route has no model action yet/)).toBeInTheDocument();
});
