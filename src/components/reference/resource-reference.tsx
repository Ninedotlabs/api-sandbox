import { EndpointReference } from "@/components/reference/endpoint-reference";
import { Kicker } from "@/components/domain/kicker";
import { TypeBadge } from "@/components/domain/type-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { DocSection } from "@/lib/docs";
import type { Project } from "@/lib/types";

/** One section of the reference: a resource's schema table (if any) and its endpoint blocks. */
export function ResourceReference({ section, project }: { section: DocSection; project: Project }) {
  const { model } = section;
  return (
    <section id={section.id} className="scroll-mt-20 space-y-6">
      <div className="space-y-1 border-b border-line pb-3">
        <Kicker>{model ? "Resource" : "Endpoints"}</Kicker>
        <h2 className="text-xl font-semibold text-ink">{section.title}</h2>
      </div>
      {model && model.fields.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <Table>
            <TableHeader>
              <TableRow className="bg-panel-strong/60">
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
                    <TableCell className="font-mono text-sm text-ink">{f.name}</TableCell>
                    <TableCell>
                      <span className="flex items-center gap-1.5">
                        <TypeBadge type={f.type} />
                        {f.type === "link" && target && <span className="text-xs text-ink-3">{`→ ${target.name}`}</span>}
                        {f.type === "choice" && f.options?.length ? (
                          <span className="text-xs text-ink-3">{`(${f.options.join(", ")})`}</span>
                        ) : null}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm text-ink-2">{f.required ? "Yes" : "No"}</TableCell>
                    <TableCell className="text-sm text-ink-2">{f.unique ? "Yes" : "No"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
      <div className="space-y-4">
        {section.endpoints.map((e) => (
          <EndpointReference key={e.route.id} endpoint={e} project={project} />
        ))}
      </div>
    </section>
  );
}
