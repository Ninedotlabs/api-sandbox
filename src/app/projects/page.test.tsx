import { createEvent, fireEvent, screen, waitFor } from "@testing-library/react";
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
  useProjectStore.setState({ projects: [], loaded: true, loadError: null });
});

describe("first load", () => {
  it("shows a loading state before the first response, never an empty account", () => {
    useProjectStore.setState({ projects: [], loaded: false, loadError: null });
    const { container } = renderUi(<ProjectsPage />);
    expect(container.querySelector('[data-slot="skeleton"]')).toBeInTheDocument();
    expect(screen.queryByText(/define a resource/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/0 project/i)).not.toBeInTheDocument();
  });

  it("shows a readable error with a retry when the load fails, never an empty account", async () => {
    const user = userEvent.setup();
    const loadProjects = vi.fn().mockResolvedValue(undefined);
    useProjectStore.setState({
      projects: [],
      loaded: false,
      loadError: "Something went wrong. Please try again.",
      loadProjects,
    });
    renderUi(<ProjectsPage />);

    expect(screen.getByRole("alert")).toHaveTextContent(/account could not be reached/i);
    expect(screen.queryByText(/define a resource/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/0 project/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /retry/i }));
    await waitFor(() => expect(loadProjects).toHaveBeenCalled());
  });

  it("shows the empty state only once the list has confirmed the account is empty", () => {
    useProjectStore.setState({ projects: [], loaded: true, loadError: null });
    renderUi(<ProjectsPage />);
    expect(screen.getByText(/define a resource/i)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
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
