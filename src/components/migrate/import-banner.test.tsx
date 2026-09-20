import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Project } from "@/lib/types";
import { useProjectStore } from "@/store/project-store";
import { ImportBanner } from "./import-banner";

const { projectsToOffer, importLocalProjects, markMigrated } = vi.hoisted(() => ({
  projectsToOffer: vi.fn(),
  importLocalProjects: vi.fn(),
  markMigrated: vi.fn(),
}));

vi.mock("@/lib/migrate-local", () => ({ projectsToOffer, importLocalProjects, markMigrated }));

function project(overrides: Partial<Project> = {}): Project {
  return {
    id: "prj_1",
    name: "Bookshop",
    slug: "bookshop",
    description: "",
    models: [],
    routes: [],
    createdAt: "2024-01-01T00:00:00.000Z",
    updatedAt: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  useProjectStore.setState({ loadProjects: vi.fn().mockResolvedValue(undefined) } as never);
});

it("renders nothing while nothing is offered", async () => {
  projectsToOffer.mockResolvedValue([]);
  const { container } = render(<ImportBanner />);
  await waitFor(() => expect(projectsToOffer).toHaveBeenCalled());
  expect(container).toBeEmptyDOMElement();
});

it("offers to import found projects, naming how many", async () => {
  projectsToOffer.mockResolvedValue([project(), project({ id: "prj_2", name: "My Store" })]);
  render(<ImportBanner />);
  expect(await screen.findByText(/found 2 apis saved in this browser/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /import/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /not now/i })).toBeInTheDocument();
});

it("retries the check once the project list loads, offering after a cold-start failure", async () => {
  // The first check runs while the database is still cold; `projectsToOffer` can't confirm
  // the account is empty, so it (correctly) answers "don't offer". Once the project list
  // itself finishes loading - the store's `loaded` flag flips true - the banner should
  // re-check rather than staying hidden until a manual reload.
  projectsToOffer.mockResolvedValueOnce([]).mockResolvedValueOnce([project()]);
  useProjectStore.setState({ loadProjects: vi.fn().mockResolvedValue(undefined), loaded: false } as never);

  render(<ImportBanner />);
  await waitFor(() => expect(projectsToOffer).toHaveBeenCalledTimes(1));
  expect(screen.queryByText(/found 1 api saved in this browser/i)).not.toBeInTheDocument();

  act(() => {
    useProjectStore.setState({ loaded: true } as never);
  });

  expect(await screen.findByText(/found 1 api saved in this browser/i)).toBeInTheDocument();
  expect(projectsToOffer).toHaveBeenCalledTimes(2);
});

it("never imports without an explicit click", async () => {
  projectsToOffer.mockResolvedValue([project()]);
  render(<ImportBanner />);
  await screen.findByText(/found 1 api saved in this browser/i);
  expect(importLocalProjects).not.toHaveBeenCalled();
});

it("dismisses on Not now, without importing or flagging migration done", async () => {
  const user = userEvent.setup();
  projectsToOffer.mockResolvedValue([project()]);
  render(<ImportBanner />);
  await user.click(await screen.findByRole("button", { name: /not now/i }));
  expect(screen.queryByText(/found 1 api/i)).not.toBeInTheDocument();
  expect(importLocalProjects).not.toHaveBeenCalled();
  expect(markMigrated).not.toHaveBeenCalled();
});

it("imports on click, reports per-project success, and refreshes the project list", async () => {
  const user = userEvent.setup();
  const projects = [project(), project({ id: "prj_2", name: "My Store" })];
  projectsToOffer.mockResolvedValue(projects);
  importLocalProjects.mockResolvedValue([
    { id: "prj_1", name: "Bookshop", ok: true },
    { id: "prj_2", name: "My Store", ok: false, error: "Something with this name or address already exists." },
  ]);
  const loadProjects = vi.fn().mockResolvedValue(undefined);
  useProjectStore.setState({ loadProjects } as never);

  render(<ImportBanner />);
  await user.click(await screen.findByRole("button", { name: /import/i }));

  expect(await screen.findByText(/1 of 2/i)).toBeInTheDocument();
  expect(screen.getByText(/my store/i)).toBeInTheDocument();
  expect(screen.getByText(/something with this name or address already exists\./i)).toBeInTheDocument();
  expect(markMigrated).toHaveBeenCalled();
  await waitFor(() => expect(loadProjects).toHaveBeenCalled());
});
