import { TOOLS } from "@/mcp/tools";
import { TOOL_DOCS } from "./mcp-docs";

describe("TOOL_DOCS", () => {
  it("has exactly one entry per tool in TOOLS, in the same order", () => {
    expect(TOOL_DOCS.map((d) => d.name)).toEqual(TOOLS.map((t) => t.name));
  });

  it("carries each tool's own description and destructive flag unchanged", () => {
    for (const tool of TOOLS) {
      const doc = TOOL_DOCS.find((d) => d.name === tool.name)!;
      expect(doc.description).toBe(tool.description);
      expect(doc.destructive).toBe(Boolean(tool.destructive));
    }
  });

  it("describes get_project's single required string argument", () => {
    const doc = TOOL_DOCS.find((d) => d.name === "get_project")!;
    expect(doc.args).toEqual([{ name: "projectId", type: "string", required: true }]);
  });

  it("describes list_projects as taking no arguments", () => {
    const doc = TOOL_DOCS.find((d) => d.name === "list_projects")!;
    expect(doc.args).toEqual([]);
  });

  it("marks optional and defaulted fields as not required", () => {
    const doc = TOOL_DOCS.find((d) => d.name === "create_project")!;
    const description = doc.args.find((a) => a.name === "description")!;
    expect(description.required).toBe(false);
  });

  it("renders an enum argument as its allowed values", () => {
    const doc = TOOL_DOCS.find((d) => d.name === "call_mock_endpoint")!;
    const method = doc.args.find((a) => a.name === "method")!;
    expect(method.type).toBe("GET | POST | PUT | PATCH | DELETE");
    expect(method.required).toBe(true);
  });

  it("renders an array argument with its element type", () => {
    const doc = TOOL_DOCS.find((d) => d.name === "replace_records")!;
    const records = doc.args.find((a) => a.name === "records")!;
    expect(records.type).toBe("object[]");
  });
});
