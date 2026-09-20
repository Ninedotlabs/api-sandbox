import { createEvent, fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { WorkspaceProvider, useWorkspace } from "@/components/workspace/workspace-context";
import { buildCrudRoutes } from "@/lib/crud";
import { buildTemplateModels } from "@/lib/templates";
import type { Project } from "@/lib/types";
import { useProjectStore } from "@/store/project-store";
import { renderUi } from "@/test/render";
import { ApiTree } from "./api-tree";

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

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

function openMenu(row: HTMLElement) {
  fireEvent(row, createEvent.contextMenu(row, { bubbles: true, cancelable: true }));
}

describe("right-click menus", () => {
  it("offers the resource menu, disabling Generate CRUD endpoints once every route exists", async () => {
    const user = userEvent.setup();
    renderTree();
    const row = screen.getByRole("treeitem", { name: "Product" });
    openMenu(row);
    expect(screen.getByRole("menuitem", { name: "Open" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Copy path" })).toBeInTheDocument();
    const generate = screen.getByRole("menuitem", { name: "Generate CRUD endpoints" });
    expect(generate).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("menuitem", { name: "Rename" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Delete" })).toBeInTheDocument();
    await user.keyboard("{Escape}");

    const customerRow = screen.getByRole("treeitem", { name: "Customer" });
    openMenu(customerRow);
    expect(screen.getByRole("menuitem", { name: "Generate 5 missing endpoints" })).toBeInTheDocument();
  });

  it("offers the endpoint menu", () => {
    renderTree();
    const row = screen.getByRole("treeitem", { name: "GET /products" });
    openMenu(row);
    expect(screen.getByRole("menuitem", { name: "Open" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Send in console" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Copy path" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Copy as cURL" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Delete" })).toBeInTheDocument();
  });

  it("still previews the example request on hover once wrapped in a context menu", async () => {
    renderTree();
    const user = userEvent.setup();
    await user.hover(screen.getByRole("treeitem", { name: "POST /products" }));
    expect(await screen.findByText(/Content-Type/)).toBeInTheDocument();
  });

  it("renames a resource inline from its context menu", async () => {
    const user = userEvent.setup();
    const saveModel = vi.fn().mockResolvedValue(undefined);
    useProjectStore.setState({ saveModel } as never);
    const project = renderTree();
    const product = project.models.find((m) => m.name === "Product")!;
    const row = screen.getByRole("treeitem", { name: "Product" });
    openMenu(row);
    await user.click(screen.getByRole("menuitem", { name: "Rename" }));

    const input = await screen.findByRole("textbox", { name: "Resource name" });
    await user.clear(input);
    await user.type(input, "Item{Enter}");
    expect(saveModel).toHaveBeenCalledWith("p1", { ...product, name: "Item" });
  });

  it("deletes a resource with an undo toast", async () => {
    const user = userEvent.setup();
    const project = renderTree();
    const product = project.models.find((m) => m.name === "Product")!;
    const removed = { model: product, beforeId: null, routes: [], links: [] };
    const deleteModel = vi.fn().mockResolvedValue(removed);
    const restoreModel = vi.fn().mockResolvedValue(undefined);
    useProjectStore.setState({ deleteModel, restoreModel } as never);
    const row = screen.getByRole("treeitem", { name: "Product" });
    openMenu(row);
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));
    expect(deleteModel).toHaveBeenCalledWith("p1", product.id);
    expect(toast).toHaveBeenCalledWith("Product deleted", expect.objectContaining({ action: expect.objectContaining({ label: "Undo" }) }));
  });

  it("deletes an endpoint with an undo toast", async () => {
    const user = userEvent.setup();
    const project = renderTree();
    const route = project.routes[0];
    const removed = { route, beforeId: null };
    const deleteRoute = vi.fn().mockResolvedValue(removed);
    const restoreRoute = vi.fn().mockResolvedValue(undefined);
    useProjectStore.setState({ deleteRoute, restoreRoute } as never);
    const row = screen.getByRole("treeitem", { name: `${route.method} ${route.path}` });
    openMenu(row);
    await user.click(screen.getByRole("menuitem", { name: "Delete" }));
    expect(deleteRoute).toHaveBeenCalledWith("p1", route.id);
    expect(toast).toHaveBeenCalledWith(
      `${route.method} ${route.path} deleted`,
      expect.objectContaining({ action: expect.objectContaining({ label: "Undo" }) }),
    );
  });

  it("sends an endpoint to the console and opens it on mobile", async () => {
    function ConsoleProbe() {
      const { consoleRouteId, consoleOpen } = useWorkspace();
      return <p>console:{consoleOpen ? "open" : "closed"}:{consoleRouteId ?? "none"}</p>;
    }
    const project = storeProject();
    const user = userEvent.setup();
    renderUi(
      <WorkspaceProvider project={project}>
        <ApiTree />
        <ConsoleProbe />
      </WorkspaceProvider>,
    );
    const route = project.routes[0];
    const row = screen.getByRole("treeitem", { name: `${route.method} ${route.path}` });
    openMenu(row);
    await user.click(screen.getByRole("menuitem", { name: "Send in console" }));
    expect(screen.getByText(`console:open:${route.id}`)).toBeInTheDocument();
  });

  it("leaves the browser's menu alone on Shift+right-click", () => {
    renderTree();
    const row = screen.getByRole("treeitem", { name: "Product" });
    const event = createEvent.contextMenu(row, { bubbles: true, cancelable: true, shiftKey: true });
    fireEvent(row, event);
    expect(event.defaultPrevented).toBe(false);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
