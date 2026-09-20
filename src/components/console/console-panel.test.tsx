import { createEvent, fireEvent, screen, waitFor, within } from "@testing-library/react";
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

function openMenu(row: HTMLElement) {
  fireEvent(row, createEvent.contextMenu(row, { bubbles: true, cancelable: true }));
}

describe("right-click menus", () => {
  it("disables Copy response and Clear log until there's a response and a logged request", async () => {
    const user = userEvent.setup();
    await openConsole(await storeProject());
    await pickCreate(user);

    openMenu(screen.getByTestId("console-response-target"));
    expect(screen.getByRole("menuitem", { name: "Copy response" })).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("menuitem", { name: "Copy as cURL" })).not.toHaveAttribute("aria-disabled", "true");
    expect(screen.getByRole("menuitem", { name: "Clear log" })).toHaveAttribute("aria-disabled", "true");
  });

  it("disables the whole menu's cURL item until an endpoint is chosen", async () => {
    await openConsole(await storeProject());
    openMenu(screen.getByTestId("console-response-target"));
    expect(screen.getByRole("menuitem", { name: "Copy as cURL" })).toHaveAttribute("aria-disabled", "true");
  });

  it("copies the pretty response body and a cURL snippet from either the response or the request area", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });
    await openConsole(await storeProject());
    await pickCreate(user);
    await user.type(screen.getByLabelText(/^name/), "Lamp");
    await user.type(screen.getByLabelText(/^price/), "25");
    await user.click(screen.getByRole("button", { name: "Send request" }));
    expect(await screen.findByText(/201 Created/)).toBeInTheDocument();

    openMenu(screen.getByTestId("console-response-target"));
    await user.click(screen.getByRole("menuitem", { name: "Copy response" }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('"name": "Lamp"'));

    openMenu(screen.getByTestId("console-request-target"));
    await user.click(screen.getByRole("menuitem", { name: "Copy as cURL" }));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("curl"));
  });

  it("clears the log from the context menu", async () => {
    const user = userEvent.setup();
    await openConsole(await storeProject());
    await pickCreate(user);
    await user.type(screen.getByLabelText(/^name/), "Lamp");
    await user.type(screen.getByLabelText(/^price/), "25");
    await user.click(screen.getByRole("button", { name: "Send request" }));
    expect(await screen.findByText(/201 Created/)).toBeInTheDocument();
    expect(logRows()).toHaveLength(1);

    openMenu(screen.getByTestId("console-response-target"));
    await user.click(screen.getByRole("menuitem", { name: "Clear log" }));
    expect(await screen.findByText("No requests yet.")).toBeInTheDocument();
  });

  it("leaves the browser's menu alone on Shift+right-click", async () => {
    await openConsole(await storeProject());
    const target = screen.getByTestId("console-response-target");
    const event = createEvent.contextMenu(target, { bubbles: true, cancelable: true, shiftKey: true });
    fireEvent(target, event);
    expect(event.defaultPrevented).toBe(false);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });
});
