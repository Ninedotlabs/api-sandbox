import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useSearchParams } from "next/navigation";
import type { Project } from "@/lib/types";
import { WorkspaceProvider, useWorkspace } from "./workspace-context";

const project = { id: "p1", name: "Shop", slug: "shop", description: "", models: [], routes: [], createdAt: "", updatedAt: "" } as Project;

function Probe() {
  const w = useWorkspace();
  return (
    <>
      <p>sel:{w.selection ? `${w.selection.kind}:${w.selection.id}` : "none"}</p>
      <p>console:{w.consoleRouteId ?? "none"}</p>
      <button onClick={() => w.select({ kind: "endpoint", id: "r9" })}>pick</button>
      <p>draft:{w.consoleDraft ? "yes" : "none"}</p>
      <button onClick={() => w.loadInConsole("r2", { body: { a: 1 } })}>load</button>
      <button onClick={() => w.select({ kind: "endpoint", id: "r5" })}>pick other</button>
    </>
  );
}

it("reads the selection from the URL and updates it", async () => {
  vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams("resource=m1") as never);
  const user = userEvent.setup();
  render(
    <WorkspaceProvider project={project}>
      <Probe />
    </WorkspaceProvider>,
  );
  expect(screen.getByText("sel:resource:m1")).toBeInTheDocument();
  await user.click(screen.getByText("pick"));
  expect(screen.getByText("sel:endpoint:r9")).toBeInTheDocument();
  expect(screen.getByText("console:r9")).toBeInTheDocument();
  await user.click(screen.getByText("load"));
  expect(screen.getByText("console:r2")).toBeInTheDocument();
});

it("keeps a loaded console endpoint until the tree selection moves", async () => {
  vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams("endpoint=r1") as never);
  const user = userEvent.setup();
  render(
    <WorkspaceProvider project={project}>
      <Probe />
    </WorkspaceProvider>,
  );
  expect(screen.getByText("console:r1")).toBeInTheDocument();
  await user.click(screen.getByText("load"));
  expect(screen.getByText("console:r2")).toBeInTheDocument();
  expect(screen.getByText("draft:yes")).toBeInTheDocument();
  // Picking another endpoint in the tree makes the console follow it again.
  await user.click(screen.getByText("pick other"));
  expect(screen.getByText("console:r5")).toBeInTheDocument();
  expect(screen.getByText("draft:none")).toBeInTheDocument();
});
