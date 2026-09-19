import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorkspaceProvider, useWorkspace } from "@/components/workspace/workspace-context";
import type { Project } from "@/lib/types";
import { renderUi } from "@/test/render";
import { WorkspaceShell } from "./workspace-shell";

const project = {
  id: "p1", name: "Shop", slug: "shop", description: "", models: [], routes: [], createdAt: "", updatedAt: "",
} as Project;

function Toggles() {
  const { setRailOpen, setConsoleOpen } = useWorkspace();
  return (
    <>
      <button onClick={() => setRailOpen(true)}>open rail</button>
      <button onClick={() => setConsoleOpen(true)}>open console</button>
    </>
  );
}

function renderShell() {
  renderUi(
    <WorkspaceProvider project={project}>
      <WorkspaceShell rail={<p>rail pane</p>} editor={<Toggles />} console={<p>console pane</p>} />
    </WorkspaceProvider>,
  );
}

// matchMedia is stubbed to `matches: false` in the setup file, so this is the narrow layout.
it("keeps the rail out of the grid until its drawer opens, and mounts it once", async () => {
  const user = userEvent.setup();
  renderShell();
  expect(screen.queryByText("rail pane")).not.toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "open rail" }));
  expect(await screen.findAllByText("rail pane")).toHaveLength(1);
  expect(screen.queryByText("console pane")).not.toBeInTheDocument();
});

it("keeps the console out of the grid until its drawer opens, and mounts it once", async () => {
  const user = userEvent.setup();
  renderShell();
  expect(screen.queryByText("console pane")).not.toBeInTheDocument();

  await user.click(screen.getByRole("button", { name: "open console" }));
  expect(await screen.findAllByText("console pane")).toHaveLength(1);
  expect(screen.queryByText("rail pane")).not.toBeInTheDocument();
});
