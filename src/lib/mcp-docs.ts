/**
 * Turns `TOOLS` (`src/mcp/tools.ts`) into the plain data the `/mcp` docs page renders as a
 * table - name, description, arguments (with types), and whether the tool is destructive.
 * Derived at build time from the real tool list, not hand-written, so the page cannot
 * describe a tool that doesn't exist or omit one that does (see `mcp-docs.test.ts`'s
 * one-row-per-tool assertion, mirrored by the page's own render test).
 *
 * `tools.ts` is finished and reviewed and not modified for this - this module only reads
 * `TOOLS` and introspects each tool's zod schema, entirely from the outside.
 */
import type { z } from "zod";
import { TOOLS, type McpTool } from "@/mcp/tools";

export interface ToolArgDoc {
  name: string;
  type: string;
  required: boolean;
}

export interface ToolDoc {
  name: string;
  description: string;
  destructive: boolean;
  args: ToolArgDoc[];
}

/** The subset of a zod internal `_def` this module actually reads, across zod 4's node kinds. */
interface ZodDef {
  type: string;
  innerType?: z.ZodTypeAny;
  element?: z.ZodTypeAny;
  options?: z.ZodTypeAny[];
  entries?: Record<string, unknown>;
}

function def(schema: z.ZodTypeAny): ZodDef {
  return (schema as unknown as { _def: ZodDef })._def;
}

/** A short, human-readable type name for one field's schema - "string", "number[]", "GET | POST", "any", ... */
function typeName(schema: z.ZodTypeAny): string {
  const d = def(schema);
  switch (d.type) {
    case "optional":
    case "nullable":
    case "default":
      return d.innerType ? typeName(d.innerType) : "unknown";
    case "array":
      return d.element ? `${typeName(d.element)}[]` : "array";
    case "union":
      return (d.options ?? []).map(typeName).join(" | ");
    case "enum":
      return Object.values(d.entries ?? {}).join(" | ");
    case "object":
    case "record":
      return "object";
    case "unknown":
    case "any":
      return "any";
    default:
      return d.type;
  }
}

function describeArgs(schema: z.ZodTypeAny): ToolArgDoc[] {
  const shape = (schema as unknown as { shape?: Record<string, z.ZodTypeAny> }).shape;
  if (!shape) return [];
  return Object.entries(shape).map(([name, field]) => ({
    name,
    type: typeName(field),
    required: !field.isOptional(),
  }));
}

function describeTool(tool: McpTool): ToolDoc {
  return {
    name: tool.name,
    description: tool.description,
    destructive: Boolean(tool.destructive),
    args: describeArgs(tool.schema),
  };
}

export const TOOL_DOCS: ToolDoc[] = TOOLS.map(describeTool);
