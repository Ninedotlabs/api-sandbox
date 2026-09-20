"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Props {
  value: string;
  ariaLabel: string;
  onSave: (value: string) => Promise<void> | void;
  validate?: (value: string) => string | null;
  className?: string;
  /** Lets a caller (e.g. a context menu's Rename) put the row into edit mode; uncontrolled when left out. */
  editing?: boolean;
  onEditingChange?: (editing: boolean) => void;
}

export function InlineEdit({ value, ariaLabel, onSave, validate, className, editing: editingProp, onEditingChange }: Props) {
  const [internalEditing, setInternalEditing] = useState(false);
  const editing = editingProp ?? internalEditing;
  const setEditing = onEditingChange ?? setInternalEditing;
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // A controller (e.g. a context menu's Rename) can flip `editing` on from the outside; when it
  // does, the draft needs resetting to the current value just as the button's own onClick does.
  const [seenEditingProp, setSeenEditingProp] = useState(editingProp);
  if (editingProp !== undefined && editingProp !== seenEditingProp) {
    setSeenEditingProp(editingProp);
    if (editingProp) {
      setDraft(value);
      setError(null);
    }
  }

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
    // Deliberately not a button: some callers (e.g. a project row) nest this inside a real
    // `<a href>` so native middle-click / Cmd-Click "open in a new tab" keeps working, and a
    // button nested inside an anchor is invalid HTML (and previously caused a click on the name
    // to both rename and navigate). A plain, non-focusable element is safe to nest there; mouse
    // click still starts the rename, and keyboard users reach it via the row's context menu.
    return (
      <span data-inline-edit-trigger="" className={cn("cursor-pointer rounded-sm text-left hover:bg-panel-strong/60", className)} onClick={() => { setDraft(value); setError(null); setEditing(true); }}>
        {value}
      </span>
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
