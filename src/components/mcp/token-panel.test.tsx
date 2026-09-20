import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it, vi } from "vitest";
import { TokenPanel } from "./token-panel";

afterEach(() => {
  vi.restoreAllMocks();
});

it("loads safe metadata without rendering a token secret", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ data: [{ id: "tok_1", name: "Claude", createdAt: "2026-01-01", lastUsedAt: null }] }), { status: 200 }));
  render(<TokenPanel />);

  expect(await screen.findByText("Claude")).toBeInTheDocument();
  expect(screen.getByText(/tok_1/i)).toBeInTheDocument();
});

it("shows a newly generated secret exactly once", async () => {
  const fetchSpy = vi.spyOn(globalThis, "fetch");
  fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }));
  fetchSpy.mockResolvedValueOnce(new Response(JSON.stringify({ data: { token: "ua_unique-secret", summary: { id: "tok_1", name: "My MCP client", createdAt: "2026-01-01", lastUsedAt: null } } }), { status: 201 }));
  render(<TokenPanel />);

  await waitFor(() => expect(screen.getByText(/no tokens yet/i)).toBeInTheDocument());
  await userEvent.click(screen.getByRole("button", { name: /generate token/i }));

  expect(await screen.findByText("ua_unique-secret")).toBeInTheDocument();
  expect(screen.getByText(/shown only once/i)).toBeInTheDocument();
});
