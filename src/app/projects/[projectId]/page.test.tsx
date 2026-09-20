import { screen } from "@testing-library/react";
import { WorkspaceProvider } from "@/components/workspace/workspace-context";
import { setMockLatency } from "@/lib/services/mock/latency";
import type { Project } from "@/lib/types";
import { useUiStore } from "@/store/ui-store";
import { renderUi } from "@/test/render";
import WorkspacePage from "./page";

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
