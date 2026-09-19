"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { moveItem } from "@/lib/arrays";
import { newField } from "@/lib/templates";
import type { Field, Model } from "@/lib/types";
import { fieldErrors } from "@/lib/validation";
import { FieldRow } from "./field-row";

interface Props {
  model: Model;
  models: Model[];
  onSave: (model: Model) => Promise<void> | void;
}

/** Edits a draft copy of the fields. Remount it (via `key`) to reset after the saved model changes. */
export function ModelFieldTable({ model, models, onSave }: Props) {
  const [fields, setFields] = useState<Field[]>(model.fields);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  const errors = fieldErrors(fields);
  const dirty = JSON.stringify(fields) !== JSON.stringify(model.fields);
  const update = (id: string, patch: Partial<Field>) => setFields((fs) => fs.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const move = (from: number, to: number) => setFields((fs) => moveItem(fs, from, to));

  async function save() {
    setShowErrors(true);
    if (Object.keys(errors).length) return;
    setSaving(true);
    try {
      await onSave({ ...model, fields });
      setShowErrors(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-2xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-soft">
              <TableHead className="w-8">
                <span className="sr-only">Reorder</span>
              </TableHead>
              <TableHead>Field</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Settings</TableHead>
              <TableHead className="text-center">Required</TableHead>
              <TableHead className="text-center">Unique</TableHead>
              <TableHead className="w-10">
                <span className="sr-only">Delete</span>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {fields.map((f, i) => (
              <FieldRow
                key={f.id}
                field={f}
                index={i}
                total={fields.length}
                models={models}
                error={showErrors ? errors[f.id] : undefined}
                dragging={dragIndex === i}
                onChange={(patch) => update(f.id, patch)}
                onRemove={() => setFields((fs) => fs.filter((x) => x.id !== f.id))}
                onMove={(to) => move(i, to)}
                onDragStart={() => setDragIndex(i)}
                onDragEnd={() => setDragIndex(null)}
                onDrop={() => {
                  if (dragIndex !== null) move(dragIndex, i);
                  setDragIndex(null);
                }}
              />
            ))}
            <TableRow className="border-t border-dashed border-sketch">
              <TableCell colSpan={7}>
                <Button variant="ghost" size="sm" onClick={() => setFields((fs) => [...fs, newField()])}>
                  <Plus className="size-4" /> Add field
                </Button>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {dirty && <span className="mr-auto text-sm text-warning">You have unsaved changes</span>}
        <Button
          variant="outline"
          disabled={!dirty || saving}
          onClick={() => {
            setFields(model.fields);
            setShowErrors(false);
          }}
        >
          Discard
        </Button>
        <Button disabled={!dirty || saving} onClick={save}>
          {saving ? "Saving…" : "Save fields"}
        </Button>
      </div>
    </div>
  );
}
