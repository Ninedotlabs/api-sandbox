import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TOOL_DOCS } from "@/lib/mcp-docs";

/**
 * Generated from `TOOL_DOCS` (in turn derived from `TOOLS`, `src/mcp/tools.ts`) at build
 * time - one row per real tool, so this table can't describe a tool that doesn't exist or
 * miss one that does. See `mcp-docs.test.ts` and this file's own test for the guarantee.
 */
export function ToolsTable() {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Tool</TableHead>
          <TableHead>Description</TableHead>
          <TableHead>Arguments</TableHead>
          <TableHead>Destructive</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {TOOL_DOCS.map((tool) => (
          <TableRow key={tool.name}>
            <TableCell className="align-top font-mono text-sm whitespace-nowrap">{tool.name}</TableCell>
            <TableCell className="max-w-md align-top text-wrap text-sm text-ink-2">{tool.description}</TableCell>
            <TableCell className="align-top text-sm">
              {tool.args.length === 0 ? (
                <span className="text-ink-3">None</span>
              ) : (
                <ul className="space-y-0.5">
                  {tool.args.map((arg) => (
                    <li key={arg.name} className="font-mono text-xs whitespace-nowrap">
                      <span className="text-ink">{arg.name}</span>
                      {!arg.required && <span className="text-ink-3">?</span>}
                      <span className="text-ink-3">: {arg.type}</span>
                    </li>
                  ))}
                </ul>
              )}
            </TableCell>
            <TableCell className="align-top">
              {tool.destructive ? <Badge variant="destructive">destructive</Badge> : <span className="text-ink-3">&mdash;</span>}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
