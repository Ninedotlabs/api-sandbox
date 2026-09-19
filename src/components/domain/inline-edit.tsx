"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Props { value: string; ariaLabel: string; onSave: (value: string) => Promise<void> | void; validate?: (value: string) => string | null; className?: string }

export function InlineEdit({ value, ariaLabel, onSave, validate, className }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function commit() {
    const err = validate?.(draft) ?? null;
    setError(err);
    if (err) return;
    setPending(true);
    try {
      await onSave(draft.trim());
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setPending(false);
    }
  }

  function handleBlur() {
    // A commit triggered by Enter may still be in flight; closing now would
    // both abandon it visually and hide the error if it later rejects.
    if (pending) return;
    if (draft === value) {
      setEditing(false);
      return;
    }
    void commit();
  }

  if (!editing) {
    return (
      <button type="button" aria-label={`${ariaLabel}: ${value}`} className={cn("rounded-sm text-left hover:bg-panel-strong/60 focus-visible:ring-2 focus-visible:ring-accent", className)} onClick={() => { setDraft(value); setError(null); setEditing(true); }}>
        {value}
      </button>
    );
  }
  return (
    <span className="inline-flex flex-col gap-1">
      <Input autoFocus aria-label={ariaLabel} value={draft} aria-invalid={!!error} className={cn("h-8 font-[inherit]", className)}
        onChange={(e) => { setDraft(e.target.value); setError(null); }}
        onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void commit(); } if (e.key === "Escape") setEditing(false); }}
        onBlur={handleBlur} />
      {error && <span role="alert" className="text-xs text-danger">{error}</span>}
    </span>
  );
}
