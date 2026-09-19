"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCell } from "@/lib/format";
import { consoleService } from "@/lib/services";
import type { Model } from "@/lib/types";

export function SampleDataTable({ projectId, model }: { projectId: string; model: Model }) {
  const [rows, setRows] = useState<Record<string, unknown>[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    consoleService.sampleData(projectId, model.id).then((data) => {
      if (!cancelled) setRows(data);
    });
    return () => {
      cancelled = true;
    };
  }, [projectId, model]);

  if (!rows) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {rows.length === 0 ? (
        <p className="text-sm text-ink-3">No sample records yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line bg-surface">
          <Table>
            <TableHeader>
              <TableRow className="bg-panel">
                <TableHead className="font-mono">id</TableHead>
                {model.fields.map((f) => (
                  <TableHead key={f.id} className="font-mono">
                    {f.name}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={String(row.id)}>
                  <TableCell className="font-mono text-xs">{String(row.id)}</TableCell>
                  {model.fields.map((f) => (
                    <TableCell key={f.id} className="max-w-56 truncate text-sm">
                      {formatCell(row[f.name])}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
