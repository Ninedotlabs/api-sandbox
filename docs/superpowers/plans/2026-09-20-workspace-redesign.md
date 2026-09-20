# Workspace Redesign ("Slate & indigo") — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the builder into a three-pane developer workspace (API tree · editor · always-on console) with a tonal light design system, indigo accent, code as a first-class element, a request log and per-endpoint code snippets.

**Architecture:** Tokens change in `globals.css`. A `WorkspaceProvider` (React context) owns selection (mirrored to `?resource=`/`?endpoint=` search params) and "what is loaded in the console". The rail, editor and console are siblings under `WorkspaceShell`. Existing editors (`ModelFieldTable`, `RouteEditor`, `RequestForm`, `JsonTree`) are reused and restyled; the mock engine, services and stores are unchanged except an in-memory request log on the console service and a new pure `snippets` module.

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind v4, shadcn/ui (Radix), Zustand, sonner, `simple-icons` (SVG paths for JavaScript/Python marks), Instrument Sans + JetBrains Mono via `next/font/google`. Vitest + RTL.

**Spec:** `docs/superpowers/specs/2026-09-20-workspace-redesign.md`. Behavioural rules (validation messages, mock engine, undo) still come from `docs/superpowers/specs/2026-09-19-universal-api-ui-design.md`.

## Global Constraints

- Audience: developers. Terms: **resource** (model), **schema** (fields), **endpoint** (route), **console**, **reference**. Plain-language descriptions remain as secondary text.
- Tokens (exact): page `#F4F4F2`, rail `#ECEDEF`, surface `#FAFAF8`, panel `#EEF0F3`, panel-strong `#E4E7EC`, line `#DDDFE3`, line-strong `#C9CDD4`, ink `#1F2328`, ink-2 `#4B5563`, ink-3 `#676D7B`, accent `#4F46E5`, accent-soft `#E0E7FF`, accent-ink `#3730A3`, slate `#1B1F27`, slate-2 `#242935`, slate-ink `#E6E8EC`, slate-muted `#8B93A1`, success `#15803D`, warning `#B45309`, danger `#B91C1C`.
- Method colours (text / tint): GET `#15803D`/`#DCFCE7`, POST `#1D4ED8`/`#DBEAFE`, PUT `#B45309`/`#FEF3C7`, PATCH `#6D28D9`/`#EDE9FE`, DELETE `#B91C1C`/`#FEE2E2`. `MethodLabel` is mono 11px semibold, 56px wide, 4px radius.
- Syntax colours light: key `#3730A3`, string `#0F766E`, number `#B45309`, boolean `#6D28D9`, null/punct `#676D7B`. Slate: key `#A5B4FC`, string `#6EE7B7`, number `#FCD34D`, boolean `#C4B5FD`, null/punct `#8B93A1`.
- Contrast fix (Task 8): `ink-3`/`syntax-muted` moved from `#6B7280` to `#676D7B` — the original failed 4.5:1 against `--color-page`/`--color-panel` (4.39:1 / 4.23:1); the darker value clears both (4.71:1 / 4.54:1). All other tokens and method-text-on-tint pairs passed as specified.
- Fonts: Instrument Sans (`--font-sans`), JetBrains Mono (`--font-mono`). No script font. Kickers: mono 11px uppercase, tracking 0.08em, `text-ink-3`.
- Radius 6px controls, 8px panels, 10px popovers, 4px chips. Shadows only on popovers/palette. Focus ring 2px accent, offset 2px.
- Page background: page colour + dot grid `radial-gradient(var(--color-line) 1px, transparent 1px)` at 24px. Panels flat.
- Exactly one dark element per screen: the response panel (slate). Nothing else is dark.
- Motion ≤ 250ms except the 600ms packet; CSS only; `prefers-reduced-motion` respected.
- URLs: `/projects`, `/projects/[id]` (`?resource=` / `?endpoint=`), `/projects/[id]/reference`, `/projects/[id]/settings`; `/projects/[id]/docs` → redirect to reference; `/projects/[id]/console` → redirect to workspace; `/projects/new` → `/projects`.
- All data access via `@/lib/services`; components never import `services/mock/*` (tests may). Every user-triggered awaited store/service call has try/catch + `toast.error(e instanceof Error ? e.message : "<fallback>.")`.
- No dialogs for create/edit/delete (⌘K palette and dropdown menus are fine). Deletes: two-step button for resources/endpoints/projects; Undo toasts stay for resources and endpoints.
- No emoji in UI. Language marks come from `simple-icons` (`siJavascript`, `siPython`); cURL uses a lucide `Terminal` icon.
- JSX text with `'`/`"` is wrapped in `{"..."}`. `cn` from `@/lib/utils` does **not** merge conflicting Tailwind classes — never rely on a later class overriding an earlier one; use variants (`aria-selected:`, `data-[state=open]:`) or conditionally include exactly one class.
- Before every commit: `npm test`, `npm run lint`, `npm run build` clean; pristine test output. Commit trailer names the model doing the work.

**Refinements decided while planning:**
1. Selection lives in the URL (`?resource=`/`?endpoint=`) via `router.replace`, so ⌘K, the reference page and refresh all agree. The workspace context reads it with `useSearchParams` and exposes `select()`.
2. The console's loaded endpoint is context state (not URL), defaulting to the selected endpoint when one is selected.
3. The `Delete` two-step lives in the editor header; the tree has no destructive controls.
4. `simple-icons` is a runtime dependency (MIT); only the two icon objects are imported so tree-shaking keeps the bundle small.

---

## File Map

```
src/app/globals.css, layout.tsx                          tokens, fonts (Instrument Sans + JetBrains Mono)
src/app/projects/page.tsx                                project list
src/app/projects/[projectId]/layout.tsx                  loads project → WorkspaceProvider + WorkspaceShell for the workspace route only
src/app/projects/[projectId]/page.tsx                    workspace (rail · editor · console)
src/app/projects/[projectId]/reference/page.tsx          reference (moved from docs)
src/app/projects/[projectId]/docs/page.tsx               redirect → reference
src/app/projects/[projectId]/console/page.tsx            redirect → workspace
src/app/projects/[projectId]/settings/page.tsx           restyled
src/components/brand/wordmark.tsx
src/components/domain/{method-label,type-badge,kicker,code-panel,inline-edit,status-line}.tsx (+tests for method-label, code-panel, inline-edit)
src/components/domain/two-step-button.tsx                kept
src/components/shell/{top-bar,project-switcher,workspace-shell,project-menu,command-palette}.tsx
src/components/workspace/workspace-context.tsx           WorkspaceProvider, useWorkspace
src/components/rail/{api-tree,tree-node,endpoint-preview,new-resource-row}.tsx (+api-tree.test)
src/components/editor/{lifecycle-guide,editor-header,resource-editor,schema-tab,endpoints-tab,data-tab,endpoint-editor,request-tab,response-tab,use-it-tab}.tsx (+tests: lifecycle-guide, endpoints-tab, use-it-tab)
src/components/console/{console-panel,mock-strip,response-panel,request-log,request-form,json-tree}.tsx (+tests: console-panel, request-log; existing request-form/json tests kept)
src/components/projects/{project-list,project-row,new-project-row}.tsx (+test)
src/components/reference/{reference-index,resource-reference,endpoint-reference}.tsx
src/lib/snippets.ts (+test), src/lib/services/{types,index}.ts, src/lib/services/mock/console-service.ts (+log tests), src/lib/methods.ts (colours), src/lib/field-types.ts (badge labels)
DELETED: components/build/**, components/dashboard/**, components/domain/{sketch-card,url-segments(+test),type-chip,wordmark,project-card(+test),empty-state,page-header}.tsx, components/shell/{breadcrumb,project-tabs(+test),nav-items,dashboard-header}.tsx, components/docs/**, components/routes/path-preview.tsx (folded into method-label/path rendering), console/route-picker.tsx
```

---

### Task 1: Tokens, fonts, brand and primitives

**Files:**
- Modify: `src/app/globals.css`, `src/app/layout.tsx`, `src/lib/methods.ts`, `src/lib/field-types.ts`, `src/lib/json-highlight.ts` (no change needed unless token kinds differ), `package.json` (add `simple-icons`)
- Create: `src/components/brand/wordmark.tsx`, `src/components/domain/method-label.tsx`, `src/components/domain/type-badge.tsx`, `src/components/domain/kicker.tsx`, `src/components/domain/code-panel.tsx`, `src/components/domain/inline-edit.tsx`, `src/components/domain/status-line.tsx`
- Delete: `src/components/domain/wordmark.tsx`, `src/components/domain/sketch-card.tsx`, `src/components/domain/type-chip.tsx`, `src/components/domain/url-segments.tsx`, `src/components/domain/url-segments.test.tsx`, `src/components/domain/method-badge.tsx`, `src/components/domain/method-badge.test.tsx`
- Test: `src/components/domain/method-label.test.tsx`, `src/components/domain/code-panel.test.tsx`, `src/components/domain/inline-edit.test.tsx`

**Interfaces:**
- Produces utilities `bg-page bg-rail bg-surface bg-panel bg-panel-strong border-line border-line-strong text-ink text-ink-2 text-ink-3 bg-accent bg-accent-soft text-accent text-accent-ink bg-slate bg-slate-2 text-slate-ink text-slate-muted text-success text-warning text-danger`, `font-sans` (Instrument Sans), `font-mono`, `shadow-pop`, and the `kicker` utility class (`.kicker`).
- `METHOD_META[m].{label, hint, className}` where className = `text-method-<m> bg-method-<m>-tint` (utilities `text-method-get` … and `bg-method-get-tint` … defined in the theme).
- `FIELD_TYPES[].badge`: `"string" | "number" | "boolean" | "date" | "email" | "url" | "enum" | "ref" | "json"`.
- `<Wordmark />`; `<MethodLabel method className? />`; `<TypeBadge type />`; `<Kicker>{text}</Kicker>`; `<CodePanel code language?="json"|"http"|"text" tone?="light"|"slate" title? className? />` (copy button, syntax colours by tone; `http` mode colours the first token (method) and a leading status line `HTTP/1.1 201 Created`); `<InlineEdit value onSave(value) validate?(value)=>string|null ariaLabel className? />` (click to edit, Enter saves, Esc cancels, error under the field); `<StatusLine status durationMs? tone?="light"|"slate" />` renders `201 Created · 38ms · application/json`.
- Callers restyle later; every deleted component is replaced in Tasks 3–7. **Until Task 8 removes the old screens, keep the build green by leaving imports of deleted files out of scope: delete only files with no remaining importers, and for `method-badge` create a thin re-export `src/components/domain/method-badge.tsx` → `MethodLabel` (removed in Task 8).**

- [ ] **Step 1: Write the failing tests**

`src/components/domain/method-label.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { MethodLabel } from "./method-label";

it("renders the method in its colour classes", () => {
  render(<MethodLabel method="DELETE" />);
  const el = screen.getByText("DELETE");
  expect(el).toHaveClass("text-method-delete", "bg-method-delete-tint", "font-mono");
});
```

`src/components/domain/code-panel.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { CodePanel } from "./code-panel";

it("renders JSON with highlighted keys and a copy button", () => {
  render(<CodePanel code={'{\n  "id": 1\n}'} title="Example response" />);
  expect(screen.getByText("Example response")).toBeInTheDocument();
  expect(screen.getByText('"id"')).toHaveClass("text-syntax-key");
  expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
});

it("uses slate syntax colours in slate tone and highlights the HTTP method", () => {
  render(<CodePanel code={"POST /api/shop/products\nContent-Type: application/json"} language="http" tone="slate" />);
  expect(screen.getByText("POST")).toHaveClass("text-method-post-on-slate");
});
```

`src/components/domain/inline-edit.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InlineEdit } from "./inline-edit";

it("edits on click, validates, saves on Enter and cancels on Escape", async () => {
  const user = userEvent.setup();
  const onSave = vi.fn().mockResolvedValue(undefined);
  render(<InlineEdit value="Product" ariaLabel="Resource name" onSave={onSave} validate={(v) => (v.trim() ? null : "Give the resource a name.")} />);
  await user.click(screen.getByRole("button", { name: "Resource name: Product" }));
  const input = screen.getByRole("textbox", { name: "Resource name" });
  await user.clear(input);
  await user.keyboard("{Enter}");
  expect(screen.getByRole("alert")).toHaveTextContent("Give the resource a name.");
  await user.type(input, "Item{Enter}");
  expect(onSave).toHaveBeenCalledWith("Item");
  await user.click(screen.getByRole("button", { name: "Resource name: Product" }));
  await user.keyboard("{Escape}");
  expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run them and confirm they fail** — `npm test -- src/components/domain` → unresolved imports.

- [ ] **Step 3: Install simple-icons and set fonts**

```bash
npm i simple-icons
```
`src/app/layout.tsx`: replace the font setup with
```tsx
import { Instrument_Sans, JetBrains_Mono } from "next/font/google";
const sans = Instrument_Sans({ subsets: ["latin"], variable: "--font-instrument-sans" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono" });
```
and `<html lang="en" className={`${sans.variable} ${mono.variable}`}>`. Remove Pacifico.

- [ ] **Step 4: Rewrite the tokens in `src/app/globals.css`**

Keep the three `@import` lines and the `@custom-variant dark (&:is(.dark *));` line. Replace the rest with:

```css
@theme inline {
  --font-sans: var(--font-instrument-sans);
  --font-mono: var(--font-jetbrains-mono);

  --color-page: #f4f4f2;
  --color-rail: #ecedef;
  --color-surface: #fafaf8;
  --color-panel: #eef0f3;
  --color-panel-strong: #e4e7ec;
  --color-line: #dddfe3;
  --color-line-strong: #c9cdd4;
  --color-ink: #1f2328;
  --color-ink-2: #4b5563;
  --color-ink-3: #676d7b;
  --color-accent: #4f46e5;
  --color-accent-soft: #e0e7ff;
  --color-accent-ink: #3730a3;
  --color-slate: #1b1f27;
  --color-slate-2: #242935;
  --color-slate-ink: #e6e8ec;
  --color-slate-muted: #8b93a1;
  --color-success: #15803d;
  --color-warning: #b45309;
  --color-danger: #b91c1c;

  --color-method-get: #15803d;
  --color-method-get-tint: #dcfce7;
  --color-method-post: #1d4ed8;
  --color-method-post-tint: #dbeafe;
  --color-method-put: #b45309;
  --color-method-put-tint: #fef3c7;
  --color-method-patch: #6d28d9;
  --color-method-patch-tint: #ede9fe;
  --color-method-delete: #b91c1c;
  --color-method-delete-tint: #fee2e2;
  --color-method-get-on-slate: #6ee7b7;
  --color-method-post-on-slate: #93c5fd;
  --color-method-put-on-slate: #fcd34d;
  --color-method-patch-on-slate: #c4b5fd;
  --color-method-delete-on-slate: #fca5a5;

  --color-syntax-key: #3730a3;
  --color-syntax-string: #0f766e;
  --color-syntax-number: #b45309;
  --color-syntax-boolean: #6d28d9;
  --color-syntax-muted: #676d7b;
  --color-syntax-key-slate: #a5b4fc;
  --color-syntax-string-slate: #6ee7b7;
  --color-syntax-number-slate: #fcd34d;
  --color-syntax-boolean-slate: #c4b5fd;
  --color-syntax-muted-slate: #8b93a1;

  /* shadcn semantic tokens */
  --color-background: var(--color-page);
  --color-foreground: var(--color-ink);
  --color-card: var(--color-surface);
  --color-card-foreground: var(--color-ink);
  --color-popover: #ffffff;
  --color-popover-foreground: var(--color-ink);
  --color-primary: var(--color-accent);
  --color-primary-foreground: #ffffff;
  --color-secondary: var(--color-panel);
  --color-secondary-foreground: var(--color-ink);
  --color-muted: var(--color-panel);
  --color-muted-foreground: var(--color-ink-3);
  --color-accent-foreground: var(--color-ink);
  --color-destructive: var(--color-danger);
  --color-border: var(--color-line);
  --color-input: var(--color-line);
  --color-ring: var(--color-accent);

  --radius-sm: 4px;
  --radius-md: 6px;
  --radius-lg: 8px;
  --radius-xl: 10px;
  --shadow-pop: 0 8px 24px rgb(31 35 40 / 12%);
}

@layer base {
  * { @apply border-border outline-ring/50; }
  body {
    @apply bg-page font-sans text-ink antialiased;
    font-size: 14px;
    line-height: 1.5;
    background-image: radial-gradient(var(--color-line) 1px, transparent 1px);
    background-size: 24px 24px;
  }
  h1, h2, h3 { letter-spacing: -0.01em; }
  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
  }
}

@layer components {
  .kicker { @apply font-mono text-[11px] font-medium uppercase tracking-[0.08em] text-ink-3; }
}
```
Note: shadcn's `--color-accent` is now the indigo accent; components that used `bg-accent` for hover (dropdown items) must use `bg-panel`. Check `src/components/ui/dropdown-menu.tsx`, `command.tsx`, `select.tsx` for `bg-accent`/`text-accent-foreground` and replace with `bg-panel-strong`/`text-ink` (generated files; these edits are allowed and listed in the report).

- [ ] **Step 5: `src/lib/methods.ts` and `src/lib/field-types.ts`**

Method classNames: `"text-method-get bg-method-get-tint"` etc. Field types: add `badge` to each entry: text→`string`, number→`number`, boolean→`boolean`, date→`date`, email→`email`, url→`url`, choice→`enum`, link→`ref`, json→`json`; extend `FieldTypeMeta` with `badge: string`. Remove the `icon` emoji usage from UI later (keep the field for now).

- [ ] **Step 6: Create the primitives**

`src/components/brand/wordmark.tsx`:
```tsx
import Link from "next/link";

export function Wordmark() {
  return (
    <Link href="/projects" aria-label="Universal API home" className="inline-flex items-center gap-2 text-ink">
      <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden className="shrink-0">
        <path d="M7 4 3 10l4 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="m13 4 4 6-4 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6.5 10h7" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span className="text-[17px] font-semibold tracking-tight">universal</span>
    </Link>
  );
}
```

`src/components/domain/method-label.tsx`:
```tsx
import { METHOD_META } from "@/lib/methods";
import type { HttpMethod } from "@/lib/types";
import { cn } from "@/lib/utils";

export function MethodLabel({ method, className }: { method: HttpMethod; className?: string }) {
  return (
    <span className={cn("inline-flex w-14 shrink-0 items-center justify-center rounded-sm px-1 font-mono text-[11px] font-semibold", METHOD_META[method].className, className)}>
      {method}
    </span>
  );
}
```

`src/components/domain/type-badge.tsx`:
```tsx
import { fieldTypeMeta } from "@/lib/field-types";
import type { FieldType } from "@/lib/types";

export function TypeBadge({ type }: { type: FieldType }) {
  return <span className="rounded-sm bg-panel-strong px-1.5 py-0.5 font-mono text-[11px] text-ink-2">{fieldTypeMeta(type).badge}</span>;
}
```

`src/components/domain/kicker.tsx`:
```tsx
export function Kicker({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <p className={`kicker ${className}`}>{children}</p>;
}
```

`src/components/domain/status-line.tsx`:
```tsx
const STATUS_TEXT: Record<number, string> = { 200: "OK", 201: "Created", 204: "No Content", 400: "Bad Request", 404: "Not Found", 500: "Server Error" };

interface Props { status: number; durationMs?: number; tone?: "light" | "slate"; contentType?: string }

export function statusText(status: number) { return STATUS_TEXT[status] ?? ""; }

export function StatusLine({ status, durationMs, tone = "light", contentType = "application/json" }: Props) {
  const slate = tone === "slate";
  const colour = status < 300 ? (slate ? "text-method-get-on-slate" : "text-success") : status < 500 ? (slate ? "text-method-put-on-slate" : "text-warning") : slate ? "text-method-delete-on-slate" : "text-danger";
  return (
    <p className={`flex flex-wrap items-center gap-2 font-mono text-xs ${slate ? "text-slate-muted" : "text-ink-3"}`}>
      <span className={`font-semibold ${colour}`}>{status} {statusText(status)}</span>
      {durationMs !== undefined && <><span aria-hidden>·</span><span>{durationMs}ms</span></>}
      {status !== 204 && <><span aria-hidden>·</span><span>{contentType}</span></>}
    </p>
  );
}
```

`src/components/domain/code-panel.tsx`:
```tsx
import { CopyButton } from "./copy-button";
import { tokenizeJson, type TokenKind } from "@/lib/json-highlight";
import { cn } from "@/lib/utils";

interface Props { code: string; language?: "json" | "http" | "text"; tone?: "light" | "slate"; title?: string; className?: string }

const LIGHT: Record<TokenKind, string> = { key: "text-syntax-key", string: "text-syntax-string", number: "text-syntax-number", boolean: "text-syntax-boolean", null: "text-syntax-muted", punct: "text-syntax-muted" };
const SLATE: Record<TokenKind, string> = { key: "text-syntax-key-slate", string: "text-syntax-string-slate", number: "text-syntax-number-slate", boolean: "text-syntax-boolean-slate", null: "text-syntax-muted-slate", punct: "text-syntax-muted-slate" };
const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

function Http({ code, slate }: { code: string; slate: boolean }) {
  return (
    <>
      {code.split("\n").map((line, i) => {
        const [first, ...rest] = line.split(" ");
        if (METHODS.includes(first)) {
          const cls = `text-method-${first.toLowerCase()}${slate ? "-on-slate" : ""} font-semibold`;
          return (<span key={i} className="block"><span className={cls}>{first}</span> {rest.join(" ")}</span>);
        }
        return <span key={i} className="block">{line}</span>;
      })}
    </>
  );
}

export function CodePanel({ code, language = "json", tone = "light", title, className }: Props) {
  const slate = tone === "slate";
  const map = slate ? SLATE : LIGHT;
  return (
    <div className={cn("overflow-hidden rounded-lg border", slate ? "border-slate-2 bg-slate text-slate-ink" : "border-line bg-panel text-ink", className)}>
      {(title || true) && (
        <div className={cn("flex items-center justify-between border-b px-3 py-1.5", slate ? "border-slate-2 bg-slate-2" : "border-line bg-panel-strong/60")}>
          <span className={cn("kicker", slate && "text-slate-muted")}>{title ?? language.toUpperCase()}</span>
          <CopyButton text={code} className={cn("size-6", slate && "text-slate-muted hover:text-slate-ink")} />
        </div>
      )}
      <pre className="max-h-[480px] overflow-auto px-3 py-2.5 font-mono text-[13px] leading-relaxed">
        <code>
          {language === "json" ? tokenizeJson(code).map((t, i) => <span key={i} className={map[t.kind]}>{t.text}</span>) : language === "http" ? <Http code={code} slate={slate} /> : code}
        </code>
      </pre>
    </div>
  );
}
```
Add `text-method-post-on-slate` etc. to a safelist comment at the top of the file so Tailwind keeps them: `/* @source inline("text-method-get text-method-post text-method-put text-method-patch text-method-delete text-method-get-on-slate text-method-post-on-slate text-method-put-on-slate text-method-patch-on-slate text-method-delete-on-slate") */` — or, if Tailwind v4 in this project supports `@source inline(...)` in CSS, put it in `globals.css`. Verify the classes appear in the built CSS.

`src/components/domain/inline-edit.tsx`:
```tsx
"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface Props { value: string; ariaLabel: string; onSave: (value: string) => Promise<void> | void; validate?: (value: string) => string | null; className?: string }

export function InlineEdit({ value, ariaLabel, onSave, validate, className }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);

  async function commit() {
    const err = validate?.(draft) ?? null;
    setError(err);
    if (err) return;
    try {
      await onSave(draft.trim());
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save.");
    }
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
        onBlur={() => setEditing(false)} />
      {error && <span role="alert" className="text-xs text-danger">{error}</span>}
    </span>
  );
}
```
(If `onBlur` closes the editor before Enter's `commit` resolves in tests, guard with `onMouseDown` on the save path or commit on blur only when the draft is unchanged — make the test pass without weakening it.)

- [ ] **Step 7: Delete replaced primitives, re-export `method-badge`**

```bash
git rm -q src/components/domain/wordmark.tsx src/components/domain/sketch-card.tsx src/components/domain/type-chip.tsx src/components/domain/url-segments.tsx src/components/domain/url-segments.test.tsx src/components/domain/method-badge.test.tsx
```
Replace `src/components/domain/method-badge.tsx` content with a temporary adapter so old callers compile: `export { MethodLabel as MethodBadge } from "./method-label";` and update old callers that pass `showLabel`/`tooltip` props by removing those props (grep `MethodBadge`). Update `src/components/shell/top-bar.tsx` to import `Wordmark` from `@/components/brand/wordmark`. Update `field-type-picker.tsx` to use `TypeBadge` instead of `TypeChip`. Replace `SketchCard` usages (build/*, dashboard/*) with a plain `div` of `rounded-lg border border-dashed border-line-strong` and `UrlSegments` usages with a mono `<code>` of the URL — these screens are deleted in later tasks; keep them compiling.

- [ ] **Step 8: Run checks** — `npm test && npm run lint && npm run build` clean (old pages will look wrong; that is expected). Check `grep -rn "pastel\|font-script\|shadow-card\|bg-soft" src` and fix any remaining references to removed tokens by mapping: pastel-* → panel/accent-soft, shadow-card → (remove), bg-soft → bg-panel, text-ink-muted → text-ink-3, bg-paper → bg-page, bg-card → bg-surface, border-sketch → border-line-strong.

- [ ] **Step 9: Commit** — `git commit -m "feat: slate & indigo tokens, fonts, brand mark and primitives"`.

---

### Task 2: Snippets and the request log

**Files:**
- Create: `src/lib/snippets.ts`, `src/lib/snippets.test.ts`
- Modify: `src/lib/services/types.ts`, `src/lib/services/mock/console-service.ts`, `src/lib/services/mock/services.test.ts` (append)

**Interfaces:**
- `buildSnippets(project, route, body?: unknown): { curl: string; javascript: string; python: string }`. Base URL `http://localhost:3000` + `baseUrl(project.slug)`; `:params` replaced with `1`; body pretty-printed with 2 spaces when present (only for POST/PUT/PATCH).
- `LogEntry { id: string; at: string; routeId: string; method: HttpMethod; path: string; request: TestRequest; response: TestResponse }`.
- `ConsoleService.log(projectId): Promise<LogEntry[]>` (newest first, max 50) and `clearLog(projectId): Promise<void>`; `send` appends.

- [ ] **Step 1: Failing tests**

`src/lib/snippets.test.ts`:
```ts
import { buildCrudRoutes } from "./crud";
import { buildSnippets } from "./snippets";
import type { Model, Project } from "./types";

const product: Model = { id: "m1", name: "Product", fields: [] };
const routes = buildCrudRoutes(product, ["get", "create"], []);
const project: Project = { id: "p", name: "Shop", slug: "shop", description: "", models: [product], routes, createdAt: "", updatedAt: "" };

it("builds a GET with params filled", () => {
  const get = routes.find((r) => r.action === "get")!;
  const s = buildSnippets(project, get);
  expect(s.curl).toBe("curl http://localhost:3000/api/shop/products/1");
  expect(s.javascript).toContain('fetch("http://localhost:3000/api/shop/products/1")');
  expect(s.python).toContain('requests.get("http://localhost:3000/api/shop/products/1")');
});

it("builds a POST with a JSON body", () => {
  const create = routes.find((r) => r.action === "create")!;
  const s = buildSnippets(project, create, { name: "Lamp", price: 25 });
  expect(s.curl).toBe(`curl -X POST http://localhost:3000/api/shop/products \\\n  -H "Content-Type: application/json" \\\n  -d '{"name":"Lamp","price":25}'`);
  expect(s.javascript).toContain('method: "POST"');
  expect(s.javascript).toContain('body: JSON.stringify({\n    "name": "Lamp",\n    "price": 25\n  })');
  expect(s.python).toContain("requests.post(");
  expect(s.python).toContain('json={"name": "Lamp", "price": 25}');
});
```

Append to `src/lib/services/mock/services.test.ts`:
```ts
it("keeps a session log of sent requests, newest first, capped at 50", async () => {
  const p = await newStore();
  const [list] = buildCrudRoutes(p.models[0], ["list"], []);
  await mockRouteService.createMany(p.id, [list]);
  for (let i = 0; i < 52; i++) {
    await mockConsoleService.send(p.id, { routeId: list.id, params: {}, query: {}, body: undefined });
  }
  const log = await mockConsoleService.log(p.id);
  expect(log).toHaveLength(50);
  expect(log[0]).toMatchObject({ method: "GET", path: "/products", response: { status: 200 } });
  expect(new Date(log[0].at).getTime()).toBeGreaterThanOrEqual(new Date(log[49].at).getTime());
  await mockConsoleService.clearLog(p.id);
  expect(await mockConsoleService.log(p.id)).toEqual([]);
});
```

- [ ] **Step 2: Confirm failure** — `npm test -- src/lib/snippets.test.ts src/lib/services`.

- [ ] **Step 3: `src/lib/snippets.ts`**

```ts
import { fillPath, routeParams } from "./paths";
import { baseUrl } from "./slug";
import type { Project, Route } from "./types";

const ORIGIN = "http://localhost:3000";

export interface Snippets { curl: string; javascript: string; python: string }

export function buildSnippets(project: Project, route: Route, body?: unknown): Snippets {
  const params = Object.fromEntries(routeParams(route.path).map((p) => [p, "1"]));
  const url = `${ORIGIN}${baseUrl(project.slug)}${fillPath(route.path, params)}`;
  const hasBody = body !== undefined && ["POST", "PUT", "PATCH"].includes(route.method);
  const compact = hasBody ? JSON.stringify(body) : "";
  const pretty = hasBody ? JSON.stringify(body, null, 2).split("\n").join("\n  ") : "";
  const py = hasBody ? JSON.stringify(body).replace(/,"/g, ', "').replace(/":/g, '": ') : "";

  const curl = route.method === "GET"
    ? `curl ${url}`
    : hasBody
      ? `curl -X ${route.method} ${url} \\\n  -H "Content-Type: application/json" \\\n  -d '${compact}'`
      : `curl -X ${route.method} ${url}`;

  const javascript = route.method === "GET"
    ? `const res = await fetch("${url}");\nconst data = await res.json();`
    : `const res = await fetch("${url}", {\n  method: "${route.method}",${hasBody ? `\n  headers: { "Content-Type": "application/json" },\n  body: JSON.stringify(${pretty}),` : ""}\n});\nconst data = await res.json();`;

  const fn = route.method.toLowerCase();
  const python = `import requests\n\nres = requests.${fn}("${url}"${hasBody ? `, json=${py}` : ""})\nprint(res.json())`;

  return { curl, javascript, python };
}
```
Adjust `pretty`/`py` formatting until the tests' exact strings pass (the tests are the contract).

- [ ] **Step 4: Service log**

`types.ts`: add `LogEntry` and the two methods. `console-service.ts`: keep `const logs = new Map<string, LogEntry[]>()`; in `send`, after computing `settled`/`durationMs`, `unshift` an entry (`createId("log")`, `new Date().toISOString()`, route.method/path) and `splice(50)`; `log` returns `delay(logs.get(id) ?? [])`; `clearLog` deletes; `resetMockDatasets` also clears logs.

- [ ] **Step 5: Run tests, lint, commit** — `git commit -m "feat: endpoint code snippets and console request log"`.

---

### Task 3: Shell, workspace context and routes

**Files:**
- Create: `src/components/workspace/workspace-context.tsx`, `src/components/shell/project-switcher.tsx`, `src/components/shell/workspace-shell.tsx`
- Rewrite: `src/components/shell/top-bar.tsx`, `src/components/shell/project-shell.tsx` (→ delete; replaced by workspace-shell), `src/app/projects/[projectId]/layout.tsx`, `src/components/shell/command-palette.tsx` (links), `src/app/projects/[projectId]/reference/page.tsx` (moved from `docs/page.tsx`), `src/app/projects/[projectId]/docs/page.tsx` (redirect), `src/app/projects/[projectId]/console/page.tsx` (redirect)
- Delete: `src/components/shell/breadcrumb.tsx`, `src/components/shell/project-tabs.tsx`, `src/components/shell/project-tabs.test.tsx`, `src/components/shell/nav-items.ts`, `src/components/shell/dashboard-header.tsx`
- Test: `src/components/workspace/workspace-context.test.tsx`, `src/components/shell/top-bar.test.tsx`

**Interfaces:**
- `type Selection = { kind: "resource"; id: string } | { kind: "endpoint"; id: string } | null`.
- `useWorkspace(): { project, selection, select(sel: Selection): void, consoleRouteId: string | null, consoleDraft: Partial<Omit<TestRequest,"routeId">> | null, loadInConsole(routeId, draft?): void, consoleOpen: boolean, setConsoleOpen(b), railOpen: boolean, setRailOpen(b) }`.
- `WorkspaceProvider({ project, children })` reads `?resource=`/`?endpoint=` via `useSearchParams` for `selection`; `select()` calls `router.replace` with the new query (no scroll) and updates state immediately. When an endpoint is selected and nothing is loaded in the console, `consoleRouteId` defaults to it.
- `<TopBar project? />`: rail-coloured 48px bar; Wordmark; if `project`: `ProjectSwitcher`, right: Search button, `Reference` link (`/projects/[id]/reference`), `Console` button (visible below `xl`, toggles `consoleOpen`), `ProjectMenu`, avatar. Without a project: Wordmark + avatar.
- `<WorkspaceShell rail editor console />`: CSS grid `[280px_1fr_380px]` at ≥1100px; at <1100px `[280px_1fr]` with the console as a right drawer (`Sheet`, side right) driven by `consoleOpen`; at <768px `[1fr]` with the rail as a left drawer driven by `railOpen` and a `Tree` button in the top bar. Height: `calc(100vh - 48px)`; rail and console `overflow-y-auto`; editor scrolls.
- `[projectId]/layout.tsx`: loading skeleton; not-found state; otherwise `<WorkspaceProvider project><TopBar project/>{children}</WorkspaceProvider>` — the workspace page itself renders `WorkspaceShell`; reference/settings render a centred `max-w-4xl` column under the same top bar.

- [ ] **Step 1: Failing tests**

`src/components/workspace/workspace-context.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useSearchParams } from "next/navigation";
import type { Project } from "@/lib/types";
import { WorkspaceProvider, useWorkspace } from "./workspace-context";

const project = { id: "p1", name: "Shop", slug: "shop", description: "", models: [], routes: [], createdAt: "", updatedAt: "" } as Project;

function Probe() {
  const w = useWorkspace();
  return (
    <>
      <p>sel:{w.selection ? `${w.selection.kind}:${w.selection.id}` : "none"}</p>
      <p>console:{w.consoleRouteId ?? "none"}</p>
      <button onClick={() => w.select({ kind: "endpoint", id: "r9" })}>pick</button>
      <button onClick={() => w.loadInConsole("r2", { body: { a: 1 } })}>load</button>
    </>
  );
}

it("reads the selection from the URL and updates it", async () => {
  vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams("resource=m1") as never);
  const user = userEvent.setup();
  render(<WorkspaceProvider project={project}><Probe /></WorkspaceProvider>);
  expect(screen.getByText("sel:resource:m1")).toBeInTheDocument();
  await user.click(screen.getByText("pick"));
  expect(screen.getByText("sel:endpoint:r9")).toBeInTheDocument();
  expect(screen.getByText("console:r9")).toBeInTheDocument();
  await user.click(screen.getByText("load"));
  expect(screen.getByText("console:r2")).toBeInTheDocument();
});
```
(`vitest.setup.ts` currently defines `useSearchParams: () => new URLSearchParams()`; change it to `useSearchParams: vi.fn(() => new URLSearchParams())` so tests can mock it.)

`src/components/shell/top-bar.test.tsx`:
```tsx
import { screen } from "@testing-library/react";
import type { Project } from "@/lib/types";
import { renderUi } from "@/test/render";
import { WorkspaceProvider } from "@/components/workspace/workspace-context";
import { TopBar } from "./top-bar";

const project = { id: "p1", name: "Shop", slug: "shop", description: "", models: [], routes: [], createdAt: "", updatedAt: "" } as Project;

it("shows the project switcher, reference link and project menu inside a project", () => {
  renderUi(<WorkspaceProvider project={project}><TopBar project={project} /></WorkspaceProvider>);
  expect(screen.getByRole("button", { name: /Shop/ })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Reference" })).toHaveAttribute("href", "/projects/p1/reference");
  expect(screen.getByRole("button", { name: "Project actions" })).toBeInTheDocument();
});
```

- [ ] **Step 2: Confirm failure.**

- [ ] **Step 3: Implement** the context (state + `useSearchParams` + `router.replace(`?${qs}`, { scroll: false })`), `ProjectSwitcher` (DropdownMenu listing `useProjectStore.projects`, "All projects", "New project" → `/projects`), `TopBar`, `WorkspaceShell` (use `Sheet` for drawers; `useWorkspace` for open state), the layout, and the redirects: `docs/page.tsx` → `redirect(`/projects/${params.projectId}/reference`)` (server component with `params` promise per Next 16), `console/page.tsx` → `redirect(`/projects/${projectId}`)`. Move the docs page to `reference/page.tsx` unchanged for now (Task 8 restyles it). Update `command-palette.tsx`: Pages group = Workspace (`/projects/[id]`), Reference, Settings; Resources → `/projects/[id]?resource=<id>`; Endpoints → `/projects/[id]?endpoint=<id>`; remove `PROJECT_NAV` usage.

- [ ] **Step 4: Delete old shell files, fix imports, run checks, commit** — `git commit -m "feat: workspace shell, context and top bar"`.

---

### Task 4: Projects list

**Files:**
- Create: `src/components/projects/project-list.tsx`, `src/components/projects/project-row.tsx`, `src/components/projects/new-project-row.tsx`, `src/components/projects/new-project-row.test.tsx`
- Rewrite: `src/app/projects/page.tsx`
- Delete: `src/components/dashboard/**`, `src/components/domain/project-card.tsx`, `src/components/domain/project-card.test.tsx`

**Interfaces:** `<NewProjectRow existingProjects onCreate(input) />` (name input, segmented template control with `role="radiogroup"`, Create; inline error), `<ProjectRow project />` (link row), `<ProjectList projects />`.

- [ ] **Step 1: Failing test** — `new-project-row.test.tsx`: type "My Store", choose radio "Store", click Create → `onCreate({ name: "My Store", description: "", templateId: "store" })`; empty submit shows alert "Give your API a name."; rejected `onCreate` shows the message inline and keeps the name.
- [ ] **Step 2: Confirm failure.**
- [ ] **Step 3: Implement.** Page: `<TopBar />`, `max-w-5xl` column, `h1` "Projects" (20px semibold) + count kicker, `NewProjectRow` in a surface panel, then `ProjectList` as a surface panel with divided rows: `grid-cols-[1fr_auto_auto_auto]`, name (semibold) + description (ink-3) · base URL (mono, ink-2) · `3 resources · 15 endpoints` (mono 12px ink-3) · `Edited 2h ago`. Hover: `bg-panel`. Empty state: the sentence from the spec under the new-project row; no cards.
- [ ] **Step 4: Delete the old files, checks, commit** — `git commit -m "feat: projects list"`.

---

### Task 5: Rail — API tree, hover preview, new resource, and the lifecycle guide

**Files:**
- Create: `src/components/rail/api-tree.tsx`, `src/components/rail/tree-node.tsx`, `src/components/rail/endpoint-preview.tsx`, `src/components/rail/new-resource-row.tsx`, `src/components/rail/api-tree.test.tsx`, `src/components/editor/lifecycle-guide.tsx`, `src/components/editor/lifecycle-guide.test.tsx`
- Rewrite: `src/app/projects/[projectId]/page.tsx` (workspace: `<WorkspaceShell rail={<ApiTree/>} editor={<Editor/>} console={<ConsolePanel/>} />`; `Editor` renders `LifecycleGuide` when nothing is selected and placeholders "Resource editor (Task 6)" / "Endpoint editor (Task 6)" otherwise; `ConsolePanel` placeholder until Task 7 — keep a minimal `<div>` so the page renders)

**Interfaces:**
- `<ApiTree />` (uses `useWorkspace`): header (`localhost:3000`, base URL + copy), tree with `role="tree"`, nodes `role="treeitem"` with `aria-selected`, `aria-expanded` on resources; keyboard ↑/↓ (roving tabindex), →/← expand/collapse, Enter/Space select; footer `+ Resource` (shows `NewResourceRow`), `+ Endpoint` (creates `GET /new-route` (via `uniquePath`) under the selected resource or unattached, then selects it).
- `<EndpointPreview route project />` popover content: `CodePanel language="http"` with `METHOD /api/slug/path` and, for POST/PUT, the example body from `exampleRequest`; shown via Radix `HoverCard` (add with `npx shadcn@latest add hover-card`) with `openDelay={300}`.
- `<NewResourceRow project onCreated(model) onCancel />`: inline input, Enter creates via `createModel`, Esc cancels, validation inline.
- `<LifecycleGuide steps: ChecklistStep[] actions: { define(), mock(), request(), respond() } />`: four connected steps DEFINE/MOCK/REQUEST/RESPOND; done = model / (fields && routes) / tested / viewedDocs; each has one button; the current step is accent-highlighted.

- [ ] **Step 1: Failing tests**

`api-tree.test.tsx`: render `ApiTree` inside `WorkspaceProvider` with a Store project that has Product CRUD; expect treeitems for "Product", "Customer", "Order" and endpoint rows `GET /products` etc.; press ArrowDown twice then Enter → `?endpoint=` selection changes (assert via a probe reading `useWorkspace().selection`). Hover on `POST /products` (userEvent.hover) → `await screen.findByText(/Content-Type/)`.

`lifecycle-guide.test.tsx`: with a project that has a model with fields but no routes → step 1 done, step 2 current; the "Create endpoints" button calls `actions.mock`.

- [ ] **Step 2: Confirm failure.**
- [ ] **Step 3: Implement.** Tree styling: rows 28px, mono 12px for endpoints, `MethodLabel` at 11px, path with `:id` in `text-accent-ink`; selected row `bg-accent-soft text-accent-ink` with a 2px accent left border via `border-l-2 border-accent` (only on selected, conditionally included); resources use a lucide `Folder`/`FolderOpen` icon in `text-ink-3`. Roving tabindex: keep `activeIndex` state over the flattened visible nodes.
- [ ] **Step 4: Checks, commit** — `git commit -m "feat: API tree rail and lifecycle guide"`.

---

### Task 6: Editor — resource and endpoint editors

**Files:**
- Create: `src/components/editor/editor-header.tsx`, `resource-editor.tsx`, `schema-tab.tsx`, `endpoints-tab.tsx`, `data-tab.tsx`, `endpoint-editor.tsx`, `request-tab.tsx`, `response-tab.tsx`, `use-it-tab.tsx`; tests `endpoints-tab.test.tsx`, `use-it-tab.test.tsx`
- Modify: `src/components/models/model-field-table.tsx`, `field-row.tsx`, `field-type-picker.tsx` (dense restyle; `TypeBadge` in the trigger; sticky save bar), `src/components/routes/route-editor.tsx` (restyle; it becomes the body of `request-tab`), `src/app/projects/[projectId]/page.tsx` (wire editors)
- Delete: `src/components/build/**` (all, with tests), `src/components/routes/path-preview.tsx` (replace uses with a small `PathText` inside `method-label.tsx` exporting `PathText({ path })` that highlights `:params`)

**Interfaces:**
- `<EditorHeader kicker title description? actions? />` — title accepts a node (InlineEdit).
- `<ResourceEditor model />`: header (`RESOURCE`, `InlineEdit` name → `saveModel` with `validateModelName`, description `"/products · 4 fields · 5 endpoints"`, actions: `TwoStepButton` Delete → `deleteModel` + Undo toast, then `select(null)`), `Tabs` Schema / Endpoints / Data.
- `<EndpointsTab model />`: checkbox list of `crudOptions(model)` (existing = checked+disabled), "Create selected" → `addRoutes(buildCrudRoutes(...))`; custom endpoints of this model listed with `MethodLabel` + path + "Open" → `select({kind:"endpoint"})`.
- `<EndpointEditor route />`: header (`ENDPOINT`, `MethodLabel` + full path, description `InlineEdit` → `saveRoute`), actions: `Send in console` (primary → `loadInConsole(route.id, { body: exampleRequest(...) ?? undefined })` and `setConsoleOpen(true)`), `TwoStepButton` Delete → `deleteRoute` + Undo, then `select(null)`. Tabs Request (RouteEditor + "Example request" `CodePanel language="http"`), Response (`StatusLine` + `CodePanel` JSON from `exampleResponse`), Use it (three tabs with `CodePanel language="text"`, marks from `simple-icons`: render `<svg viewBox="0 0 24 24"><path d={siJavascript.path}/></svg>` in `text-ink-2`; cURL uses lucide `Terminal`).

- [ ] **Step 1: Failing tests** — `endpoints-tab.test.tsx` (existing endpoint disabled; untick one; "Create selected" calls `addRoutes` with the right actions in canonical order); `use-it-tab.test.tsx` (renders the cURL snippet text for a POST including `-d '{`; switching to Python shows `requests.post`).
- [ ] **Step 2: Confirm failure.** **Step 3: Implement** (reuse `ModelFieldTable` inside `SchemaTab` with the save/toast handling; `SampleDataTable` inside `DataTab` plus a "Reset sample data" secondary button). **Step 4: Delete `build/**`, checks, commit** — `git commit -m "feat: resource and endpoint editors"`.

---

### Task 7: Console — request, mock strip, slate response, log

**Files:**
- Create: `src/components/console/console-panel.tsx`, `mock-strip.tsx`, `response-panel.tsx`, `request-log.tsx`; tests `console-panel.test.tsx`, `request-log.test.tsx`
- Modify: `src/components/console/request-form.tsx` (restyle to panel tone; keep API), `json-tree.tsx` (add `tone` prop with slate colours), `src/app/projects/[projectId]/page.tsx` (real `ConsolePanel`)
- Delete: `src/components/console/route-picker.tsx`, `response-viewer.tsx` (+test) — `ResponsePanel` replaces it

**Interfaces:**
- `<ConsolePanel />` (uses `useWorkspace` + `consoleService`): endpoint `Select` grouped by resource; `RequestForm` keyed by `consoleRouteId` with `initialValues` from `consoleDraft` (add an optional `initial?: Partial<Omit<TestRequest,"routeId">>` prop to `RequestForm` that seeds params/query/values/JSON); `MockStrip` (`sending` prop animates the packet; shows `localhost:3000 · /api/slug`); `ResponsePanel response loading` (slate; `StatusLine tone="slate"`, explanation, `JsonTree tone="slate"`, copy); `RequestLog entries onReplay(entry) onClear` (newest first; row = `MethodLabel`, path, status (coloured), `38ms`, time `HH:MM:SS`); after each send `markProgress(project.id, "tested")` and reload the log.
- Keyboard: `⌘↵` / `Ctrl+Enter` inside the request form sends.

- [ ] **Step 1: Failing tests** — `console-panel.test.tsx` (with `setMockLatency(0)` and a real project written through `projectService.create` + `routeService.createMany`: choose the POST endpoint, submit with a missing required field → response shows `400 Bad Request` and the details; log has one row; click the row → the form shows the same values); `request-log.test.tsx` (renders rows newest first, Clear calls `onClear`).
- [ ] **Step 2: Confirm failure.** **Step 3: Implement** (`MockStrip`: a 2px track with a 6px accent dot animated via a CSS keyframe `packet` from `left:0` to `left:calc(100% - 6px)` over 600ms while `sending`, and a green tick at the end for 400ms after a response). **Step 4: Delete replaced files, checks, commit** — `git commit -m "feat: console with mock strip, slate response and request log"`.

---

### Task 8: Reference, settings, cleanup and verification

**Files:**
- Create: `src/components/reference/{reference-index,resource-reference,endpoint-reference}.tsx` (from `components/docs/*`, restyled: `MethodLabel`, `CodePanel` (light for request, slate for response), "Open in console" → `/projects/[id]?endpoint=<id>`)
- Modify: `src/app/projects/[projectId]/reference/page.tsx`, `src/app/projects/[projectId]/settings/page.tsx` (surface panel, two-step delete), `src/lib/docs.ts` (unchanged API), `docs/superpowers/specs/2026-09-20-paper-and-ink-redesign.md` (top note: superseded by the workspace spec)
- Delete: `src/components/docs/**`, `src/components/domain/method-badge.tsx` (adapter), `src/components/domain/empty-state.tsx`, `page-header.tsx` if unused, `src/lib/onboarding.ts` stays (used by the guide)

- [ ] **Step 1: Implement the reference page and settings restyle.** Reference layout: index (sticky, 220px) + body; endpoint block = header row (`MethodLabel`, mono path, "Open in console" link), description (ink-2), request `CodePanel language="http"`, response `CodePanel tone="slate"`.
- [ ] **Step 2: Sweep** — `grep -rn "MethodBadge\|pastel\|bg-soft\|shadow-card\|font-script\|rounded-2xl\|/docs\b\|/console\b" src` → only the two redirect pages may mention `/docs`/`/console`. Delete dead files; `npx tsc --noEmit`, `npm run lint`, `npm test`, `npm run build` clean.
- [ ] **Step 3: Contrast check** — compute the four slate status colours against `#1B1F27` and the light method text colours against their tints; all ≥ 4.5:1 (adjust the tint or text if any fails and note the new hex in the spec).
- [ ] **Step 4: Smoke** — dev server on a free port, `curl` `/projects` → 200, `/projects/<id>/docs` → redirect; stop the server.
- [ ] **Step 5: Commit** — `git commit -m "feat: reference page, settings restyle and cleanup"`.

**Manual walkthrough (human):** create a Store project → tree shows Product/Customer/Order → select Product → Schema → add a field → save → Endpoints → Create selected → tree shows 5 endpoints → select `POST /products` → Use it → copy cURL → Send in console → console loads the body → Send → packet animates → `201 Created` on slate → log row appears → click the log row → replay. Resize to 1000px (console drawer) and 700px (rail drawer). ⌘K → "Customer" opens the resource. Lighthouse a11y ≥ 95.
