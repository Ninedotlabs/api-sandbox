import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Project } from "@/lib/types";
import { useProjectStore } from "@/store/project-store";
import { renderUi } from "@/test/render";
import { AiGeneratePanel } from "./ai-generate-panel";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

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
const plan = {
  resources: [
    {
      name: "Book",
      description: "A book",
      fields: [{ name: "title", type: "text", required: true, unique: false }],
      records: [{ title: "Dune" }],
    },
  ],
};

it("generates, previews and applies", async () => {
  const user = userEvent.setup();
  const fetchSpy = vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response(JSON.stringify({ plan, warnings: ["Renamed X to X2."] }), { status: 200 }));
  const applyPlan = vi.fn().mockResolvedValue({ modelIds: ["m9"], routeCount: 5 });
  useProjectStore.setState({ applyPlan } as never);
  const onApplied = vi.fn();
  renderUi(<AiGeneratePanel project={project} onApplied={onApplied} onCancel={vi.fn()} />);
  await user.type(screen.getByLabelText("Describe the API you need"), "A bookstore");
  await user.click(screen.getByRole("button", { name: "Generate" }));
  expect(await screen.findByText("Book")).toBeInTheDocument();
  expect(screen.getByText("Renamed X to X2.")).toBeInTheDocument();
  // Two of the five standard endpoints are GETs (list and get one).
  expect(screen.getAllByText("GET")).toHaveLength(2);
  expect(JSON.parse((fetchSpy.mock.calls[0][1] as RequestInit).body as string)).toMatchObject({
    description: "A bookstore",
    existingResourceNames: [],
  });
  await user.click(screen.getByRole("button", { name: "Create 1 resource, 5 endpoints" }));
  await waitFor(() => expect(applyPlan).toHaveBeenCalledWith("p1", plan));
  expect(onApplied).toHaveBeenCalledWith("m9");
});

it("shows the server error with a Retry button", async () => {
  const user = userEvent.setup();
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ error: "AI is not configured. Add the Azure settings to .env.local and restart." }), {
      status: 503,
    }),
  );
  renderUi(<AiGeneratePanel project={project} onApplied={vi.fn()} onCancel={vi.fn()} />);
  await user.type(screen.getByLabelText("Describe the API you need"), "A shop");
  await user.click(screen.getByRole("button", { name: "Generate" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("AI is not configured");
  expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
});
