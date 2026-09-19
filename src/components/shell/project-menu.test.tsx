import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Project } from "@/lib/types";
import { useProjectStore } from "@/store/project-store";
import { renderUi } from "@/test/render";
import { ProjectMenu } from "./project-menu";

const project: Project = {
  id: "p1", name: "Store", slug: "store", description: "", models: [], routes: [], createdAt: "", updatedAt: "",
};

it("needs two clicks to delete the project", async () => {
  const user = userEvent.setup();
  const deleteProject = vi.fn().mockResolvedValue(project);
  useProjectStore.setState({ deleteProject } as never);
  renderUi(<ProjectMenu project={project} />);
  await user.click(screen.getByRole("button", { name: "Project actions" }));
  expect(await screen.findByRole("menuitem", { name: "Settings" })).toBeInTheDocument();
  await user.click(screen.getByRole("menuitem", { name: "Delete project" }));
  expect(deleteProject).not.toHaveBeenCalled();
  await user.click(screen.getByRole("menuitem", { name: "Sure? Delete" }));
  expect(deleteProject).toHaveBeenCalledWith("p1");
});
