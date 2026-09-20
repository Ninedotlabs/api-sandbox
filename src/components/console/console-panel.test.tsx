import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WorkspaceProvider } from "@/components/workspace/workspace-context";
import { buildCrudRoutes } from "@/lib/crud";
import { projectService, routeService } from "@/lib/services";
import { resetMockDatasets } from "@/lib/services/mock/console-service";
import { setMockLatency } from "@/lib/services/mock/latency";
import type { Project } from "@/lib/types";
import { renderUi } from "@/test/render";
import { ConsolePanel } from "./console-panel";

beforeEach(() => {
  localStorage.clear();
  resetMockDatasets();
  setMockLatency(0);
});

async function storeProject(): Promise<Project> {
  const created = await projectService.create({ name: "Store", description: "", templateId: "store" });
  const product = created.models.find((m) => m.name === "Product")!;
  await routeService.createMany(created.id, buildCrudRoutes(product, ["list", "get", "create"], []));
  return (await projectService.get(created.id))!;
}

async function openConsole(project: Project) {
  renderUi(
    <WorkspaceProvider project={project}>
      <ConsolePanel />
    </WorkspaceProvider>,
  );
}

async function pickCreate(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("combobox", { name: "Endpoint" }));
  await user.click(await screen.findByRole("option", { name: "POST /products" }));
}

function logRows() {
  return within(screen.getByRole("list", { name: "Request log" })).getAllByRole("listitem");
}

it("sends the chosen endpoint, shows the response and logs it", async () => {
  const user = userEvent.setup();
  await openConsole(await storeProject());
  await pickCreate(user);

  await user.type(screen.getByLabelText(/^name/), "Lamp");
  await user.click(screen.getByRole("button", { name: "Send request" }));

  expect(await screen.findByText(/400 Bad Request/)).toBeInTheDocument();
  expect(screen.getByText(/'price' is required/)).toBeInTheDocument();

  const rows = logRows();
  expect(rows).toHaveLength(1);
  expect(rows[0]).toHaveTextContent("POST");
  expect(rows[0]).toHaveTextContent("/products");
  expect(rows[0]).toHaveTextContent("400");
});

it("reloads a logged request when its row is clicked", async () => {
  const user = userEvent.setup();
  await openConsole(await storeProject());
  await pickCreate(user);

  await user.type(screen.getByLabelText(/^name/), "Lamp");
  await user.click(screen.getByRole("button", { name: "Send request" }));
  expect(await screen.findByText(/400 Bad Request/)).toBeInTheDocument();

  await user.clear(screen.getByLabelText(/^name/));
  await user.type(screen.getByLabelText(/^name/), "Changed");

  await user.click(within(logRows()[0]).getByRole("button"));

  expect(screen.getByLabelText(/^name/)).toHaveValue("Lamp");
  expect(screen.getByText(/400 Bad Request/)).toBeInTheDocument();
});

it("discards a response that lands after the endpoint changed", async () => {
  const user = userEvent.setup();
  // Long enough that switching endpoints (several ticks of Select interaction) happens in flight.
  setMockLatency(150);
  await openConsole(await storeProject());
  await pickCreate(user);

  await user.type(screen.getByLabelText(/^name/), "Lamp");
  await user.click(screen.getByRole("button", { name: "Send request" }));

  await user.click(screen.getByRole("combobox", { name: "Endpoint" }));
  await user.click(await screen.findByRole("option", { name: "GET /products" }));

  await waitFor(() => expect(logRows()).toHaveLength(1));
  expect(logRows()[0]).toHaveTextContent("POST");
  expect(screen.queryByText(/400 Bad Request/)).not.toBeInTheDocument();
  expect(screen.getByText("Pick an endpoint, fill the request and send it.")).toBeInTheDocument();
});

it("sends with Ctrl+Enter from inside the form", async () => {
  const user = userEvent.setup();
  await openConsole(await storeProject());
  await pickCreate(user);

  await user.click(screen.getByLabelText(/^name/));
  await user.keyboard("Lamp{Control>}{Enter}{/Control}");

  expect(await screen.findByText(/400 Bad Request/)).toBeInTheDocument();
  expect(logRows()).toHaveLength(1);
});
