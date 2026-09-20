import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { consoleService } from "@/lib/services";
import { setMockLatency } from "@/lib/services/mock/latency";
import type { Project } from "@/lib/types";
import { useProjectStore } from "@/store/project-store";
import { renderUi } from "@/test/render";
import { AiEditPanel } from "./ai-edit-panel";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

beforeEach(() => setMockLatency(0));
afterEach(() => {
  vi.restoreAllMocks();
  // toast.success/error are vi.fn()s from the vi.mock factory above, not spies —
  // restoreAllMocks doesn't clear their call history between tests.
  vi.clearAllMocks();
});

const project: Project = {
  id: "p1",
  name: "Shop",
  slug: "shop",
  description: "",
  models: [{ id: "m1", name: "Book", fields: [{ id: "f1", name: "title", type: "text", required: true, unique: false }] }],
  routes: [{ id: "r1", method: "GET", path: "/books", modelId: "m1", action: "list", description: "", filters: [] }],
  createdAt: "",
  updatedAt: "",
};

const plan = {
  resources: [
    {
      name: "Review",
      description: "",
      fields: [{ name: "rating", type: "number", required: true, unique: false }],
      records: [{ rating: 5 }],
    },
  ],
  customEndpoints: [],
};

it("previews the diff and applies, with no Undo when nothing was replaced", async () => {
  const user = userEvent.setup();
  const fetchSpy = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response(JSON.stringify({ plan, warnings: [] }), { status: 200 }));
  const applyEditPlan = vi
    .fn()
    .mockResolvedValue({ modelIds: ["m9"], newResourceCount: 1, changedResourceCount: 0, endpointCount: 5, replacedRecords: [] });
  useProjectStore.setState({ applyEditPlan, restoreRecords: vi.fn() } as never);
  const onApplied = vi.fn();
  renderUi(<AiEditPanel project={project} onApplied={onApplied} onCancel={vi.fn()} />);
  await user.type(screen.getByLabelText("Describe what should change"), "Add reviews");
  await user.click(screen.getByRole("button", { name: "Preview changes" }));
  expect(await screen.findByText("Review")).toBeInTheDocument();
  expect(screen.getByText("New resources")).toBeInTheDocument();
  expect(screen.getByText("Starts with 1 sample record.")).toBeInTheDocument();
  expect(JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string)).toMatchObject({
    instruction: "Add reviews",
    existing: [{ name: "Book", fields: [{ name: "title", type: "text", required: true, unique: false }] }],
  });
  await user.click(screen.getByRole("button", { name: "Create 1 resource and 5 endpoints" }));
  await waitFor(() => expect(applyEditPlan).toHaveBeenCalledWith("p1", plan));
  expect(onApplied).toHaveBeenCalledWith("m9");
  expect(toast.success).toHaveBeenCalledWith(expect.stringContaining("Updated"));
  // Nothing was replaced, so the success toast must carry no Undo action.
  expect((toast.success as ReturnType<typeof vi.fn>).mock.calls[0][1]).toBeUndefined();
});

it("previews a changed resource's records with 'Replaces', not 'Starts with'", async () => {
  const user = userEvent.setup();
  const changePlan = {
    resources: [
      {
        name: "Book",
        description: "",
        fields: [{ name: "title", type: "text", required: true, unique: false }],
        records: [{ title: "New" }, { title: "New 2" }],
      },
    ],
    customEndpoints: [],
  };
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ plan: changePlan, warnings: [] }), { status: 200 }));
  renderUi(<AiEditPanel project={project} onApplied={vi.fn()} onCancel={vi.fn()} />);
  await user.type(screen.getByLabelText("Describe what should change"), "Change Book's sample data");
  await user.click(screen.getByRole("button", { name: "Preview changes" }));
  expect(await screen.findByText("Changed resources")).toBeInTheDocument();
  expect(screen.getByText("Replaces this resource's sample data with 2 records.")).toBeInTheDocument();
  expect(screen.queryByText(/Starts with/)).not.toBeInTheDocument();
});

it("sends real record ids for existing resources, capped at 20", async () => {
  const user = userEvent.setup();
  const records = Array.from({ length: 25 }, (_, i) => ({ id: i + 1, title: `Book ${i + 1}` }));
  vi.spyOn(consoleService, "sampleData").mockResolvedValue(records);
  const fetchSpy = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response(JSON.stringify({ plan: { resources: [], customEndpoints: [] }, warnings: [] }), { status: 200 }));
  renderUi(<AiEditPanel project={project} onApplied={vi.fn()} onCancel={vi.fn()} />);
  await user.type(screen.getByLabelText("Describe what should change"), "Add reviews linked to Book");
  await user.click(screen.getByRole("button", { name: "Preview changes" }));
  await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
  const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
  expect(body.existing[0].recordIds).toEqual(Array.from({ length: 20 }, (_, i) => String(i + 1)));
});

it("offers Undo, wired to restoreRecords, when applying replaced an existing resource's records", async () => {
  const user = userEvent.setup();
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ plan, warnings: [] }), { status: 200 }));
  const replacedRecords = [{ modelId: "m1", records: [{ id: "1", title: "Old Book" }] }];
  const applyEditPlan = vi
    .fn()
    .mockResolvedValue({ modelIds: ["m1"], newResourceCount: 0, changedResourceCount: 1, endpointCount: 0, replacedRecords });
  const restoreRecords = vi.fn().mockResolvedValue(undefined);
  useProjectStore.setState({ applyEditPlan, restoreRecords } as never);
  renderUi(<AiEditPanel project={project} onApplied={vi.fn()} onCancel={vi.fn()} />);
  await user.type(screen.getByLabelText("Describe what should change"), "Add reviews");
  await user.click(screen.getByRole("button", { name: "Preview changes" }));
  await screen.findByText("Review");
  await user.click(screen.getByRole("button", { name: "Create 1 resource and 5 endpoints" }));
  await waitFor(() => expect(applyEditPlan).toHaveBeenCalled());
  expect(toast.success).toHaveBeenCalledWith(
    expect.any(String),
    expect.objectContaining({ action: expect.objectContaining({ label: "Undo" }) }),
  );
  const [, options] = (toast.success as ReturnType<typeof vi.fn>).mock.calls[0];
  options.action.onClick();
  expect(restoreRecords).toHaveBeenCalledWith("p1", replacedRecords);
});

it("labels the button 'Update the API' and disables it when there is nothing to change", async () => {
  const user = userEvent.setup();
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ plan: { resources: [], customEndpoints: [] }, warnings: [] }), { status: 200 }),
  );
  renderUi(<AiEditPanel project={project} onApplied={vi.fn()} onCancel={vi.fn()} />);
  await user.type(screen.getByLabelText("Describe what should change"), "Do nothing in particular");
  await user.click(screen.getByRole("button", { name: "Preview changes" }));
  expect(await screen.findByText(/Nothing to change/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Update the API" })).toBeDisabled();
});

// I3: the route caps `existing` at 20 resources and 20 fields each; nothing in the panel
// enforced that, so a large project got a hard, undiagnosable failure on every attempt.
it("I3: slices the request to the route's caps: 20 resources, and 20 fields on any one resource", async () => {
  const user = userEvent.setup();
  const manyModels = Array.from({ length: 21 }, (_, i) => ({
    id: `m${i}`,
    name: `Model${i}`,
    fields:
      i === 0
        ? Array.from({ length: 21 }, (_, j) => ({ id: `f${i}-${j}`, name: `field${j}`, type: "text" as const, required: false, unique: false }))
        : [{ id: `f${i}-0`, name: "name", type: "text" as const, required: false, unique: false }],
  }));
  const bigProject: Project = { ...project, models: manyModels };
  const fetchSpy = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response(JSON.stringify({ plan: { resources: [], customEndpoints: [] }, warnings: [] }), { status: 200 }));
  renderUi(<AiEditPanel project={bigProject} onApplied={vi.fn()} onCancel={vi.fn()} />);
  await user.type(screen.getByLabelText("Describe what should change"), "Add something");
  await user.click(screen.getByRole("button", { name: "Preview changes" }));
  await waitFor(() => expect(fetchSpy).toHaveBeenCalled());
  const body = JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string);
  expect(body.existing.length).toBeLessThanOrEqual(20);
  expect(body.existing[0].fields.length).toBeLessThanOrEqual(20);
});

// I4: a transient failure fetching sample data must not permanently disable the panel, and
// must not report itself as an AI-service failure.
it("I4: a failed sample-data fetch reports what actually failed and clears on retry", async () => {
  const user = userEvent.setup();
  // Rejects every call until explicitly switched to resolve below — a `...Once` would only
  // fail the eager background fetch at mount, letting generate()'s own retry quietly
  // succeed and mask the bug this test targets.
  const sampleData = vi.spyOn(consoleService, "sampleData").mockRejectedValue(new Error("boom"));
  renderUi(<AiEditPanel project={project} onApplied={vi.fn()} onCancel={vi.fn()} />);
  await user.type(screen.getByLabelText("Describe what should change"), "Add reviews");
  await user.click(screen.getByRole("button", { name: "Preview changes" }));
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).not.toMatch(/Could not reach the AI service/);
  sampleData.mockResolvedValue([]);
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ plan, warnings: [] }), { status: 200 }));
  await user.click(screen.getByRole("button", { name: "Retry" }));
  expect(await screen.findByText("Review")).toBeInTheDocument();
});

it("I4: does not produce an unhandled rejection when the initial background sample-data fetch fails", async () => {
  vi.spyOn(consoleService, "sampleData").mockRejectedValue(new Error("boom"));
  const unhandled = vi.fn();
  process.on("unhandledRejection", unhandled);
  renderUi(<AiEditPanel project={project} onApplied={vi.fn()} onCancel={vi.fn()} />);
  await new Promise((r) => setTimeout(r, 0));
  process.off("unhandledRejection", unhandled);
  expect(unhandled).not.toHaveBeenCalled();
});

// M7: with zero new resources but new endpoints, the label must read from the non-zero
// counts only ("Create 5 endpoints", not "Create 0 resources and 5 endpoints").
it("M7: labels the apply button from non-zero counts only when there are endpoints but no new resources", async () => {
  const user = userEvent.setup();
  // Book already has every standard CRUD route, so the only new endpoints this plan
  // produces are its two custom ones — isolating the label from standard-route noise.
  const fullCrudProject: Project = {
    ...project,
    routes: [
      { id: "r1", method: "GET", path: "/books", modelId: "m1", action: "list", description: "", filters: [] },
      { id: "r2", method: "GET", path: "/books/:id", modelId: "m1", action: "get", description: "", filters: [] },
      { id: "r3", method: "POST", path: "/books", modelId: "m1", action: "create", description: "", filters: [] },
      { id: "r4", method: "PUT", path: "/books/:id", modelId: "m1", action: "update", description: "", filters: [] },
      { id: "r5", method: "DELETE", path: "/books/:id", modelId: "m1", action: "delete", description: "", filters: [] },
    ],
  };
  const endpointOnlyPlan = {
    resources: [{ name: "Book", description: "", fields: [], records: [] }],
    customEndpoints: [
      { method: "GET", path: "/books/bestsellers", resourceName: "Book", description: "" },
      { method: "GET", path: "/books/new", resourceName: "Book", description: "" },
    ],
  };
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ plan: endpointOnlyPlan, warnings: [] }), { status: 200 }));
  renderUi(<AiEditPanel project={fullCrudProject} onApplied={vi.fn()} onCancel={vi.fn()} />);
  await user.type(screen.getByLabelText("Describe what should change"), "Add endpoints");
  await user.click(screen.getByRole("button", { name: "Preview changes" }));
  expect(await screen.findByRole("button", { name: "Create 2 endpoints" })).toBeInTheDocument();
});

// I5: replacing a resource's records dangles any other resource's inbound link to it. The
// panel already fetches every model's sample data (for real link ids); that same data must
// feed the diff's inbound-link disclosure.
it("I5: discloses inbound links from other resources when a resource's records are replaced", async () => {
  const user = userEvent.setup();
  const projectWithOrder: Project = {
    ...project,
    models: [
      ...project.models,
      { id: "m2", name: "Order", fields: [{ id: "f2", name: "book", type: "link", required: true, unique: false, linkTo: "m1" }] },
    ],
  };
  vi.spyOn(consoleService, "sampleData").mockImplementation(async (_projectId, modelId) => {
    if (modelId === "m2") return [{ id: "1", book: "1" }, { id: "2", book: "1" }, { id: "3", book: "2" }];
    return [];
  });
  const changePlan = {
    resources: [{ name: "Book", description: "", fields: [], records: [{ title: "New" }] }],
    customEndpoints: [],
  };
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ plan: changePlan, warnings: [] }), { status: 200 }));
  renderUi(<AiEditPanel project={projectWithOrder} onApplied={vi.fn()} onCancel={vi.fn()} />);
  await user.type(screen.getByLabelText("Describe what should change"), "Change Book's sample data");
  await user.click(screen.getByRole("button", { name: "Preview changes" }));
  expect(await screen.findByText(/Up to 3 Order records may lose their link to this resource/)).toBeInTheDocument();
});

it("shows the server error with a Retry button", async () => {
  const user = userEvent.setup();
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ error: "AI is not configured. Add the Azure settings to .env.local and restart." }), { status: 503 }),
  );
  renderUi(<AiEditPanel project={project} onApplied={vi.fn()} onCancel={vi.fn()} />);
  await user.type(screen.getByLabelText("Describe what should change"), "Add reviews");
  await user.click(screen.getByRole("button", { name: "Preview changes" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("AI is not configured");
  expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
});
