import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { TOOL_DOCS } from "@/lib/mcp-docs";

/**
 * Generated from `TOOL_DOCS` (in turn derived from `TOOLS`, `src/mcp/tools.ts`) at build
 * time - one row per real tool, so this table can't describe a tool that doesn't exist or
 * miss one that does. See `mcp-docs.test.ts` and this file's own test for the guarantee.
 *
 * `table-fixed` with explicit column widths is load-bearing, not cosmetic. An auto-layout
 * table sizes itself to its content, so a long description simply widened the table past its
 * container - and `TableCell`'s base `whitespace-nowrap` meant descriptions never wrapped at
 * all, so they ran straight over the Arguments column. `whitespace-normal` below overrides
 * that base: `text-wrap` does not, since it sets a different property and Tailwind's merge
 * leaves both in place.
 */
export function ToolsTable() {
  return (
    <Table className="table-fixed">
      <TableHeader>
        <TableRow>
          <TableHead className="w-[26%] min-w-[9rem]">Tool</TableHead>
          <TableHead className="w-[40%]">Description</TableHead>
          <TableHead className="w-[24%]">Arguments</TableHead>
          <TableHead className="w-[10%] min-w-[5.5rem] text-right">Destructive</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {TOOL_DOCS.map((tool) => (
          <TableRow key={tool.name}>
            <TableCell className="align-top font-mono text-[13px] break-words whitespace-normal text-ink">
              {tool.name}
            </TableCell>
            <TableCell className="align-top text-sm leading-relaxed break-words whitespace-normal text-ink-2">
              {tool.description}
            </TableCell>
            <TableCell className="align-top text-sm whitespace-normal">
              {tool.args.length === 0 ? (
                <span className="text-ink-3">None</span>
              ) : (
                <ul className="space-y-1">
                  {tool.args.map((arg) => (
                    <li key={arg.name} className="font-mono text-xs break-words whitespace-normal">
                      <span className="text-ink">{arg.name}</span>
                      {!arg.required && <span className="text-ink-3">?</span>}
                      <span className="text-ink-3">: {arg.type}</span>
                    </li>
                  ))}
                </ul>
              )}
            </TableCell>
            <TableCell className="align-top text-right">
              {tool.destructive ? (
                <Badge variant="destructive">destructive</Badge>
              ) : (
                <span className="text-ink-3">&mdash;</span>
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
