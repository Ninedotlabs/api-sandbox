"use client";

import { GripVertical, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TableCell, TableRow } from "@/components/ui/table";
import { fieldTypeMeta } from "@/lib/field-types";
import type { Field, Model } from "@/lib/types";
import { cn } from "@/lib/utils";
import { FieldTypePicker } from "./field-type-picker";

interface Props {
  field: Field;
  index: number;
  total: number;
  models: Model[];
  error?: string;
  dragging: boolean;
  onChange: (patch: Partial<Field>) => void;
  onRemove: () => void;
  onMove: (to: number) => void;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDrop: () => void;
}

function ChoiceOptionsInput({ field, onChange }: Pick<Props, "field" | "onChange">) {
  const [raw, setRaw] = useState((field.options ?? []).join(", "));
  return (
    <Input
      value={raw}
      placeholder="small, medium, large"
      aria-label={`Choices for ${field.name || "new field"}`}
      onChange={(e) => {
        setRaw(e.target.value);
        onChange({ options: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) });
      }}
    />
  );
}

function FieldSettings({ field, models, onChange }: Pick<Props, "field" | "models" | "onChange">) {
  if (field.type === "choice") return <ChoiceOptionsInput field={field} onChange={onChange} />;
  if (field.type === "link") {
    return (
      <Select value={field.linkTo ?? ""} onValueChange={(v) => onChange({ linkTo: v })}>
        <SelectTrigger className="w-full" aria-label={`Model that ${field.name || "new field"} links to`}>
          <SelectValue placeholder="Pick a model" />
        </SelectTrigger>
        <SelectContent>
          {models.map((m) => (
            <SelectItem key={m.id} value={m.id}>
              {m.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }
  return <span className="text-xs text-ink-3">{fieldTypeMeta(field.type).description}</span>;
}

export function FieldRow(props: Props) {
  const { field, index, total, error, onChange } = props;
  const label = field.name || "new field";
  return (
    <TableRow onDragOver={(e) => e.preventDefault()} onDrop={props.onDrop} className={cn(props.dragging && "opacity-50")}>
      <TableCell className="w-8">
        <button
          type="button"
          draggable
          onDragStart={props.onDragStart}
          onDragEnd={props.onDragEnd}
          onKeyDown={(e) => {
            if (e.key === "ArrowUp" && index > 0) {
              e.preventDefault();
              props.onMove(index - 1);
            }
            if (e.key === "ArrowDown" && index < total - 1) {
              e.preventDefault();
              props.onMove(index + 1);
            }
          }}
          aria-label={`Reorder ${label}. Use arrow keys to move`}
          className="cursor-grab rounded-sm p-1 text-ink-3 hover:text-ink"
        >
          <GripVertical className="size-4" />
        </button>
      </TableCell>
      <TableCell className="min-w-44 align-top">
        <Input
          value={field.name}
          placeholder="fieldName"
          aria-label="Field name"
          aria-invalid={!!error}
          className="font-mono"
          onChange={(e) => onChange({ name: e.target.value })}
        />
        {error && (
          <p role="alert" className="mt-1 text-xs text-danger">
            {error}
          </p>
        )}
      </TableCell>
      <TableCell className="align-top">
        <FieldTypePicker
          value={field.type}
          onChange={(type) =>
            onChange({
              type,
              options: type === "choice" ? (field.options ?? []) : undefined,
              linkTo: type === "link" ? field.linkTo : undefined,
            })
          }
        />
      </TableCell>
      <TableCell className="min-w-48 align-top">
        <FieldSettings field={field} models={props.models} onChange={onChange} />
      </TableCell>
      <TableCell className="text-center">
        <Checkbox checked={field.required} onCheckedChange={(v) => onChange({ required: v === true })} aria-label={`${label} is required`} />
      </TableCell>
      <TableCell className="text-center">
        <Checkbox checked={field.unique} onCheckedChange={(v) => onChange({ unique: v === true })} aria-label={`${label} is unique`} />
      </TableCell>
      <TableCell className="w-10">
        <Button variant="ghost" size="icon" onClick={props.onRemove} aria-label={`Delete ${label}`}>
          <Trash2 className="size-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}
