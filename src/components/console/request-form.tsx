"use client";

import { Send } from "lucide-react";
import { useState } from "react";
import { MethodLabel } from "@/components/domain/method-label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { fieldTypeMeta } from "@/lib/field-types";
import { fillPath, routeParams } from "@/lib/paths";
import { buildBody, valuesFromBody, type FormValues } from "@/lib/request-body";
import { baseUrl } from "@/lib/slug";
import type { Field, Project, Route, TestRequest } from "@/lib/types";

interface Props {
  project: Project;
  route: Route;
  sending: boolean;
  onSend: (request: Omit<TestRequest, "routeId">) => void;
  /**
   * Values to start from — an example body from the editor, or a replayed request from the log.
   * Read once, so the caller remounts the form (a new `key`) to load a different draft.
   */
  initial?: Partial<Omit<TestRequest, "routeId">>;
}

const INPUT_TYPE: Partial<Record<Field["type"], string>> = { number: "number", date: "date", email: "email", url: "url" };

function FieldInput({ field, project, value, onChange }: {
  field: Field;
  project: Project;
  value: string | boolean | undefined;
  onChange: (value: string | boolean) => void;
}) {
  const id = `field-${field.id}`;
  const text = typeof value === "string" ? value : "";
  const target = project.models.find((m) => m.id === field.linkTo);
  let control: React.ReactNode;
  if (field.type === "boolean") {
    control = <Switch id={id} checked={value === true} onCheckedChange={onChange} />;
  } else if (field.type === "choice") {
    control = (
      <Select value={text} onValueChange={onChange}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder="Pick one" />
        </SelectTrigger>
        <SelectContent>
          {(field.options ?? []).map((o) => (
            <SelectItem key={o} value={o}>
              {o}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  } else if (field.type === "json") {
    control = <Textarea id={id} className="font-mono text-xs" value={text} placeholder='{"key": "value"}' onChange={(e) => onChange(e.target.value)} />;
  } else {
    control = (
      <Input
        id={id}
        type={INPUT_TYPE[field.type] ?? "text"}
        value={text}
        placeholder={field.type === "link" ? `ID of a ${target?.name.toLowerCase() ?? "record"} (e.g. 1)` : undefined}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="flex items-baseline gap-2">
        <span className="font-mono">
          {field.name}
          {field.required && <span className="text-destructive"> *</span>}
        </span>
        <span className="text-xs font-normal text-muted-foreground">{fieldTypeMeta(field.type).label}</span>
      </Label>
      {control}
    </div>
  );
}

export function RequestForm({ project, route, sending, onSend, initial }: Props) {
  const model = project.models.find((m) => m.id === route.modelId) ?? null;
  const params = routeParams(route.path);
  const bodyModel = model && (route.action === "create" || route.action === "update") ? model : null;
  const [paramValues, setParamValues] = useState<Record<string, string>>(() => ({ ...initial?.params }));
  const [query, setQuery] = useState<Record<string, string>>(() => ({ ...initial?.query }));
  // Untouched Yes/No switches read as "No", so a new record sends false rather than leaving the field out.
  const defaults: FormValues =
    bodyModel && route.action === "create"
      ? Object.fromEntries(bodyModel.fields.filter((f) => f.type === "boolean").map((f) => [f.name, false]))
      : {};
  const [values, setValues] = useState<FormValues>(() => ({
    ...defaults,
    ...(bodyModel && initial?.body !== undefined && initial.body !== null ? valuesFromBody(bodyModel, initial.body) : {}),
  }));
  const [jsonMode, setJsonMode] = useState(false);
  const [rawJson, setRawJson] = useState(() =>
    bodyModel && initial?.body !== undefined && initial.body !== null ? JSON.stringify(initial.body, null, 2) : "{}",
  );
  const [jsonError, setJsonError] = useState<string | null>(null);

  const cleanQuery = Object.fromEntries(Object.entries(query).filter(([, v]) => v !== ""));
  const qs = new URLSearchParams(cleanQuery).toString();
  const url = `${baseUrl(project.slug)}${fillPath(route.path, paramValues)}${qs ? `?${qs}` : ""}`;

  function toggleJson(on: boolean) {
    if (!bodyModel) return;
    if (on) {
      setRawJson(JSON.stringify(buildBody(bodyModel, values), null, 2));
      setJsonError(null);
    } else {
      try {
        setValues({ ...defaults, ...valuesFromBody(bodyModel, JSON.parse(rawJson)) });
      } catch (err) {
        // Stay in JSON mode so the typed JSON isn't lost.
        setJsonError(`That isn't valid JSON: ${(err as Error).message}`);
        return;
      }
    }
    setJsonMode(on);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    send();
  }

  // ⌘↵ / Ctrl+↵ sends from anywhere in the form, including the JSON textarea where ↵ is a newline.
  function onKeyDown(e: React.KeyboardEvent<HTMLFormElement>) {
    if (e.key !== "Enter" || !(e.metaKey || e.ctrlKey) || sending) return;
    e.preventDefault();
    send();
  }

  function send() {
    let body: unknown = undefined;
    if (bodyModel) {
      if (jsonMode) {
        try {
          body = JSON.parse(rawJson);
        } catch (err) {
          setJsonError(`That isn't valid JSON: ${(err as Error).message}`);
          return;
        }
      } else {
        body = buildBody(bodyModel, values);
      }
    }
    onSend({ params: paramValues, query: cleanQuery, body });
  }

  return (
    <form onSubmit={submit} onKeyDown={onKeyDown} noValidate className="space-y-4">
      <div className="flex items-center gap-2 rounded-md border border-line bg-panel-strong/60 p-1.5">
        <MethodLabel method={route.method} />
        <span className="min-w-0 break-all font-mono text-[13px]">{url}</span>
      </div>

      {params.length > 0 && (
        <fieldset className="space-y-3">
          <legend className="text-[13px] font-medium text-ink-2">Which record?</legend>
          {params.map((p) => (
            <div key={p} className="space-y-1.5">
              <Label htmlFor={`param-${p}`} className="font-mono">
                {p}
              </Label>
              <Input
                id={`param-${p}`}
                value={paramValues[p] ?? ""}
                placeholder="Try 1"
                onChange={(e) => setParamValues((v) => ({ ...v, [p]: e.target.value }))}
              />
            </div>
          ))}
        </fieldset>
      )}

      {route.action === "list" && route.filters.length > 0 && (
        <fieldset className="space-y-3">
          <legend className="text-[13px] font-medium text-ink-2">Filters (optional)</legend>
          {route.filters.map((f) => (
            <div key={f} className="space-y-1.5">
              <Label htmlFor={`query-${f}`} className="font-mono">
                {f}
              </Label>
              <Input id={`query-${f}`} value={query[f] ?? ""} onChange={(e) => setQuery((q) => ({ ...q, [f]: e.target.value }))} />
            </div>
          ))}
        </fieldset>
      )}

      {bodyModel && (
        <fieldset className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <legend className="text-[13px] font-medium text-ink-2">Data to send</legend>
            <div className="flex items-center gap-2">
              <Switch id="json-mode" checked={jsonMode} onCheckedChange={toggleJson} />
              <Label htmlFor="json-mode" className="text-xs text-muted-foreground">
                Advanced: JSON
              </Label>
            </div>
          </div>
          {jsonMode ? (
            <>
              <Textarea
                aria-label="Request body JSON"
                className="min-h-48 font-mono text-xs"
                value={rawJson}
                onChange={(e) => {
                  setRawJson(e.target.value);
                  setJsonError(null);
                }}
              />
              {jsonError && (
                <p role="alert" className="text-sm text-destructive">
                  {jsonError}
                </p>
              )}
            </>
          ) : (
            bodyModel.fields.map((f) => (
              <FieldInput
                key={f.id}
                field={f}
                project={project}
                value={values[f.name]}
                onChange={(v) => setValues((vals) => ({ ...vals, [f.name]: v }))}
              />
            ))
          )}
        </fieldset>
      )}

      <div className="flex items-center gap-3">
        <Button type="submit" size="sm" disabled={sending}>
          <Send className="size-4" /> {sending ? "Sending…" : "Send request"}
        </Button>
        <kbd className="font-mono text-[11px] text-ink-3">{"⌘↵"}</kbd>
      </div>
    </form>
  );
}
