import { buildCrudRoutes, crudOptions } from "./crud";
import { countLabel } from "./format";
import { buildSnippets } from "./snippets";
import { baseUrl, resourcePath } from "./slug";
import type { Model, Project, Route, TestResponse } from "./types";

/**
 * One row of a right-click menu, declared as data so every menu is buildable and testable
 * without rendering anything. `ContextMenuTarget` is the only thing that turns these into JSX.
 */
export interface ContextMenuItemSpec {
  id: string;
  label: string;
  hint?: string;
  disabled?: boolean;
  /** Shown in `aria-description` (and, visually, as the item's title) when disabled. */
  disabledReason?: string;
  danger?: boolean;
  separatorBefore?: boolean;
  onSelect: () => void;
}

export interface ProjectItemHandlers {
  onOpen: () => void;
  onOpenInNewTab: () => void;
  onOpenReference: () => void;
  onCopyBaseUrl: (url: string) => void;
  onRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

/** The menu for a project row on `/projects`. */
export function projectItems(project: Project, handlers: ProjectItemHandlers): ContextMenuItemSpec[] {
  return [
    { id: "open", label: "Open", onSelect: handlers.onOpen },
    { id: "open-new-tab", label: "Open in new tab", onSelect: handlers.onOpenInNewTab },
    { id: "open-reference", label: "Open reference", onSelect: handlers.onOpenReference },
    {
      id: "copy-base-url",
      label: "Copy base URL",
      onSelect: () => handlers.onCopyBaseUrl(`${window.location.origin}${baseUrl(project.slug)}`),
    },
    { id: "rename", label: "Rename", onSelect: handlers.onRename },
    { id: "duplicate", label: "Duplicate", onSelect: handlers.onDuplicate },
    { id: "delete", label: "Delete", danger: true, separatorBefore: true, onSelect: handlers.onDelete },
  ];
}

export interface ResourceItemHandlers {
  onOpen: () => void;
  onCopyPath: (path: string) => void;
  onGenerateCrud: (missing: Route[]) => void;
  onRename: () => void;
  onDelete: () => void;
}

/** The menu for a resource row in the rail tree. */
export function resourceItems(model: Model, routes: Route[], handlers: ResourceItemHandlers): ContextMenuItemSpec[] {
  const missing = buildCrudRoutes(
    model,
    crudOptions(model).map((o) => o.action),
    routes,
  );
  return [
    { id: "open", label: "Open", onSelect: handlers.onOpen },
    { id: "copy-path", label: "Copy path", onSelect: () => handlers.onCopyPath(resourcePath(model.name)) },
    {
      id: "generate-crud",
      label: missing.length === 0 ? "Generate CRUD endpoints" : `Generate ${countLabel(missing.length, "missing endpoint")}`,
      disabled: missing.length === 0,
      disabledReason: missing.length === 0 ? "All endpoints already exist" : undefined,
      onSelect: () => handlers.onGenerateCrud(missing),
    },
    { id: "rename", label: "Rename", onSelect: handlers.onRename },
    { id: "delete", label: "Delete", danger: true, separatorBefore: true, onSelect: handlers.onDelete },
  ];
}

export interface EndpointItemHandlers {
  onOpen: () => void;
  onSendInConsole: () => void;
  onCopyPath: (path: string) => void;
  onCopyCurl: (curl: string) => void;
  onDelete: () => void;
}

/** The menu for an endpoint row in the rail tree. */
export function endpointItems(route: Route, project: Project, handlers: EndpointItemHandlers): ContextMenuItemSpec[] {
  return [
    { id: "open", label: "Open", onSelect: handlers.onOpen },
    { id: "send-in-console", label: "Send in console", onSelect: handlers.onSendInConsole },
    { id: "copy-path", label: "Copy path", onSelect: () => handlers.onCopyPath(route.path) },
    {
      id: "copy-curl",
      label: "Copy as cURL",
      onSelect: () => handlers.onCopyCurl(buildSnippets(project, route).curl),
    },
    { id: "delete", label: "Delete", danger: true, separatorBefore: true, onSelect: handlers.onDelete },
  ];
}

export interface ConsoleItemsState {
  project: Project;
  /** The endpoint currently loaded in the console, if any. */
  route: Route | null;
  response: TestResponse | null;
  /** The request body currently drafted, used to build the cURL snippet. */
  body?: unknown;
  logEmpty: boolean;
}

export interface ConsoleItemHandlers {
  onCopyResponse: (json: string) => void;
  onCopyCurl: (curl: string) => void;
  onClearLog: () => void;
}

/** The menu for the console's response body and request area. */
export function consoleItems(state: ConsoleItemsState, handlers: ConsoleItemHandlers): ContextMenuItemSpec[] {
  const hasResponse = state.response !== null && state.response.body !== null && state.response.body !== undefined;
  return [
    {
      id: "copy-response",
      label: "Copy response",
      disabled: !hasResponse,
      disabledReason: hasResponse ? undefined : "Send a request first.",
      onSelect: () => handlers.onCopyResponse(JSON.stringify(state.response!.body, null, 2)),
    },
    {
      id: "copy-curl",
      label: "Copy as cURL",
      disabled: !state.route,
      disabledReason: state.route ? undefined : "Choose an endpoint first.",
      onSelect: () => handlers.onCopyCurl(buildSnippets(state.project, state.route!, state.body).curl),
    },
    {
      id: "clear-log",
      label: "Clear log",
      disabled: state.logEmpty,
      disabledReason: state.logEmpty ? "The log is already empty." : undefined,
      onSelect: handlers.onClearLog,
    },
  ];
}

export type BackgroundItemsInput =
  | {
      kind: "workspace";
      onNewResource: () => void;
      onNewEndpoint: () => void;
      onGenerateWithAI: () => void;
    }
  | { kind: "projects"; onNewProject: () => void };

/** The menu for empty space: the workspace editor pane, or the `/projects` background. */
export function backgroundItems(input: BackgroundItemsInput): ContextMenuItemSpec[] {
  if (input.kind === "projects") {
    return [{ id: "new-project", label: "New project", onSelect: input.onNewProject }];
  }
  return [
    { id: "new-resource", label: "New resource", onSelect: input.onNewResource },
    { id: "new-endpoint", label: "New endpoint", onSelect: input.onNewEndpoint },
    { id: "generate-with-ai", label: "Generate with AI", separatorBefore: true, onSelect: input.onGenerateWithAI },
    {
      id: "edit-with-ai",
      label: "Edit with AI",
      disabled: true,
      disabledReason: "Not available yet.",
      onSelect: () => {},
    },
  ];
}
