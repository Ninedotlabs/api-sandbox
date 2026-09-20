import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { TOOLS } from "@/mcp/tools";

vi.mock("next/headers", () => ({
  headers: async () =>
    new Map([
      ["host", "app.example.com"],
      ["x-forwarded-proto", "https"],
    ]),
}));

const ORIGINAL_TOKEN = process.env.UNIVERSAL_API_TOKEN;

afterEach(() => {
  if (ORIGINAL_TOKEN === undefined) delete process.env.UNIVERSAL_API_TOKEN;
  else process.env.UNIVERSAL_API_TOKEN = ORIGINAL_TOKEN;
  vi.restoreAllMocks();
});

async function renderPage() {
  const { default: McpPage } = await import("./page");
  render(await McpPage());
}

it("renders exactly one tool-table row per entry in TOOLS", async () => {
  process.env.UNIVERSAL_API_TOKEN = "ua_realsecret1234";
  await renderPage();
  const rows = screen.getAllByRole("row");
  expect(rows.length).toBe(TOOLS.length + 1);
});

it("never renders the real token in full", async () => {
  process.env.UNIVERSAL_API_TOKEN = "ua_realsecret1234";
  await renderPage();
  expect(document.body.innerHTML).not.toContain("ua_realsecret1234");
  expect(screen.getByText("ua_••••••••1234")).toBeInTheDocument();
});

it("renders the connect snippets for both the local and deployed tabs", async () => {
  process.env.UNIVERSAL_API_TOKEN = "ua_realsecret1234";
  const user = userEvent.setup();
  await renderPage();

  expect(screen.getByText(/claude mcp add universal-api/)).toBeInTheDocument();

  await user.click(screen.getByRole("tab", { name: /deployed/i }));
  expect(screen.getByText(/claude mcp add --transport http universal-api https:\/\/app\.example\.com\/api\/mcp/)).toBeInTheDocument();
});

it("states plainly that anyone holding the token can read and modify every project", async () => {
  process.env.UNIVERSAL_API_TOKEN = "ua_realsecret1234";
  await renderPage();
  expect(screen.getByText(/anyone holding (the|this) token can read and modify every project/i)).toBeInTheDocument();
});
