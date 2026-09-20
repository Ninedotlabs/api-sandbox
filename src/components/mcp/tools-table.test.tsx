import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { TOOLS } from "@/mcp/tools";
import { ToolsTable } from "./tools-table";

it("renders exactly one row per entry in TOOLS", () => {
  render(<ToolsTable />);
  const rows = screen.getAllByRole("row");
  // one header row plus one per tool
  expect(rows.length).toBe(TOOLS.length + 1);
});

it("names every tool", () => {
  render(<ToolsTable />);
  for (const tool of TOOLS) {
    expect(screen.getByText(tool.name)).toBeInTheDocument();
  }
});

it("marks only the destructive tools", () => {
  render(<ToolsTable />);
  expect(screen.getAllByRole("cell", { name: "destructive" }).length).toBe(TOOLS.filter((t) => t.destructive).length);
});
