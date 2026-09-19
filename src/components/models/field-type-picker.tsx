"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FIELD_TYPES, fieldTypeMeta, type FieldTypeMeta } from "@/lib/field-types";
import type { FieldType } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  value: FieldType;
  onChange: (type: FieldType) => void;
}

export function FieldTypePicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const current = fieldTypeMeta(value);

  const option = (t: FieldTypeMeta) => (
    <button
      key={t.type}
      type="button"
      aria-pressed={t.type === value}
      onClick={() => {
        onChange(t.type);
        setOpen(false);
      }}
      className={cn(
        "flex items-start gap-3 rounded-md p-2 text-left transition-colors duration-150 hover:bg-accent",
        t.type === value && "bg-primary/10",
      )}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-md border bg-surface font-mono text-sm">
        {t.icon}
      </span>
      <span>
        <span className="block text-sm font-medium">{t.label}</span>
        <span className="block text-xs text-muted-foreground">{t.description}</span>
      </span>
    </button>
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="w-40 justify-start gap-2" aria-label={`Field type: ${current.label}`}>
          <span className="font-mono text-xs">{current.icon}</span>
          {current.label}
          <ChevronDown className="ml-auto size-3.5 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(420px,calc(100vw-32px))] p-2">
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">{FIELD_TYPES.filter((t) => !t.advanced).map(option)}</div>
        <p className="mt-2 border-t px-2 pt-2 text-xs font-medium text-muted-foreground">Advanced</p>
        <div className="grid grid-cols-1 gap-1 sm:grid-cols-2">{FIELD_TYPES.filter((t) => t.advanced).map(option)}</div>
      </PopoverContent>
    </Popover>
  );
}
