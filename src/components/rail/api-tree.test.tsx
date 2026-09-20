import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorkspaceProvider, useWorkspace } from "@/components/workspace/workspace-context";
import { buildCrudRoutes } from "@/lib/crud";
import { buildTemplateModels } from "@/lib/templates";
import type { Project } from "@/lib/types";
import { renderUi } from "@/test/render";
import { ApiTree } from "./api-tree";

function storeProject(): Project {
  const models = buildTemplateModels("store");
  const product = models.find((m) => m.name === "Product")!;
  return {
    id: "p1",
    name: "Store",
    slug: "store",
    description: "",
    models,
    routes: buildCrudRoutes(product, ["list", "get", "create", "update", "delete"], []),
    createdAt: "",
    updatedAt: "",
  };
}

function Probe() {
  const { selection, railOpen, setRailOpen } = useWorkspace();
  return (
    <>
      <p>sel:{selection ? `${selection.kind}:${selection.id}` : "none"}</p>
      <p>rail:{railOpen ? "open" : "closed"}</p>
      <button onClick={() => setRailOpen(true)}>open rail</button>
    </>
  );
}

function renderTree(project = storeProject(), props: React.ComponentProps<typeof ApiTree> = {}) {
  renderUi(
    <WorkspaceProvider project={project}>
      <ApiTree {...props} />
      <Probe />
    </WorkspaceProvider>,
  );
  return project;
}

it("lists every resource and its endpoints", () => {
  const project = renderTree();
  const tree = screen.getByRole("tree");
  for (const name of ["Product", "Customer", "Order"]) {
    expect(within(tree).getByRole("treeitem", { name })).toHaveAttribute("aria-expanded");
  }
  expect(within(tree).getByRole("treeitem", { name: "GET /products" })).toBeInTheDocument();
  expect(within(tree).getByRole("treeitem", { name: "POST /products" })).toBeInTheDocument();
  expect(within(tree).getByRole("treeitem", { name: "DELETE /products/:id" })).toBeInTheDocument();
  expect(screen.getByText(project.slug, { exact: false })).toBeInTheDocument();
});

it("moves with the arrow keys and selects with Enter", async () => {
  const project = renderTree();
  const user = userEvent.setup();
  screen.getByRole("treeitem", { name: "Product" }).focus();
  await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
  const second = project.routes[1];
  expect(screen.getByText(`sel:endpoint:${second.id}`)).toBeInTheDocument();
  expect(screen.getByRole("treeitem", { name: "GET /products/:id" })).toHaveAttribute("aria-selected", "true");
});

it("collapses and expands a resource with the left and right arrows", async () => {
  renderTree();
  const user = userEvent.setup();
  const product = screen.getByRole("treeitem", { name: "Product" });
  product.focus();
  await user.keyboard("{ArrowLeft}");
  expect(screen.getByRole("treeitem", { name: "Product" })).toHaveAttribute("aria-expanded", "false");
  expect(screen.queryByRole("treeitem", { name: "GET /products" })).not.toBeInTheDocument();
  await user.keyboard("{ArrowRight}");
  expect(screen.getByRole("treeitem", { name: "GET /products" })).toBeInTheDocument();
});

it("selects a resource when its row is clicked", async () => {
  const project = renderTree();
  const user = userEvent.setup();
  await user.click(screen.getByRole("treeitem", { name: "Customer" }));
  const customer = project.models.find((m) => m.name === "Customer")!;
  expect(screen.getByText(`sel:resource:${customer.id}`)).toBeInTheDocument();
});

it("previews the example request when an endpoint is hovered", async () => {
  renderTree();
  const user = userEvent.setup();
  await user.hover(screen.getByRole("treeitem", { name: "POST /products" }));
  expect(await screen.findByText(/Content-Type/)).toBeInTheDocument();
});

it("asks the page to start creating a resource", async () => {
  const onModeChange = vi.fn();
  renderTree(storeProject(), { onModeChange });
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: /^Resource$/ }));
  expect(onModeChange).toHaveBeenCalledWith("new-resource");
});

it("asks the page to open the AI panel", async () => {
  const onModeChange = vi.fn();
  renderTree(storeProject(), { onModeChange });
  const user = userEvent.setup();
  await user.click(screen.getByRole("button", { name: "Generate with AI" }));
  expect(onModeChange).toHaveBeenCalledWith("ai");
});

it("closes the mobile rail drawer once an endpoint is selected", async () => {
  renderTree();
  const user = userEvent.setup();
  await user.click(screen.getByText("open rail"));
  expect(screen.getByText("rail:open")).toBeInTheDocument();
  await user.click(screen.getByRole("treeitem", { name: "GET /products" }));
  expect(screen.getByText("rail:closed")).toBeInTheDocument();
});

it("closes the mobile rail drawer when a resource is selected", async () => {
  renderTree();
  const user = userEvent.setup();
  await user.click(screen.getByText("open rail"));
  await user.click(screen.getByRole("treeitem", { name: "Product" }));
  expect(screen.getByText("rail:closed")).toBeInTheDocument();
});

it("numbers each row against its own siblings", () => {
  renderTree();
  const product = screen.getByRole("treeitem", { name: "Product" });
  expect(product).toHaveAttribute("aria-posinset", "1");
  expect(product).toHaveAttribute("aria-setsize", "3");
  const first = screen.getByRole("treeitem", { name: "GET /products" });
  expect(first).toHaveAttribute("aria-posinset", "1");
  expect(first).toHaveAttribute("aria-setsize", "5");
});
