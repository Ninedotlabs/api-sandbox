import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { TOOLS } from "@/mcp/tools";

vi.mock("next/headers", () => ({
  headers: async () =>
    new Map([
      ["host", "app.example.com"],
      ["x-forwarded-proto", "https"],
    ]),
}));

afterEach(() => {
  vi.restoreAllMocks();
});

beforeEach(() => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ data: [] }), { status: 200 }));
});

async function renderPage() {
  const { default: McpPage } = await import("./page");
  render(await McpPage());
}

it("renders exactly one tool-table row per entry in TOOLS", async () => {
  await renderPage();
  const rows = screen.getAllByRole("row");
  expect(rows.length).toBe(TOOLS.length + 1);
});

it("renders personal token management without a deployment-wide secret", async () => {
  await renderPage();
  expect(screen.getByRole("button", { name: /generate token/i })).toBeInTheDocument();
  expect(screen.getByText(/your active tokens/i)).toBeInTheDocument();
});

it("renders the connect snippets for both the local and deployed tabs", async () => {
  const user = userEvent.setup();
  await renderPage();

  expect(screen.getByText(/claude mcp add universal-api/)).toBeInTheDocument();

  await user.click(screen.getByRole("tab", { name: /deployed/i }));
  expect(screen.getByText(/claude mcp add --transport http universal-api https:\/\/app\.example\.com\/api\/mcp/)).toBeInTheDocument();
});

it("states plainly that tokens are account-scoped and revocable", async () => {
  await renderPage();
  expect(screen.getByText(/each token belongs only to your account/i)).toBeInTheDocument();
  expect(screen.getByText(/revoke it here at any time/i)).toBeInTheDocument();
});

it("documents the AI-free describe_api workflow", async () => {
  await renderPage();
  expect(screen.getByText(/AI-free reference containing/i)).toBeInTheDocument();
});
