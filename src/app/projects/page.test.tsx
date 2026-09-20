import { createEvent, fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Project } from "@/lib/types";
import { useProjectStore } from "@/store/project-store";
import { renderUi } from "@/test/render";
import ProjectsPage from "./page";

const project: Project = {
  id: "p1",
  name: "Shop",
  slug: "shop",
  description: "",
  models: [],
  routes: [],
  createdAt: "",
  updatedAt: "",
};

function openMenu(target: HTMLElement) {
  fireEvent(target, createEvent.contextMenu(target, { bubbles: true, cancelable: true }));
}

beforeEach(() => {
  useProjectStore.setState({ projects: [], loaded: true });
});

it("offers New project on the page background, and focuses the name input", async () => {
  const user = userEvent.setup();
  renderUi(<ProjectsPage />);
  openMenu(screen.getByRole("main"));
  expect(screen.getByRole("menuitem", { name: "New project" })).toBeInTheDocument();
  await user.click(screen.getByRole("menuitem", { name: "New project" }));
  expect(screen.getByLabelText("Project name")).toHaveFocus();
});

it("leaves the browser's menu alone on Shift+right-click", () => {
  renderUi(<ProjectsPage />);
  const main = screen.getByRole("main");
  const event = createEvent.contextMenu(main, { bubbles: true, cancelable: true, shiftKey: true });
  fireEvent(main, event);
  expect(event.defaultPrevented).toBe(false);
  expect(screen.queryByRole("menu")).not.toBeInTheDocument();
});

it("shows a project row's own menu instead of the page background menu when a row is right-clicked", () => {
  useProjectStore.setState({ projects: [project], loaded: true });
  renderUi(<ProjectsPage />);
  const row = screen.getByRole("link", { name: /Shop/ });
  openMenu(row);
  expect(screen.getByRole("menuitem", { name: "Duplicate" })).toBeInTheDocument();
  expect(screen.queryByRole("menuitem", { name: "New project" })).not.toBeInTheDocument();
});
