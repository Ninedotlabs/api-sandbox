import { buildCrudRoutes, crudOptions } from "./crud";
import {
  backgroundItems,
  consoleItems,
  endpointItems,
  projectItems,
  resourceItems,
  type ConsoleItemHandlers,
  type EndpointItemHandlers,
  type ProjectItemHandlers,
  type ResourceItemHandlers,
} from "./context-menu-items";
import type { Model, Project, Route, TestResponse } from "./types";

const model: Model = { id: "mdl_1", name: "Book", fields: [] };
const otherModel: Model = { id: "mdl_2", name: "Author", fields: [] };
const fullRoutes = buildCrudRoutes(model, crudOptions(model).map((o) => o.action), []);
const partialRoutes = buildCrudRoutes(model, ["list", "get"], []);
const endpointRoute: Route = partialRoutes[0];

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: "prj_1",
    name: "Bookstore",
    slug: "bookstore",
    description: "",
    models: [model, otherModel],
    routes: fullRoutes,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function projectHandlers(): ProjectItemHandlers {
  return {
    onOpen: vi.fn(),
    onOpenInNewTab: vi.fn(),
    onOpenReference: vi.fn(),
    onCopyBaseUrl: vi.fn(),
    onRename: vi.fn(),
    onDuplicate: vi.fn(),
    onDelete: vi.fn(),
  };
}

describe("projectItems", () => {
  it("returns the project row menu in order, with delete last and dangerous", () => {
    const items = projectItems(makeProject(), projectHandlers());
    expect(items.map((i) => i.id)).toEqual([
      "open",
      "open-new-tab",
      "open-reference",
      "copy-base-url",
      "rename",
      "duplicate",
      "delete",
    ]);
    expect(items.map((i) => i.label)).toEqual([
      "Open",
      "Open in new tab",
      "Open reference",
      "Copy base URL",
      "Rename",
      "Duplicate",
      "Delete",
    ]);
    const del = items.find((i) => i.id === "delete")!;
    expect(del.danger).toBe(true);
    expect(del.separatorBefore).toBe(true);
    expect(items.filter((i) => i.separatorBefore)).toHaveLength(1);
  });

  it("wires each item to its handler, computing the base URL from the project's slug", () => {
    const handlers = projectHandlers();
    const items = projectItems(makeProject({ slug: "my-shop" }), handlers);
    items.find((i) => i.id === "open")!.onSelect();
    expect(handlers.onOpen).toHaveBeenCalledTimes(1);
    items.find((i) => i.id === "open-new-tab")!.onSelect();
    expect(handlers.onOpenInNewTab).toHaveBeenCalledTimes(1);
    items.find((i) => i.id === "open-reference")!.onSelect();
    expect(handlers.onOpenReference).toHaveBeenCalledTimes(1);
    items.find((i) => i.id === "copy-base-url")!.onSelect();
    expect(handlers.onCopyBaseUrl).toHaveBeenCalledWith(`${window.location.origin}/api/my-shop`);
    items.find((i) => i.id === "rename")!.onSelect();
    expect(handlers.onRename).toHaveBeenCalledTimes(1);
    items.find((i) => i.id === "duplicate")!.onSelect();
    expect(handlers.onDuplicate).toHaveBeenCalledTimes(1);
    items.find((i) => i.id === "delete")!.onSelect();
    expect(handlers.onDelete).toHaveBeenCalledTimes(1);
  });
});

function resourceHandlers(): ResourceItemHandlers {
  return { onOpen: vi.fn(), onCopyPath: vi.fn(), onGenerateCrud: vi.fn(), onRename: vi.fn(), onDelete: vi.fn() };
}

describe("resourceItems", () => {
  it("disables Generate CRUD endpoints with a reason when nothing is missing", () => {
    const items = resourceItems(model, fullRoutes, resourceHandlers());
    expect(items.map((i) => i.id)).toEqual(["open", "copy-path", "generate-crud", "rename", "delete"]);
    const generate = items.find((i) => i.id === "generate-crud")!;
    expect(generate.disabled).toBe(true);
    expect(generate.disabledReason).toBe("All endpoints already exist");
    expect(generate.label).toBe("Generate CRUD endpoints");
    const del = items.find((i) => i.id === "delete")!;
    expect(del.danger).toBe(true);
    expect(del.separatorBefore).toBe(true);
  });

  it("labels Generate CRUD endpoints with the missing count and wires the handler with the missing routes", () => {
    const handlers = resourceHandlers();
    const items = resourceItems(model, partialRoutes, handlers);
    const generate = items.find((i) => i.id === "generate-crud")!;
    expect(generate.disabled).toBeFalsy();
    expect(generate.label).toBe("Generate 3 missing endpoints");
    generate.onSelect();
    expect(handlers.onGenerateCrud).toHaveBeenCalledTimes(1);
    const missing = (handlers.onGenerateCrud as ReturnType<typeof vi.fn>).mock.calls[0][0] as Route[];
    expect(missing.map((r) => r.action).sort()).toEqual(["create", "delete", "update"]);
  });

  it("computes the resource path for Copy path", () => {
    const handlers = resourceHandlers();
    const items = resourceItems(model, fullRoutes, handlers);
    items.find((i) => i.id === "copy-path")!.onSelect();
    expect(handlers.onCopyPath).toHaveBeenCalledWith("/books");
  });
});

function endpointHandlers(): EndpointItemHandlers {
  return { onOpen: vi.fn(), onSendInConsole: vi.fn(), onCopyPath: vi.fn(), onCopyCurl: vi.fn(), onDelete: vi.fn() };
}

describe("endpointItems", () => {
  it("returns the endpoint row menu in order, with delete last and dangerous", () => {
    const items = endpointItems(endpointRoute, makeProject(), endpointHandlers());
    expect(items.map((i) => i.id)).toEqual(["open", "send-in-console", "copy-path", "copy-curl", "delete"]);
    const del = items.find((i) => i.id === "delete")!;
    expect(del.danger).toBe(true);
    expect(del.separatorBefore).toBe(true);
  });

  it("computes the path and a cURL snippet for their handlers", () => {
    const handlers = endpointHandlers();
    const items = endpointItems(endpointRoute, makeProject(), handlers);
    items.find((i) => i.id === "copy-path")!.onSelect();
    expect(handlers.onCopyPath).toHaveBeenCalledWith(endpointRoute.path);
    items.find((i) => i.id === "copy-curl")!.onSelect();
    expect(handlers.onCopyCurl).toHaveBeenCalledWith(expect.stringContaining("curl"));
  });
});

function consoleHandlers(): ConsoleItemHandlers {
  return { onCopyResponse: vi.fn(), onCopyCurl: vi.fn(), onClearLog: vi.fn() };
}

describe("consoleItems", () => {
  const response: TestResponse = { status: 200, durationMs: 4, body: { id: "1" } };

  it("disables copy response, copy curl and clear log with reasons when nothing applies", () => {
    const handlers = consoleHandlers();
    const items = consoleItems({ project: makeProject(), route: null, response: null, logEmpty: true }, handlers);
    expect(items.map((i) => i.id)).toEqual(["copy-response", "copy-curl", "clear-log"]);
    expect(items.find((i) => i.id === "copy-response")!.disabled).toBe(true);
    expect(items.find((i) => i.id === "copy-response")!.disabledReason).toBe("Send a request first.");
    expect(items.find((i) => i.id === "copy-curl")!.disabled).toBe(true);
    expect(items.find((i) => i.id === "copy-curl")!.disabledReason).toBe("Choose an endpoint first.");
    expect(items.find((i) => i.id === "clear-log")!.disabled).toBe(true);
    expect(items.find((i) => i.id === "clear-log")!.disabledReason).toBe("The log is already empty.");
  });

  it("wires copy response and copy curl handlers with the pretty JSON body and a cURL snippet", () => {
    const handlers = consoleHandlers();
    const items = consoleItems(
      { project: makeProject(), route: endpointRoute, response, logEmpty: false },
      handlers,
    );
    items.find((i) => i.id === "copy-response")!.onSelect();
    expect(handlers.onCopyResponse).toHaveBeenCalledWith(JSON.stringify(response.body, null, 2));
    items.find((i) => i.id === "copy-curl")!.onSelect();
    expect(handlers.onCopyCurl).toHaveBeenCalledWith(expect.stringContaining("curl"));
    items.find((i) => i.id === "clear-log")!.onSelect();
    expect(handlers.onClearLog).toHaveBeenCalledTimes(1);
  });
});

describe("backgroundItems", () => {
  it("offers the workspace pane items, including an enabled Edit with AI", () => {
    const handlers = { onNewResource: vi.fn(), onNewEndpoint: vi.fn(), onGenerateWithAI: vi.fn(), onEditWithAI: vi.fn() };
    const items = backgroundItems({ kind: "workspace", ...handlers });
    expect(items.map((i) => i.id)).toEqual(["new-resource", "new-endpoint", "generate-with-ai", "edit-with-ai"]);
    expect(items.find((i) => i.id === "generate-with-ai")!.separatorBefore).toBe(true);
    expect(items.find((i) => i.id === "edit-with-ai")!.disabled).toBeFalsy();
    items.find((i) => i.id === "new-resource")!.onSelect();
    expect(handlers.onNewResource).toHaveBeenCalledTimes(1);
    items.find((i) => i.id === "new-endpoint")!.onSelect();
    expect(handlers.onNewEndpoint).toHaveBeenCalledTimes(1);
    items.find((i) => i.id === "generate-with-ai")!.onSelect();
    expect(handlers.onGenerateWithAI).toHaveBeenCalledTimes(1);
    items.find((i) => i.id === "edit-with-ai")!.onSelect();
    expect(handlers.onEditWithAI).toHaveBeenCalledTimes(1);
  });

  it("offers just New project on the projects page background", () => {
    const onNewProject = vi.fn();
    const items = backgroundItems({ kind: "projects", onNewProject });
    expect(items.map((i) => i.id)).toEqual(["new-project"]);
    items[0].onSelect();
    expect(onNewProject).toHaveBeenCalledTimes(1);
  });
});
