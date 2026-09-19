import { screen } from "@testing-library/react";
import { WorkspaceProvider } from "@/components/workspace/workspace-context";
import type { Project } from "@/lib/types";
import { renderUi } from "@/test/render";
import { TopBar } from "./top-bar";

const project = { id: "p1", name: "Shop", slug: "shop", description: "", models: [], routes: [], createdAt: "", updatedAt: "" } as Project;

it("shows the project switcher, reference link and project menu inside a project", () => {
  renderUi(
    <WorkspaceProvider project={project}>
      <TopBar project={project} />
    </WorkspaceProvider>,
  );
  expect(screen.getByRole("button", { name: /Shop/ })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Reference" })).toHaveAttribute("href", "/projects/p1/reference");
  expect(screen.getByRole("button", { name: "Project actions" })).toBeInTheDocument();
});
