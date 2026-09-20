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
