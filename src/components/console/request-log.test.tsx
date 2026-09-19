import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { LogEntry } from "@/lib/services";
import { renderUi } from "@/test/render";
import { RequestLog } from "./request-log";

function entry(id: string, at: string, status: number): LogEntry {
  return {
    id,
    at,
    routeId: `r-${id}`,
    method: status === 201 ? "POST" : "GET",
    path: status === 201 ? "/products" : "/products/:id",
    request: { routeId: `r-${id}`, params: {}, query: {}, body: undefined },
    response: { status, durationMs: 38, body: { ok: true } },
  };
}

const older = entry("a", "2026-09-20T12:04:31.000Z", 200);
const newer = entry("b", "2026-09-20T12:05:02.000Z", 201);

it("lists rows newest first", () => {
  renderUi(<RequestLog entries={[older, newer]} onReplay={vi.fn()} onClear={vi.fn()} />);
  const rows = within(screen.getByRole("list", { name: "Request log" })).getAllByRole("listitem");
  expect(rows).toHaveLength(2);
  expect(rows[0]).toHaveTextContent("POST");
  expect(rows[0]).toHaveTextContent("/products");
  expect(rows[0]).toHaveTextContent("201");
  expect(rows[0]).toHaveTextContent("38ms");
  expect(rows[1]).toHaveTextContent("200");
});

it("replays the clicked row", async () => {
  const user = userEvent.setup();
  const onReplay = vi.fn();
  renderUi(<RequestLog entries={[older, newer]} onReplay={onReplay} onClear={vi.fn()} />);
  const rows = within(screen.getByRole("list", { name: "Request log" })).getAllByRole("listitem");
  await user.click(within(rows[0]).getByRole("button"));
  expect(onReplay).toHaveBeenCalledWith(newer);
});

it("clears the log", async () => {
  const user = userEvent.setup();
  const onClear = vi.fn();
  renderUi(<RequestLog entries={[newer]} onReplay={vi.fn()} onClear={onClear} />);
  await user.click(screen.getByRole("button", { name: "Clear" }));
  expect(onClear).toHaveBeenCalled();
});

it("says so when nothing has been sent", () => {
  renderUi(<RequestLog entries={[]} onReplay={vi.fn()} onClear={vi.fn()} />);
  expect(screen.getByText("No requests yet.")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Clear" })).not.toBeInTheDocument();
});
