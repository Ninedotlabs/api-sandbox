import { createEvent, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorkspaceProvider } from "@/components/workspace/workspace-context";
import { setMockLatency } from "@/lib/services/mock/latency";
import type { Project } from "@/lib/types";
import { useProjectStore } from "@/store/project-store";
import { useUiStore } from "@/store/ui-store";
import { renderUi } from "@/test/render";
import WorkspacePage from "./page";

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

const project: Project = {
  id: "p-new",
  name: "Fresh",
  slug: "fresh",
  description: "",
  models: [],
  routes: [],
  createdAt: "",
  updatedAt: "",
};

beforeEach(() => {
  setMockLatency(0);
  useUiStore.setState({ progress: {} });
});

it("renders a brand-new project (no progress entry) without a store snapshot loop", () => {
  const errors = vi.spyOn(console, "error").mockImplementation(() => {});
  renderUi(
    <WorkspaceProvider project={project}>
      <WorkspacePage />
    </WorkspaceProvider>,
  );
  expect(screen.getByText(/Define/)).toBeInTheDocument();
  const loopWarnings = errors.mock.calls.filter((c) => String(c[0]).includes("getSnapshot"));
  expect(loopWarnings).toHaveLength(0);
  errors.mockRestore();
});

describe("the background context menu over the lifecycle guide", () => {
  function openMenu() {
    const guide = screen.getByRole("region", { name: "API lifecycle" });
    fireEvent(guide, createEvent.contextMenu(guide, { bubbles: true, cancelable: true }));
  }

  it("offers New resource, New endpoint, Generate with AI and Edit with AI", () => {
    renderUi(
      <WorkspaceProvider project={project}>
        <WorkspacePage />
      </WorkspaceProvider>,
    );
    openMenu();
    expect(screen.getByRole("menuitem", { name: "New resource" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "New endpoint" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Generate with AI" })).toBeInTheDocument();
    const editWithAi = screen.getByRole("menuitem", { name: "Edit with AI" });
    expect(editWithAi).not.toHaveAttribute("aria-disabled", "true");
  });

  it("switches to the new-resource panel from New resource", async () => {
    const user = userEvent.setup();
    renderUi(
      <WorkspaceProvider project={project}>
        <WorkspacePage />
      </WorkspaceProvider>,
    );
    openMenu();
    await user.click(screen.getByRole("menuitem", { name: "New resource" }));
    expect(screen.getByRole("heading", { name: "What does your API store?" })).toBeInTheDocument();
  });

  it("switches to the AI panel from Generate with AI", async () => {
    const user = userEvent.setup();
    renderUi(
      <WorkspaceProvider project={project}>
        <WorkspacePage />
      </WorkspaceProvider>,
    );
    openMenu();
    await user.click(screen.getByRole("menuitem", { name: "Generate with AI" }));
    expect(screen.getByRole("heading", { name: "Describe the API you need" })).toBeInTheDocument();
  });

  it("switches to the AI edit panel from Edit with AI", async () => {
    const user = userEvent.setup();
    renderUi(
      <WorkspaceProvider project={project}>
        <WorkspacePage />
      </WorkspaceProvider>,
    );
    openMenu();
    await user.click(screen.getByRole("menuitem", { name: "Edit with AI" }));
    expect(screen.getByRole("heading", { name: "What should change?" })).toBeInTheDocument();
  });

  it("creates and selects a new endpoint from New endpoint", async () => {
    const user = userEvent.setup();
    const addRoutes = vi.fn().mockResolvedValue(undefined);
    useProjectStore.setState({ addRoutes } as never);
    renderUi(
      <WorkspaceProvider project={project}>
        <WorkspacePage />
      </WorkspaceProvider>,
    );
    openMenu();
    await user.click(screen.getByRole("menuitem", { name: "New endpoint" }));
    expect(addRoutes).toHaveBeenCalledTimes(1);
    const [projectId, routes] = addRoutes.mock.calls[0] as [string, { modelId: string | null }[]];
    expect(projectId).toBe(project.id);
    expect(routes[0].modelId).toBeNull();
  });

  it("leaves the browser's menu alone on Shift+right-click", () => {
    renderUi(
      <WorkspaceProvider project={project}>
        <WorkspacePage />
      </WorkspaceProvider>,
    );
    const guide = screen.getByRole("region", { name: "API lifecycle" });
    const event = createEvent.contextMenu(guide, { bubbles: true, cancelable: true, shiftKey: true });
    fireEvent(guide, event);
    expect(event.defaultPrevented).toBe(false);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
