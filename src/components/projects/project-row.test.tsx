import { createEvent, fireEvent, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import type { Project } from "@/lib/types";
import { renderUi } from "@/test/render";
import { useProjectStore } from "@/store/project-store";
import { ProjectRow } from "./project-row";

vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }) }));

const project: Project = {
  id: "p1",
  name: "Shop",
  slug: "shop",
  description: "A little store",
  models: [{ id: "m1", name: "Product", fields: [] }],
  routes: [],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};

function renderRow(otherProjects: Project[] = []) {
  renderUi(<ProjectRow project={project} allProjects={[project, ...otherProjects]} />);
  return screen.getByRole("link", { name: /Shop/ });
}

function openMenu(row: HTMLElement) {
  fireEvent(row, createEvent.contextMenu(row, { bubbles: true, cancelable: true }));
}

beforeEach(() => {
  push.mockClear();
  vi.mocked(toast).mockClear();
  vi.mocked(toast.success).mockClear();
  vi.mocked(toast.error).mockClear();
});

it("is a real anchor to the project, so native middle-click / Cmd-click open it in a new tab", () => {
  const row = renderRow();
  expect(row.tagName).toBe("A");
  expect(row).toHaveAttribute("href", "/projects/p1");
});

it("starts a rename by clicking the name directly, without navigating", async () => {
  const user = userEvent.setup();
  renderRow();
  await user.click(screen.getByText("Shop"));
  expect(await screen.findByRole("textbox", { name: "Project name" })).toBeInTheDocument();
  expect(push).not.toHaveBeenCalled();
});

it("opens the project in a new tab via the context menu", async () => {
  const user = userEvent.setup();
  const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);
  const row = renderRow();
  openMenu(row);
  await user.click(screen.getByRole("menuitem", { name: "Open in new tab" }));
  expect(openSpy).toHaveBeenCalledWith("/projects/p1", "_blank", "noopener");
  openSpy.mockRestore();
});

it("navigates to the workspace on Open, and to the reference page on Open reference", async () => {
  const user = userEvent.setup();
  const row = renderRow();
  openMenu(row);
  await user.click(screen.getByRole("menuitem", { name: "Open" }));
  expect(push).toHaveBeenCalledWith("/projects/p1");

  push.mockClear();
  openMenu(row);
  await user.click(screen.getByRole("menuitem", { name: "Open reference" }));
  expect(push).toHaveBeenCalledWith("/projects/p1/reference");
});

it("copies the base URL to the clipboard with a success toast", async () => {
  const user = userEvent.setup();
  const writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
  const row = renderRow();
  openMenu(row);
  await user.click(screen.getByRole("menuitem", { name: "Copy base URL" }));
  expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/api/shop`);
  expect(toast.success).toHaveBeenCalledWith("Base URL copied");
});

it("renames the project inline from the context menu, validating against other projects", async () => {
  const user = userEvent.setup();
  const updateProject = vi.fn().mockResolvedValue(undefined);
  useProjectStore.setState({ updateProject } as never);
  const other: Project = { ...project, id: "p2", name: "Other", slug: "other" };
  const row = renderRow([other]);
  openMenu(row);
  await user.click(screen.getByRole("menuitem", { name: "Rename" }));

  const input = await screen.findByRole("textbox", { name: "Project name" });
  await user.clear(input);
  await user.type(input, "Other{Enter}");
  expect(screen.getByRole("alert")).toHaveTextContent("You already have an API with this name.");
  expect(updateProject).not.toHaveBeenCalled();

  await user.clear(input);
  await user.type(input, "Shop 2{Enter}");
  expect(updateProject).toHaveBeenCalledWith("p1", { name: "Shop 2" });
});

it("duplicates the project and navigates to the copy", async () => {
  const user = userEvent.setup();
  const copy: Project = { ...project, id: "p-copy", name: "Shop copy" };
  const duplicateProject = vi.fn().mockResolvedValue(copy);
  useProjectStore.setState({ duplicateProject } as never);
  const row = renderRow();
  openMenu(row);
  await user.click(screen.getByRole("menuitem", { name: "Duplicate" }));
  expect(duplicateProject).toHaveBeenCalledWith("p1");
  expect(push).toHaveBeenCalledWith("/projects/p-copy");
});

it("reports a plain error when duplicating fails", async () => {
  const user = userEvent.setup();
  useProjectStore.setState({ duplicateProject: vi.fn().mockRejectedValue(new Error("network down")) } as never);
  const row = renderRow();
  openMenu(row);
  await user.click(screen.getByRole("menuitem", { name: "Duplicate" }));
  await waitFor(() => expect(toast.error).toHaveBeenCalledWith("network down"));
});

it("deletes with an undo toast, and Undo restores it", async () => {
  const user = userEvent.setup();
  const deleteProject = vi.fn().mockResolvedValue(project);
  const restoreProject = vi.fn().mockResolvedValue(undefined);
  useProjectStore.setState({ deleteProject, restoreProject } as never);
  const row = renderRow();
  openMenu(row);
  await user.click(screen.getByRole("menuitem", { name: "Delete" }));
  expect(deleteProject).toHaveBeenCalledWith("p1");
  expect(toast).toHaveBeenCalledWith("Shop deleted", expect.objectContaining({ action: expect.objectContaining({ label: "Undo" }) }));

  const [, options] = vi.mocked(toast).mock.calls.find(([message]) => message === "Shop deleted")!;
  const action = (options as unknown as { action: { onClick: () => void } }).action;
  action.onClick();
  expect(restoreProject).toHaveBeenCalledWith(project);
});

it("leaves the browser's menu alone on Shift+right-click", () => {
  const row = renderRow();
  const event = createEvent.contextMenu(row, { bubbles: true, cancelable: true, shiftKey: true });
  fireEvent(row, event);
  expect(event.defaultPrevented).toBe(false);
  expect(screen.queryByRole("menu")).not.toBeInTheDocument();
});

it("opens the icon picker instead of the project when the icon is clicked", async () => {
  renderRow();

  // A real click lands on the SVG inside the button, not the button itself - which is how
  // this navigated in the first place, since an SVG element is not an HTMLElement.
  const svg = screen.getByLabelText(/Change the icon/).querySelector("svg")!;
  const click = createEvent.click(svg, { bubbles: true, cancelable: true });
  fireEvent(svg, click);

  // The row is a real link, so the control has to cancel this very click.
  expect(click.defaultPrevented).toBe(true);
  expect(push).not.toHaveBeenCalled();
  await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
});

it("copies the base URL instead of opening the project", async () => {
  renderRow();

  const svg = screen.getByLabelText(/Copy the base URL/).querySelector("svg")!;
  const click = createEvent.click(svg, { bubbles: true, cancelable: true });
  fireEvent(svg, click);

  expect(click.defaultPrevented).toBe(true);
  expect(push).not.toHaveBeenCalled();
});
