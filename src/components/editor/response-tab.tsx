"use client";

import { Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { CodePanel } from "@/components/domain/code-panel";
import { StatusLine } from "@/components/domain/status-line";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { previewResponseShape } from "@/lib/examples";
import type { Project, ResponseMode, Route, RouteResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

/** Enforced again here (schemas.ts enforces it server-side, at write time - the two together
 * satisfy "not only in the editor"), so a caller sees the same limit before saving as after. */
const JSON_CAP_BYTES = 100_000;

const MODES: { mode: ResponseMode; label: string; description: string }[] = [
  { mode: "auto", label: "Auto", description: "The engine's own behaviour. You can still override the status or add headers." },
  { mode: "template", label: "Template", description: "Wrap real data in any JSON shape, using {{placeholders}}." },
  { mode: "static", label: "Static", description: "Return this exact JSON body every time - no engine involved." },
];

const PLACEHOLDERS = [
  { name: "{{records}}", hint: "the full array of matched records" },
  { name: "{{record}}", hint: "a single record" },
  { name: "{{count}}", hint: "how many records matched" },
  { name: "{{params.<name>}}", hint: "a value from the path, e.g. :id" },
  { name: "{{query.<name>}}", hint: "a query-string value" },
  { name: "{{body.<name>}}", hint: "a value from the request body" },
  { name: "{{now}}", hint: "the current time, ISO 8601" },
  { name: "{{uuid}}", hint: "a fresh random id" },
];

interface HeaderRow {
  key: string;
  value: string;
}

function headersToRows(headers?: Record<string, string>): HeaderRow[] {
  return Object.entries(headers ?? {}).map(([key, value]) => ({ key, value }));
}

function rowsToHeaders(rows: HeaderRow[]): Record<string, string> | undefined {
  const entries = rows.filter((r) => r.key.trim()).map((r) => [r.key.trim(), r.value] as const);
  return entries.length ? Object.fromEntries(entries) : undefined;
}

function byteSize(text: string): number {
  return new TextEncoder().encode(text).length;
}

interface Props {
  project: Project;
  route: Route;
  onSave: (route: Route) => Promise<void> | void;
}

/** How the endpoint's response is shaped: auto (today's behaviour, optionally with a status/
 * header override), a hand-written template poured with real data, or a static body. */
export function ResponseTab({ project, route, onSave }: Props) {
  const initial = route.response;
  const [mode, setMode] = useState<ResponseMode>(initial?.mode ?? "auto");
  const [statusText, setStatusText] = useState(initial?.status !== undefined ? String(initial.status) : "");
  const [headerRows, setHeaderRows] = useState<HeaderRow[]>(headersToRows(initial?.headers));
  const [templateText, setTemplateText] = useState(() =>
    JSON.stringify(initial?.mode === "template" ? (initial.template ?? {}) : { message: "Hello, {{params.id}}" }, null, 2),
  );
  const [staticText, setStaticText] = useState(() => JSON.stringify(initial?.mode === "static" ? (initial.body ?? {}) : { ok: true }, null, 2));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const bodyText = mode === "template" ? templateText : staticText;
  const setBodyText = mode === "template" ? setTemplateText : setStaticText;

  function buildResponse(): { response: RouteResponse | undefined; error: string | null } {
    const status = statusText.trim() ? Number(statusText) : undefined;
    if (statusText.trim() && (!Number.isInteger(status) || status! < 100 || status! > 599)) {
      return { response: undefined, error: "Status must be a whole number between 100 and 599." };
    }
    const headers = rowsToHeaders(headerRows);

    if (mode === "auto") {
      const response = status === undefined && !headers ? undefined : { mode: "auto" as const, ...(status !== undefined && { status }), ...(headers && { headers }) };
      return { response, error: null };
    }

    const text = mode === "template" ? templateText : staticText;
    if (byteSize(text) > JSON_CAP_BYTES) {
      return { response: undefined, error: "This is too large. Keep it under 100KB." };
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return { response: undefined, error: "This isn't valid JSON. Fix the syntax and try again." };
    }
    const response: RouteResponse = {
      mode,
      ...(status !== undefined && { status }),
      ...(headers && { headers }),
      ...(mode === "template" ? { template: parsed, ...(initial?.query && { query: initial.query }) } : { body: parsed }),
    };
    return { response, error: null };
  }

  const { response: draftResponse } = useMemo(
    () => buildResponse(),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- buildResponse closes over exactly these
    [mode, statusText, headerRows, templateText, staticText, initial?.query],
  );
  const preview = useMemo(() => previewResponseShape(route, draftResponse, project), [route, draftResponse, project]);
  const dirty = JSON.stringify(draftResponse) !== JSON.stringify(initial);

  async function save() {
    setError(null);
    const built = buildResponse();
    if (built.error) {
      setError(built.error);
      return;
    }
    setSaving(true);
    try {
      await onSave({ ...route, response: built.response });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the response.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="space-y-2">
        <h3 className="kicker">Response shape</h3>
        <div className="inline-flex gap-1 rounded-lg border border-line bg-panel p-1">
          {MODES.map((m) => (
            <button
              key={m.mode}
              type="button"
              aria-pressed={mode === m.mode}
              onClick={() => setMode(m.mode)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors duration-150",
                mode === m.mode ? "bg-accent text-white" : "text-ink-3 hover:text-ink",
              )}
            >
              {m.label}
            </button>
          ))}
        </div>
        <p className="text-xs text-ink-3">{MODES.find((m) => m.mode === mode)!.description}</p>
      </section>

      {mode !== "auto" && (
        <section className="grid gap-4 sm:grid-cols-[1fr_auto]">
          <div className="space-y-1.5">
            <Label htmlFor="response-body">{mode === "template" ? "Template (JSON)" : "Response body (JSON)"}</Label>
            <Textarea
              id="response-body"
              value={bodyText}
              onChange={(e) => setBodyText(e.target.value)}
              className="min-h-40 font-mono text-xs"
              spellCheck={false}
            />
          </div>
          {mode === "template" && (
            <div className="w-full rounded-lg border border-line bg-panel/60 p-3 text-xs sm:w-56">
              <p className="mb-2 font-medium text-ink-2">Placeholders</p>
              <ul className="space-y-1.5">
                {PLACEHOLDERS.map((p) => (
                  <li key={p.name}>
                    <code className="font-mono text-accent">{p.name}</code>
                    <p className="text-ink-3">{p.hint}</p>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="response-status">Status code</Label>
          <Input
            id="response-status"
            inputMode="numeric"
            placeholder={mode === "static" ? "200" : "engine default"}
            value={statusText}
            onChange={(e) => setStatusText(e.target.value)}
            className="w-28 font-mono"
          />
        </div>
      </section>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Headers</legend>
        <div className="space-y-2">
          {headerRows.map((row, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                aria-label="Header name"
                placeholder="X-Header-Name"
                value={row.key}
                onChange={(e) => setHeaderRows((rows) => rows.map((r, j) => (j === i ? { ...r, key: e.target.value } : r)))}
                className="font-mono text-sm"
              />
              <Input
                aria-label="Header value"
                placeholder="value"
                value={row.value}
                onChange={(e) => setHeaderRows((rows) => rows.map((r, j) => (j === i ? { ...r, value: e.target.value } : r)))}
                className="font-mono text-sm"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Remove header"
                onClick={() => setHeaderRows((rows) => rows.filter((_, j) => j !== i))}
              >
                <X className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => setHeaderRows((rows) => [...rows, { key: "", value: "" }])}>
          <Plus className="size-3.5" /> Add header
        </Button>
      </fieldset>

      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-2">
        {dirty && <span className="mr-auto text-xs text-warning">Unsaved changes</span>}
        <Button size="sm" disabled={saving || !dirty} onClick={() => void save()}>
          {saving ? "Saving…" : "Save response"}
        </Button>
      </div>

      <section className="space-y-2">
        <h3 className="kicker">Live preview</h3>
        <StatusLine status={preview.status} />
        <CodePanel code={JSON.stringify(preview.body, null, 2)} language="json" title="PREVIEW" />
        {preview.warnings.length > 0 && (
          <ul className="space-y-1">
            {preview.warnings.map((w) => (
              <li key={w} className="text-xs text-warning">
                {w}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
