import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fieldTypeMeta } from "@/lib/field-types";
import type { Model, Project } from "@/lib/types";

export function ModelFieldsDoc({ model, project }: { model: Model; project: Project }) {
  if (model.fields.length === 0) return null;
  return (
    <div className="overflow-x-auto rounded-2xl border bg-surface">
      <Table>
        <TableHeader>
          <TableRow className="bg-panel">
            <TableHead>Field</TableHead>
            <TableHead>Type</TableHead>
            <TableHead>Required</TableHead>
            <TableHead>Unique</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {model.fields.map((f) => {
            const target = project.models.find((m) => m.id === f.linkTo);
            return (
              <TableRow key={f.id}>
                <TableCell className="font-mono text-sm">{f.name}</TableCell>
                <TableCell className="text-sm">
                  {f.type === "link" && target ? `Link to ${target.name}` : fieldTypeMeta(f.type).label}
                  {f.type === "choice" && f.options?.length ? (
                    <span className="text-muted-foreground"> ({f.options.join(", ")})</span>
                  ) : null}
                </TableCell>
                <TableCell className="text-sm">{f.required ? "Yes" : "No"}</TableCell>
                <TableCell className="text-sm">{f.unique ? "Yes" : "No"}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
