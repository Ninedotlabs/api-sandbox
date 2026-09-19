# Universal API Builder UI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a frontend-only Next.js app in which no-code users create APIs. They define models spreadsheet-style, generate CRUD routes, test them against mock data, and read auto-generated docs.

**Architecture:** Next.js App Router with client-rendered pages. All data goes through a service interface (`src/lib/services`), whose mock implementation stores projects in localStorage and runs requests with an in-memory mock engine. A Zustand store caches entities for the UI. Later, a second implementation of the same interfaces (`src/lib/services/http`) will call the Express backend, with no UI changes. Pure logic (validation, CRUD generation, mock engine, docs builder, onboarding) lives in `src/lib` and is unit-tested. UI components get React Testing Library tests where they have behaviour.

**Tech Stack:** Next.js (latest, App Router, TypeScript, `src/` dir), Tailwind CSS v4, shadcn/ui (Radix), next-themes, Zustand, zod, @faker-js/faker, lucide-react, sonner. Tests use Vitest, jsdom and React Testing Library.

**Spec:** `docs/superpowers/specs/2026-09-19-universal-api-ui-design.md`

## Global Constraints

- Audience is no-code users: plain-language label first, technical detail second (e.g. "Add a customer" with `POST /customers` underneath in mono).
- Dark theme is the default. Light theme is supported through `next-themes` (`attribute="class"`).
- Colour tokens (dark / light): bg `#0A0A0B`/`#FFFFFF`, surface `#111113`/`#F7F7F8`, surface-2 `#18181B`/`#FFFFFF`, border `#27272A`/`#E4E4E7`, text `#FAFAFA`/`#09090B`, muted text `#A1A1AA`/`#71717A`, primary `#7C5CFF`/`#6D4AFF`, success/warning/danger `#22C55E`/`#F59E0B`/`#EF4444` (darkened in light).
- Method colours (dark): GET `#22C55E`, POST `#3B82F6`, PUT `#F59E0B`, PATCH `#A855F7`, DELETE `#EF4444`. Light uses darker shades so the badges stay readable. Friendly labels: GET "Read", POST "Create", PUT "Update", PATCH "Edit", DELETE "Delete".
- Fonts: Inter (UI) and JetBrains Mono (paths, JSON, code). Radius is 6px for inputs and 10px for cards (`rounded-[10px]`); badges are fully rounded.
- Motion: 150ms hover/focus, 200ms panels. Respect `prefers-reduced-motion`.
- All data access goes through `src/lib/services` (index exports). No component imports `src/lib/services/mock/*` directly.
- Mock latency is 200ms (`setMockLatency(0)` in tests). The localStorage key for data is `universal-api:db:v1`; for UI state it is `universal-api:ui:v1`.
- Out of scope for v1: auth/API keys, real backend, collaboration, ERD canvas, sign-in.
- JSX text containing `'` or `"` must be wrapped in `{"..."}`, because eslint `react/no-unescaped-entities` rejects it otherwise.

**Deliberate refinements of the spec (decided while planning):**
1. Tailwind v4 has no `tailwind.config.ts`, so tokens are mapped in `globals.css` via `@theme inline`.
2. Entity persistence lives inside the mock service layer (`db.ts`), not in Zustand `persist`, so the whole of it is replaced when the backend arrives. Zustand `persist` is used only for UI state (sidebar, onboarding progress).
3. Templates create **models only, no routes**, so users learn the "Generate CRUD" step (this matches the spec's verification walkthrough).
4. `Route` gains `filters: string[]` (the spec's "query filters"), and `Project` gains `description`, `createdAt` and `updatedAt`.

---

## File Map

```
src/app/layout.tsx, globals.css, page.tsx             root layout, tokens, / → /projects
src/app/projects/page.tsx                             dashboard
src/app/projects/new/page.tsx                         create wizard
src/app/projects/[projectId]/layout.tsx               loads project, renders ProjectShell
src/app/projects/[projectId]/page.tsx                 project home
src/app/projects/[projectId]/models/{layout,page}.tsx, models/[modelId]/page.tsx
src/app/projects/[projectId]/routes/page.tsx, routes/[routeId]/page.tsx
src/app/projects/[projectId]/{console,docs,settings}/page.tsx
src/components/ui/*                                   shadcn primitives (generated)
src/components/theme-provider.tsx, theme-toggle.tsx
src/components/shell/*                                logo, user-avatar, nav-items, app-sidebar, project-switcher, top-bar, project-shell, dashboard-header, command-palette
src/components/domain/*                               method-badge, help-hint, empty-state, page-header, copy-button, code-block, project-card, template-card
src/components/dashboard/create-project-wizard.tsx
src/components/models/*                               model-list, new-model-dialog, field-type-picker, field-row, model-field-table, sample-data-table, model-editor
src/components/routes/*                               crud-generator-dialog, crud-banner, route-row, path-preview, route-editor
src/components/console/*                              route-picker, request-form, json-tree, response-viewer
src/components/docs/*                                 model-fields-doc, endpoint-doc
src/components/home/onboarding-checklist.tsx
src/lib/*                                             types, ids, slug, paths, arrays, format, methods, field-types, actions, validation, templates, crud, routes, mock-engine, examples, json-highlight, request-body, docs, onboarding, utils
src/lib/services/{types,index}.ts, services/mock/{latency,db,project-service,model-service,route-service,console-service}.ts
src/store/{project-store,ui-store,use-project}.ts
src/test/render.tsx, vitest.config.ts, vitest.setup.ts
```

---

### Task 1: Scaffold, design tokens, theme toggle, test harness

**Files:**
- Create: the Next.js project (root), `vitest.config.ts`, `vitest.setup.ts`, `src/test/render.tsx`, `src/components/theme-provider.tsx`, `src/components/theme-toggle.tsx`, `src/components/theme-toggle.test.tsx`
- Modify: `src/app/globals.css`, `src/app/layout.tsx`, `src/app/page.tsx`, `package.json`

**Interfaces:**
- Produces: `ThemeToggle` (button, accessible name "Toggle theme"); `renderUi(ui)` test helper wrapping `TooltipProvider`; Tailwind colour utilities `bg-surface`, `bg-surface-2`, `text-success`, `text-warning`, `text-method-{get|post|put|patch|delete}`, and `cn()` from `@/lib/utils`.

- [ ] **Step 1: Init git and commit the docs**

```bash
cd /Users/mohithingorani/Documents/aradhana_folder/universal-api
git init
git add docs
git commit -m "docs: add UI design spec and implementation plan" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

- [ ] **Step 2: Create the Next.js app in place**

```bash
npx create-next-app@latest . --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm --yes
```
Expected: the app is created (the existing `docs/` folder is allowed). Check that `src/app/page.tsx` exists.

- [ ] **Step 3: Install dependencies and shadcn/ui**

```bash
npm i zustand zod @faker-js/faker next-themes lucide-react
npm i -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event vite-tsconfig-paths
npx shadcn@latest init -d
npx shadcn@latest add button input textarea label select checkbox switch tabs dialog sheet dropdown-menu tooltip sonner badge card table command skeleton popover progress -y
```
Expected: `components.json`, `src/lib/utils.ts` and `src/components/ui/*.tsx` exist.

- [ ] **Step 4: Add test scripts to `package.json`**

Add to `"scripts"`: `"test": "vitest run"` and `"test:watch": "vitest"`.

- [ ] **Step 5: Create `vitest.config.ts`**

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    css: false,
  },
});
```

- [ ] **Step 6: Create `vitest.setup.ts`**

```ts
import "@testing-library/jest-dom/vitest";
import { afterEach, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: vi.fn(() => "/"),
  useParams: vi.fn(() => ({})),
  useSearchParams: () => new URLSearchParams(),
  redirect: vi.fn(),
}));

class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver ??= ResizeObserverStub as unknown as typeof ResizeObserver;
Element.prototype.scrollIntoView ??= function () {};
Element.prototype.hasPointerCapture ??= () => false;
Element.prototype.releasePointerCapture ??= () => {};
window.matchMedia ??= (query: string) =>
  ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }) as MediaQueryList;

afterEach(() => {
  localStorage.clear();
});
```

- [ ] **Step 7: Create `src/test/render.tsx`**

```tsx
import { render } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";

export function renderUi(ui: React.ReactElement) {
  return render(<TooltipProvider>{ui}</TooltipProvider>);
}
```

- [ ] **Step 8: Write the failing ThemeToggle test** — `src/components/theme-toggle.test.tsx`

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeToggle } from "@/components/theme-toggle";

it("switches from dark to light", async () => {
  const user = userEvent.setup();
  render(
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <ThemeToggle />
    </ThemeProvider>,
  );
  await waitFor(() => expect(document.documentElement).toHaveClass("dark"));
  await user.click(screen.getByRole("button", { name: "Toggle theme" }));
  await waitFor(() => expect(document.documentElement).toHaveClass("light"));
});
```

- [ ] **Step 9: Run it and confirm it fails**

Run: `npm test -- src/components/theme-toggle.test.tsx`
Expected: FAIL with "Failed to resolve import "@/components/theme-provider"".

- [ ] **Step 10: Create `src/components/theme-provider.tsx`**

```tsx
"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider(props: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props} />;
}
```

- [ ] **Step 11: Create `src/components/theme-toggle.tsx`**

```tsx
"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme !== "light";
  return (
    <Button variant="ghost" size="icon" aria-label="Toggle theme" onClick={() => setTheme(isDark ? "light" : "dark")}>
      {isDark ? <Sun className="size-4" /> : <Moon className="size-4" />}
    </Button>
  );
}
```

- [ ] **Step 12: Run the test and confirm it passes**

Run: `npm test -- src/components/theme-toggle.test.tsx`
Expected: PASS.

- [ ] **Step 13: Replace `src/app/globals.css`**

Keep any extra `@import` lines that shadcn generated (e.g. `@import "shadcn/tailwind.css";`) directly below `@import "tailwindcss";`. Replace everything else with:

```css
@import "tailwindcss";
@import "tw-animate-css";

@custom-variant dark (&:is(.dark *));

@theme inline {
  --font-sans: var(--font-inter);
  --font-mono: var(--font-jetbrains-mono);
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-surface: var(--surface);
  --color-surface-2: var(--surface-2);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-success: var(--success);
  --color-warning: var(--warning);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-method-get: var(--method-get);
  --color-method-post: var(--method-post);
  --color-method-put: var(--method-put);
  --color-method-patch: var(--method-patch);
  --color-method-delete: var(--method-delete);
  --radius-sm: 6px;
  --radius-md: 6px;
  --radius-lg: 10px;
  --radius-xl: 10px;
}

:root {
  --background: #ffffff;
  --foreground: #09090b;
  --surface: #f7f7f8;
  --surface-2: #ffffff;
  --card: #ffffff;
  --card-foreground: #09090b;
  --popover: #ffffff;
  --popover-foreground: #09090b;
  --primary: #6d4aff;
  --primary-foreground: #ffffff;
  --secondary: #f4f4f5;
  --secondary-foreground: #09090b;
  --muted: #f4f4f5;
  --muted-foreground: #71717a;
  --accent: #f4f4f5;
  --accent-foreground: #09090b;
  --destructive: #dc2626;
  --success: #16a34a;
  --warning: #d97706;
  --border: #e4e4e7;
  --input: #e4e4e7;
  --ring: #6d4aff;
  --method-get: #15803d;
  --method-post: #1d4ed8;
  --method-put: #b45309;
  --method-patch: #7e22ce;
  --method-delete: #b91c1c;
}

.dark {
  --background: #0a0a0b;
  --foreground: #fafafa;
  --surface: #111113;
  --surface-2: #18181b;
  --card: #18181b;
  --card-foreground: #fafafa;
  --popover: #18181b;
  --popover-foreground: #fafafa;
  --primary: #7c5cff;
  --primary-foreground: #ffffff;
  --secondary: #27272a;
  --secondary-foreground: #fafafa;
  --muted: #27272a;
  --muted-foreground: #a1a1aa;
  --accent: #27272a;
  --accent-foreground: #fafafa;
  --destructive: #ef4444;
  --success: #22c55e;
  --warning: #f59e0b;
  --border: #27272a;
  --input: #27272a;
  --ring: #7c5cff;
  --method-get: #22c55e;
  --method-post: #3b82f6;
  --method-put: #f59e0b;
  --method-patch: #a855f7;
  --method-delete: #ef4444;
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-background font-sans text-foreground antialiased;
  }
  @media (prefers-reduced-motion: reduce) {
    *,
    *::before,
    *::after {
      animation-duration: 0.01ms !important;
      transition-duration: 0.01ms !important;
    }
  }
}
```

- [ ] **Step 14: Replace `src/app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono" });

export const metadata: Metadata = {
  title: "Universal API",
  description: "Build an API without writing code",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`} suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
          <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
```

- [ ] **Step 15: Replace `src/app/page.tsx`**

```tsx
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/projects");
}
```

- [ ] **Step 16: Verify the build and lint, then commit**

Run: `npm run build && npm run lint && npm test`
Expected: all succeed. `/projects` is a 404 until Task 7; that's expected.

```bash
git add -A
git commit -m "chore: scaffold Next.js app with design tokens, theming and test harness" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Core domain types and helpers

**Files:**
- Create: `src/lib/types.ts`, `src/lib/ids.ts`, `src/lib/slug.ts`, `src/lib/paths.ts`, `src/lib/arrays.ts`, `src/lib/format.ts`, `src/lib/methods.ts`, `src/lib/field-types.ts`, `src/lib/actions.ts`
- Test: `src/lib/core.test.ts`

**Interfaces:**
- Produces (used everywhere later):
  - Types `HttpMethod`, `FieldType`, `RouteAction`, `TemplateId`, `Field`, `Model`, `Route`, `Project`, `TestRequest`, `TestResponse`
  - `createId(prefix: string): string`
  - `slugify(s): string`, `pluralize(word): string` (lower-cased), `article(word): "a" | "an"`, `resourcePath(modelName): string`, `baseUrl(slug): string`
  - `routeParams(path): string[]`, `fillPath(path, params): string`
  - `moveItem<T>(items, from, to): T[]`
  - `timeAgo(iso, now?): string`, `countLabel(n, singular, plural?)`, `formatCell(value): string`
  - `METHODS`, `METHOD_META[method].{label, hint, className}`
  - `FIELD_TYPES`, `fieldTypeMeta(type)`, `FieldTypeMeta`
  - `ACTIONS`, `ACTION_META[action].{label, description, method}`

- [ ] **Step 1: Write the failing test** — `src/lib/core.test.ts`

```ts
import { moveItem } from "./arrays";
import { FIELD_TYPES, fieldTypeMeta } from "./field-types";
import { countLabel, formatCell, timeAgo } from "./format";
import { METHOD_META } from "./methods";
import { fillPath, routeParams } from "./paths";
import { article, baseUrl, pluralize, resourcePath, slugify } from "./slug";
import { ACTION_META } from "./actions";

describe("slug helpers", () => {
  it("slugifies names", () => {
    expect(slugify("  My Store! ")).toBe("my-store");
    expect(slugify("!!!")).toBe("");
  });
  it("pluralizes simple English nouns", () => {
    expect(pluralize("Product")).toBe("products");
    expect(pluralize("Category")).toBe("categories");
    expect(pluralize("Box")).toBe("boxes");
  });
  it("builds resource paths and base URLs", () => {
    expect(resourcePath("Blog Post")).toBe("/blog-posts");
    expect(baseUrl("my-store")).toBe("/api/my-store");
  });
  it("picks the right article", () => {
    expect(article("order")).toBe("an");
    expect(article("customer")).toBe("a");
  });
});

describe("paths", () => {
  it("extracts and fills params", () => {
    expect(routeParams("/a/:id/b/:slug")).toEqual(["id", "slug"]);
    expect(fillPath("/products/:id", { id: "7" })).toBe("/products/7");
    expect(fillPath("/products/:id", {})).toBe("/products/:id");
  });
});

describe("moveItem", () => {
  it("moves an element", () => {
    expect(moveItem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
  });
  it("ignores out-of-range moves", () => {
    const items = ["a"];
    expect(moveItem(items, 0, 3)).toBe(items);
  });
});

describe("format", () => {
  it("formats relative time", () => {
    const now = new Date("2026-09-19T12:00:00Z");
    expect(timeAgo("2026-09-19T10:00:00Z", now)).toBe("2 hours ago");
    expect(timeAgo("2026-09-19T11:59:40Z", now)).toBe("just now");
  });
  it("formats counts and cells", () => {
    expect(countLabel(1, "model")).toBe("1 model");
    expect(countLabel(3, "model")).toBe("3 models");
    expect(formatCell(true)).toBe("Yes");
    expect(formatCell(null)).toBe("—");
    expect(formatCell({ a: 1 })).toBe('{"a":1}');
  });
});

describe("metadata tables", () => {
  it("covers every field type once", () => {
    expect(FIELD_TYPES.map((f) => f.type)).toEqual([
      "text", "number", "boolean", "date", "email", "url", "choice", "link", "json",
    ]);
    expect(fieldTypeMeta("boolean").label).toBe("Yes/No");
  });
  it("has friendly method and action labels", () => {
    expect(METHOD_META.GET.label).toBe("Read");
    expect(METHOD_META.DELETE.label).toBe("Delete");
    expect(ACTION_META.create.method).toBe("POST");
  });
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npm test -- src/lib/core.test.ts`
Expected: FAIL with "Failed to resolve import "./arrays"".

- [ ] **Step 3: Create `src/lib/types.ts`**

```ts
export type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
export type FieldType = "text" | "number" | "boolean" | "date" | "email" | "url" | "choice" | "link" | "json";
export type RouteAction = "list" | "get" | "create" | "update" | "delete" | "custom";
export type TemplateId = "blog" | "store" | "todo";

export interface Field {
  id: string;
  name: string;
  type: FieldType;
  required: boolean;
  unique: boolean;
  options?: string[];
  linkTo?: string;
}

export interface Model {
  id: string;
  name: string;
  fields: Field[];
}

export interface Route {
  id: string;
  method: HttpMethod;
  path: string;
  modelId: string | null;
  action: RouteAction;
  description: string;
  filters: string[];
}

export interface Project {
  id: string;
  name: string;
  slug: string;
  description: string;
  models: Model[];
  routes: Route[];
  createdAt: string;
  updatedAt: string;
}

export interface TestRequest {
  routeId: string;
  params: Record<string, string>;
  query: Record<string, string>;
  body: unknown;
}

export interface TestResponse {
  status: number;
  durationMs: number;
  body: unknown;
}
```

- [ ] **Step 4: Create `src/lib/ids.ts`**

```ts
export function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 10)}`;
}
```

- [ ] **Step 5: Create `src/lib/slug.ts`**

```ts
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function pluralize(word: string): string {
  const w = word.toLowerCase();
  if (/[^aeiou]y$/.test(w)) return `${w.slice(0, -1)}ies`;
  if (/(s|x|z|ch|sh)$/.test(w)) return `${w}es`;
  return `${w}s`;
}

export function article(word: string): "a" | "an" {
  return /^[aeiou]/i.test(word) ? "an" : "a";
}

export function resourcePath(modelName: string): string {
  return `/${slugify(pluralize(modelName))}`;
}

export function baseUrl(slug: string): string {
  return `/api/${slug}`;
}
```

- [ ] **Step 6: Create `src/lib/paths.ts`**

```ts
export function routeParams(path: string): string[] {
  return path
    .split("/")
    .filter((s) => s.startsWith(":"))
    .map((s) => s.slice(1));
}

export function fillPath(path: string, params: Record<string, string>): string {
  return path
    .split("/")
    .map((s) => (s.startsWith(":") && params[s.slice(1)] ? encodeURIComponent(params[s.slice(1)]) : s))
    .join("/");
}
```

- [ ] **Step 7: Create `src/lib/arrays.ts`**

```ts
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return items;
  const next = items.slice();
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
```

- [ ] **Step 8: Create `src/lib/format.ts`**

```ts
const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31536000],
  ["month", 2592000],
  ["week", 604800],
  ["day", 86400],
  ["hour", 3600],
  ["minute", 60],
];

export function timeAgo(iso: string, now: Date = new Date()): string {
  const seconds = Math.round((new Date(iso).getTime() - now.getTime()) / 1000);
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return "just now";
}

export function countLabel(n: number, singular: string, plural = `${singular}s`): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

export function formatCell(value: unknown): string {
  if (value === null || value === undefined) return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
```

- [ ] **Step 9: Create `src/lib/methods.ts`**

```ts
import type { HttpMethod } from "./types";

export const METHODS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];

export const METHOD_META: Record<HttpMethod, { label: string; hint: string; className: string }> = {
  GET: { label: "Read", hint: "Fetch data without changing anything", className: "text-method-get bg-method-get/15 border-method-get/30" },
  POST: { label: "Create", hint: "Add something new", className: "text-method-post bg-method-post/15 border-method-post/30" },
  PUT: { label: "Update", hint: "Change an existing record", className: "text-method-put bg-method-put/15 border-method-put/30" },
  PATCH: { label: "Edit", hint: "Change part of an existing record", className: "text-method-patch bg-method-patch/15 border-method-patch/30" },
  DELETE: { label: "Delete", hint: "Remove a record", className: "text-method-delete bg-method-delete/15 border-method-delete/30" },
};
```

- [ ] **Step 10: Create `src/lib/field-types.ts`**

```ts
import type { FieldType } from "./types";

export interface FieldTypeMeta {
  type: FieldType;
  label: string;
  icon: string;
  description: string;
  advanced?: boolean;
}

export const FIELD_TYPES: FieldTypeMeta[] = [
  { type: "text", label: "Text", icon: "Aa", description: "Names, titles, any words" },
  { type: "number", label: "Number", icon: "#", description: "Prices, counts, ages" },
  { type: "boolean", label: "Yes/No", icon: "◐", description: "On or off, true or false" },
  { type: "date", label: "Date", icon: "📅", description: "A calendar day" },
  { type: "email", label: "Email", icon: "@", description: "An email address, checked for format" },
  { type: "url", label: "URL", icon: "🔗", description: "A web link" },
  { type: "choice", label: "Choice list", icon: "☰", description: "One option from a list you define" },
  { type: "link", label: "Link to model", icon: "↗", description: "Connect to a record in another model" },
  { type: "json", label: "JSON", icon: "{}", description: "Free-form structured data", advanced: true },
];

export function fieldTypeMeta(type: FieldType): FieldTypeMeta {
  const meta = FIELD_TYPES.find((f) => f.type === type);
  if (!meta) throw new Error(`Unknown field type: ${type}`);
  return meta;
}
```

- [ ] **Step 11: Create `src/lib/actions.ts`**

```ts
import type { HttpMethod, RouteAction } from "./types";

export const ACTION_META: Record<RouteAction, { label: string; description: string; method: HttpMethod }> = {
  list: { label: "List records", description: "Returns every record, with optional filters", method: "GET" },
  get: { label: "Get one record", description: "Returns a single record by its id", method: "GET" },
  create: { label: "Add a record", description: "Saves a new record from the data you send", method: "POST" },
  update: { label: "Update a record", description: "Changes the fields you send on an existing record", method: "PUT" },
  delete: { label: "Delete a record", description: "Removes a record by its id", method: "DELETE" },
  custom: { label: "Custom", description: "Returns a simple message. Link a model to return data", method: "GET" },
};

export const ACTIONS = Object.keys(ACTION_META) as RouteAction[];
```

- [ ] **Step 12: Run the tests and confirm they pass**

Run: `npm test -- src/lib/core.test.ts`
Expected: PASS.

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "feat: add core domain types and helpers" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Validation, templates, CRUD generation, route grouping

**Files:**
- Create: `src/lib/validation.ts`, `src/lib/templates.ts`, `src/lib/crud.ts`, `src/lib/routes.ts`
- Test: `src/lib/validation.test.ts`, `src/lib/templates.test.ts`, `src/lib/crud.test.ts`

**Interfaces:**
- Consumes: Task 2 types and helpers.
- Produces:
  - `validateProjectName(name, projects: Project[], selfId?): string | null`
  - `validateSlug(slug, projects, selfId?): string | null`
  - `validateModelName(name, models: Model[], selfId?): string | null`
  - `validateFieldName(name, fields: Field[], selfId?): string | null`
  - `fieldErrors(fields): Record<string, string>` (keyed by field id); `validateFields(fields): string | null`
  - `validateRoute(route: Pick<Route, "id" | "method" | "path" | "action">, routes: Route[]): string | null`
  - `TEMPLATES: TemplateMeta[]` with `{ id, name, description, emoji }`; `buildTemplateModels(id): Model[]`; `templateModelNames(id): string[]`; `newField(): Field`
  - `type CrudAction = Exclude<RouteAction, "custom">`; `CrudOption { action, method, path, label }`; `crudOptions(model): CrudOption[]`; `buildCrudRoutes(model, actions: CrudAction[], existing: Route[]): Route[]`
  - `RouteGroup { key, title, model: Model | null, routes }`; `groupRoutes(project): RouteGroup[]`; `uniquePath(routes, base?): string`; `missingCrud(model, routes): boolean`

- [ ] **Step 1: Write the failing tests**

`src/lib/validation.test.ts`:
```ts
import type { Field, Project, Route } from "./types";
import {
  fieldErrors, validateFieldName, validateModelName, validateProjectName, validateRoute, validateSlug,
} from "./validation";

const project = (id: string, slug: string) => ({ id, slug }) as Project;
const field = (id: string, name: string, extra: Partial<Field> = {}): Field => ({
  id, name, type: "text", required: false, unique: false, ...extra,
});
const route = (id: string, method: Route["method"], path: string, action: Route["action"] = "custom"): Route => ({
  id, method, path, action, modelId: null, description: "", filters: [],
});

describe("project names and slugs", () => {
  it("requires a name", () => {
    expect(validateProjectName("  ", [])).toBe("Give your API a name.");
  });
  it("rejects names that produce an existing slug", () => {
    expect(validateProjectName("My Store", [project("p1", "my-store")])).toBe("You already have an API with this name.");
    expect(validateProjectName("My Store", [project("p1", "my-store")], "p1")).toBeNull();
  });
  it("validates slugs", () => {
    expect(validateSlug("My Store", [])).toBe("Use lowercase letters, numbers and dashes, like my-store.");
    expect(validateSlug("shop", [project("p2", "shop")], "p1")).toBe("Another API already uses this address.");
    expect(validateSlug("shop", [])).toBeNull();
  });
});

describe("model and field names", () => {
  it("rejects duplicate model names case-insensitively", () => {
    expect(validateModelName("customer", [{ id: "m1", name: "Customer", fields: [] }])).toBe(
      "A model with this name already exists.",
    );
  });
  it("rejects names starting with a digit", () => {
    expect(validateModelName("1Thing", [])).toBe("Start with a letter, and use only letters, numbers and spaces.");
  });
  it("rejects bad and duplicate field names", () => {
    expect(validateFieldName("first name", [])).toBe(
      "Start with a letter, and use only letters, numbers and underscores (no spaces).",
    );
    expect(validateFieldName("id", [])).toBe("'id' is added automatically. Pick another name.");
    expect(validateFieldName("name", [field("a", "name")], "b")).toBe("This model already has a field with that name.");
  });
  it("reports per-field errors", () => {
    const errors = fieldErrors([
      field("a", "size", { type: "choice", options: [] }),
      field("b", "owner", { type: "link" }),
      field("c", "title"),
    ]);
    expect(errors).toEqual({ a: "Add at least one choice.", b: "Pick which model this links to." });
  });
});

describe("routes", () => {
  const existing = [route("r1", "GET", "/products", "list")];
  it("rejects malformed paths", () => {
    expect(validateRoute(route("r2", "GET", "products"), existing)).toBe(
      "Paths start with / and use lowercase words, like /customers or /customers/:id.",
    );
  });
  it("requires :id for single-record actions", () => {
    expect(validateRoute(route("r2", "GET", "/products/one", "get"), existing)).toBe(
      "This action needs :id in the path, like /customers/:id.",
    );
  });
  it("rejects method + path conflicts but allows editing itself", () => {
    expect(validateRoute(route("r2", "GET", "/products"), existing)).toBe("Two routes can't share the same method and path.");
    expect(validateRoute(route("r1", "GET", "/products", "list"), existing)).toBeNull();
    expect(validateRoute(route("r2", "POST", "/products"), existing)).toBeNull();
  });
});
```

`src/lib/templates.test.ts`:
```ts
import { buildTemplateModels, templateModelNames, TEMPLATES } from "./templates";

it("lists three templates", () => {
  expect(TEMPLATES.map((t) => t.id)).toEqual(["blog", "store", "todo"]);
});

it("builds the store models with resolved links", () => {
  const models = buildTemplateModels("store");
  expect(models.map((m) => m.name)).toEqual(["Product", "Customer", "Order"]);
  const customer = models.find((m) => m.name === "Customer")!;
  const order = models.find((m) => m.name === "Order")!;
  expect(order.fields.find((f) => f.name === "customer")!.linkTo).toBe(customer.id);
  expect(templateModelNames("todo")).toEqual(["Task"]);
});

it("generates fresh ids each time", () => {
  expect(buildTemplateModels("todo")[0].id).not.toBe(buildTemplateModels("todo")[0].id);
});
```

`src/lib/crud.test.ts`:
```ts
import { buildCrudRoutes, crudOptions } from "./crud";
import { groupRoutes, missingCrud, uniquePath } from "./routes";
import type { Model, Project } from "./types";

const order: Model = { id: "m1", name: "Order", fields: [] };

it("offers five plain-language CRUD options", () => {
  expect(crudOptions(order).map((o) => `${o.method} ${o.path} ${o.label}`)).toEqual([
    "GET /orders List all orders",
    "GET /orders/:id Get one order",
    "POST /orders Add an order",
    "PUT /orders/:id Update an order",
    "DELETE /orders/:id Delete an order",
  ]);
});

it("builds only selected, non-existing routes", () => {
  const first = buildCrudRoutes(order, ["list", "create"], []);
  expect(first.map((r) => r.action)).toEqual(["list", "create"]);
  expect(first[0]).toMatchObject({ modelId: "m1", description: "List all orders", filters: [] });
  const second = buildCrudRoutes(order, ["list", "get"], first);
  expect(second.map((r) => r.action)).toEqual(["get"]);
});

it("groups routes by model with an 'Other routes' bucket", () => {
  const routes = buildCrudRoutes(order, ["list"], []);
  const project = {
    models: [order, { id: "m2", name: "Item", fields: [] }],
    routes: [...routes, { ...routes[0], id: "x", modelId: null, path: "/ping" }],
  } as Project;
  const groups = groupRoutes(project);
  expect(groups.map((g) => [g.title, g.routes.length])).toEqual([["Order", 1], ["Item", 0], ["Other routes", 1]]);
  expect(missingCrud(order, project.routes)).toBe(true);
  expect(missingCrud(order, buildCrudRoutes(order, ["list", "get", "create", "update", "delete"], []))).toBe(false);
});

it("finds an unused path", () => {
  const r = buildCrudRoutes(order, ["list"], [])[0];
  expect(uniquePath([])).toBe("/new-route");
  expect(uniquePath([{ ...r, path: "/new-route" }, { ...r, path: "/new-route-2" }])).toBe("/new-route-3");
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `npm test -- src/lib/validation.test.ts src/lib/templates.test.ts src/lib/crud.test.ts`
Expected: FAIL with unresolved imports.

- [ ] **Step 3: Create `src/lib/validation.ts`**

```ts
import { z } from "zod";
import { routeParams } from "./paths";
import { slugify } from "./slug";
import type { Field, Model, Project, Route } from "./types";

const projectNameSchema = z.string().trim().min(1, "Give your API a name.").max(50, "Keep the name under 50 characters.");
const slugSchema = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes, like my-store.");
const modelNameSchema = z
  .string()
  .trim()
  .min(1, "Give the model a name.")
  .max(40, "Keep the name under 40 characters.")
  .regex(/^[A-Za-z][A-Za-z0-9 ]*$/, "Start with a letter, and use only letters, numbers and spaces.");
const fieldNameSchema = z
  .string()
  .trim()
  .min(1, "Give the field a name.")
  .regex(/^[A-Za-z][A-Za-z0-9_]*$/, "Start with a letter, and use only letters, numbers and underscores (no spaces).");
const SEGMENT = "(?:[a-z0-9-]+|:[A-Za-z][A-Za-z0-9]*)";
const pathSchema = z
  .string()
  .regex(new RegExp(`^(?:/${SEGMENT})+$`), "Paths start with / and use lowercase words, like /customers or /customers/:id.");

function firstIssue(schema: z.ZodType, value: unknown): string | null {
  const result = schema.safeParse(value);
  return result.success ? null : (result.error.issues[0]?.message ?? "This value isn't valid.");
}

export function validateProjectName(name: string, projects: Project[], selfId?: string): string | null {
  const err = firstIssue(projectNameSchema, name);
  if (err) return err;
  const slug = slugify(name);
  if (!slug) return "Use at least one letter or number.";
  if (projects.some((p) => p.id !== selfId && p.slug === slug)) return "You already have an API with this name.";
  return null;
}

export function validateSlug(slug: string, projects: Project[], selfId?: string): string | null {
  const err = firstIssue(slugSchema, slug);
  if (err) return err;
  if (projects.some((p) => p.id !== selfId && p.slug === slug)) return "Another API already uses this address.";
  return null;
}

export function validateModelName(name: string, models: Model[], selfId?: string): string | null {
  const err = firstIssue(modelNameSchema, name);
  if (err) return err;
  const key = name.trim().toLowerCase();
  if (models.some((m) => m.id !== selfId && m.name.trim().toLowerCase() === key)) return "A model with this name already exists.";
  return null;
}

export function validateFieldName(name: string, fields: Field[], selfId?: string): string | null {
  const err = firstIssue(fieldNameSchema, name);
  if (err) return err;
  const key = name.trim().toLowerCase();
  if (key === "id") return "'id' is added automatically. Pick another name.";
  if (fields.some((f) => f.id !== selfId && f.name.trim().toLowerCase() === key)) {
    return "This model already has a field with that name.";
  }
  return null;
}

export function fieldErrors(fields: Field[]): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const field of fields) {
    const err =
      validateFieldName(field.name, fields, field.id) ??
      (field.type === "choice" && !field.options?.length ? "Add at least one choice." : null) ??
      (field.type === "link" && !field.linkTo ? "Pick which model this links to." : null);
    if (err) errors[field.id] = err;
  }
  return errors;
}

export function validateFields(fields: Field[]): string | null {
  return Object.values(fieldErrors(fields))[0] ?? null;
}

const NEEDS_ID: Route["action"][] = ["get", "update", "delete"];

export function validateRoute(route: Pick<Route, "id" | "method" | "path" | "action">, routes: Route[]): string | null {
  const err = firstIssue(pathSchema, route.path);
  if (err) return err;
  if (NEEDS_ID.includes(route.action) && !routeParams(route.path).includes("id")) {
    return "This action needs :id in the path, like /customers/:id.";
  }
  if (routes.some((r) => r.id !== route.id && r.method === route.method && r.path === route.path)) {
    return "Two routes can't share the same method and path.";
  }
  return null;
}
```

- [ ] **Step 4: Create `src/lib/templates.ts`**

```ts
import { createId } from "./ids";
import type { Field, FieldType, Model, TemplateId } from "./types";

export interface TemplateMeta {
  id: TemplateId;
  name: string;
  description: string;
  emoji: string;
}

export const TEMPLATES: TemplateMeta[] = [
  { id: "blog", name: "Blog", description: "Authors and posts", emoji: "📝" },
  { id: "store", name: "Store", description: "Products, customers and orders", emoji: "🛒" },
  { id: "todo", name: "To-do list", description: "Tasks with due dates", emoji: "✅" },
];

type FieldOpts = { required?: boolean; unique?: boolean; options?: string[]; linkTo?: string };
type FieldSpec = [name: string, type: FieldType, opts?: FieldOpts];

const SPECS: Record<TemplateId, Record<string, FieldSpec[]>> = {
  blog: {
    Author: [["name", "text", { required: true }], ["email", "email", { required: true, unique: true }]],
    Post: [
      ["title", "text", { required: true }],
      ["body", "text"],
      ["published", "boolean"],
      ["author", "link", { linkTo: "Author" }],
    ],
  },
  store: {
    Product: [
      ["name", "text", { required: true }],
      ["price", "number", { required: true }],
      ["inStock", "boolean"],
      ["category", "choice", { options: ["Clothing", "Electronics", "Home"] }],
    ],
    Customer: [["name", "text", { required: true }], ["email", "email", { required: true, unique: true }]],
    Order: [
      ["customer", "link", { required: true, linkTo: "Customer" }],
      ["total", "number", { required: true }],
      ["status", "choice", { options: ["pending", "paid", "shipped"] }],
    ],
  },
  todo: {
    Task: [["title", "text", { required: true }], ["done", "boolean"], ["dueDate", "date"]],
  },
};

export function buildTemplateModels(id: TemplateId): Model[] {
  const specs = SPECS[id];
  const ids: Record<string, string> = Object.fromEntries(Object.keys(specs).map((name) => [name, createId("mdl")]));
  return Object.entries(specs).map(([name, fields]) => ({
    id: ids[name],
    name,
    fields: fields.map(
      ([fieldName, type, opts = {}]): Field => ({
        id: createId("fld"),
        name: fieldName,
        type,
        required: opts.required ?? false,
        unique: opts.unique ?? false,
        ...(opts.options ? { options: opts.options } : {}),
        ...(opts.linkTo ? { linkTo: ids[opts.linkTo] } : {}),
      }),
    ),
  }));
}

export function templateModelNames(id: TemplateId): string[] {
  return Object.keys(SPECS[id]);
}

export function newField(): Field {
  return { id: createId("fld"), name: "", type: "text", required: false, unique: false };
}
```

- [ ] **Step 5: Create `src/lib/crud.ts`**

```ts
import { createId } from "./ids";
import { article, pluralize, resourcePath } from "./slug";
import type { HttpMethod, Model, Route, RouteAction } from "./types";

export type CrudAction = Exclude<RouteAction, "custom">;

export interface CrudOption {
  action: CrudAction;
  method: HttpMethod;
  path: string;
  label: string;
}

export function crudOptions(model: Model): CrudOption[] {
  const base = resourcePath(model.name);
  const plural = pluralize(model.name);
  const one = model.name.toLowerCase();
  const a = article(one);
  return [
    { action: "list", method: "GET", path: base, label: `List all ${plural}` },
    { action: "get", method: "GET", path: `${base}/:id`, label: `Get one ${one}` },
    { action: "create", method: "POST", path: base, label: `Add ${a} ${one}` },
    { action: "update", method: "PUT", path: `${base}/:id`, label: `Update ${a} ${one}` },
    { action: "delete", method: "DELETE", path: `${base}/:id`, label: `Delete ${a} ${one}` },
  ];
}

export function buildCrudRoutes(model: Model, actions: CrudAction[], existing: Route[]): Route[] {
  return crudOptions(model)
    .filter((o) => actions.includes(o.action))
    .filter((o) => !existing.some((r) => r.method === o.method && r.path === o.path))
    .map((o) => ({
      id: createId("rt"),
      method: o.method,
      path: o.path,
      modelId: model.id,
      action: o.action,
      description: o.label,
      filters: [],
    }));
}
```

- [ ] **Step 6: Create `src/lib/routes.ts`**

```ts
import { crudOptions } from "./crud";
import type { Model, Project, Route } from "./types";

export interface RouteGroup {
  key: string;
  title: string;
  model: Model | null;
  routes: Route[];
}

export function groupRoutes(project: Project): RouteGroup[] {
  const groups: RouteGroup[] = project.models.map((m) => ({
    key: `model-${m.id}`,
    title: m.name,
    model: m,
    routes: project.routes.filter((r) => r.modelId === m.id),
  }));
  const other = project.routes.filter((r) => !r.modelId || !project.models.some((m) => m.id === r.modelId));
  if (other.length) groups.push({ key: "other", title: "Other routes", model: null, routes: other });
  return groups;
}

export function uniquePath(routes: Route[], base = "/new-route"): string {
  if (!routes.some((r) => r.path === base)) return base;
  let n = 2;
  while (routes.some((r) => r.path === `${base}-${n}`)) n++;
  return `${base}-${n}`;
}

export function missingCrud(model: Model, routes: Route[]): boolean {
  return crudOptions(model).some((o) => !routes.some((r) => r.method === o.method && r.path === o.path));
}
```

- [ ] **Step 7: Run the tests and confirm they pass**

Run: `npm test -- src/lib`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: add validation, templates, CRUD generation and route grouping" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Mock engine and example generation

**Files:**
- Create: `src/lib/mock-engine.ts`, `src/lib/examples.ts`
- Test: `src/lib/mock-engine.test.ts`

**Interfaces:**
- Consumes: types, `buildTemplateModels`, `buildCrudRoutes`.
- Produces:
  - `type DataRecord = Record<string, unknown> & { id: string }`; `type Dataset = Record<string /*modelId*/, DataRecord[]>`
  - `EngineRequest { params: Record<string,string>; query: Record<string,string>; body: unknown }`; `EngineResult { status: number; body: unknown }`
  - `generateRecords(model, count, dataset): DataRecord[]`; `seedDataset(project, count = 5, seed = 42): Dataset`; `ensureDataset(project, dataset, count = 5): Dataset` (fills models that are missing)
  - `validateBody(model, body, mode: "create" | "update", dataset, selfId?): string[]`
  - `executeRoute(project, route, req: EngineRequest, dataset): EngineResult` (mutates the dataset)
  - `exampleRequest(route, project): Record<string, unknown> | null`; `exampleResponse(route, project): EngineResult`
- Error message format (used by later tests): `'<field>' is required`, `'<field>' should be a number`, `'<field>' should be one of: A, B`, `'<field>' must be unique. Another record already uses this value`, `'<field>' points to a record that doesn't exist`, `'<key>' is not a field on <Model>`. The 404 body is `{ error: "No <model> with id <id>" }` and the 400 body is `{ error: "Validation failed", details: string[] }`.

- [ ] **Step 1: Write the failing test** — `src/lib/mock-engine.test.ts`

```ts
import { buildCrudRoutes } from "./crud";
import { exampleRequest, exampleResponse } from "./examples";
import { executeRoute, seedDataset, type Dataset } from "./mock-engine";
import { buildTemplateModels } from "./templates";
import type { Project, Route } from "./types";

function storeProject(): Project {
  const models = buildTemplateModels("store");
  const routes = models.flatMap((m) => buildCrudRoutes(m, ["list", "get", "create", "update", "delete"], []));
  return { id: "p1", name: "Store", slug: "store", description: "", models, routes, createdAt: "", updatedAt: "" };
}
const modelNamed = (p: Project, name: string) => p.models.find((m) => m.name === name)!;
const routeFor = (p: Project, model: string, action: Route["action"]) =>
  p.routes.find((r) => r.modelId === modelNamed(p, model).id && r.action === action)!;
const req = (body?: unknown, params: Record<string, string> = {}, query: Record<string, string> = {}) => ({ params, query, body });

let project: Project;
let ds: Dataset;
beforeEach(() => {
  project = storeProject();
  ds = seedDataset(project);
});

it("seeds five records per model with valid links", () => {
  const customers = ds[modelNamed(project, "Customer").id];
  const orders = ds[modelNamed(project, "Order").id];
  expect(customers.map((c) => c.id)).toEqual(["1", "2", "3", "4", "5"]);
  for (const o of orders) expect(customers.some((c) => c.id === o.customer)).toBe(true);
});

it("lists records and applies filters", () => {
  const list = routeFor(project, "Product", "list");
  expect(executeRoute(project, list, req(), ds)).toMatchObject({ status: 200, body: { count: 5 } });
  const category = String(ds[modelNamed(project, "Product").id][0].category);
  const res = executeRoute(project, { ...list, filters: ["category"] }, req(undefined, {}, { category }), ds);
  const data = (res.body as { data: { category: string }[] }).data;
  expect(data.length).toBeGreaterThan(0);
  expect(data.every((r) => r.category === category)).toBe(true);
});

it("returns 404 for a missing record", () => {
  const res = executeRoute(project, routeFor(project, "Product", "get"), req(undefined, { id: "999" }), ds);
  expect(res).toEqual({ status: 404, body: { error: "No product with id 999" } });
});

it("validates create requests", () => {
  const create = routeFor(project, "Product", "create");
  const missing = executeRoute(project, create, req({}), ds);
  expect(missing.status).toBe(400);
  expect(missing.body).toEqual({ error: "Validation failed", details: ["'name' is required", "'price' is required"] });
  const wrong = executeRoute(project, create, req({ name: "Lamp", price: "cheap", category: "Food", colour: "red" }), ds);
  expect((wrong.body as { details: string[] }).details).toEqual([
    "'colour' is not a field on Product",
    "'price' should be a number",
    "'category' should be one of: Clothing, Electronics, Home",
  ]);
});

it("creates, updates and deletes", () => {
  const create = routeFor(project, "Product", "create");
  const created = executeRoute(project, create, req({ name: "Lamp", price: 25 }), ds);
  expect(created).toMatchObject({ status: 201, body: { id: "6", name: "Lamp", price: 25, inStock: null } });

  const update = routeFor(project, "Product", "update");
  expect(executeRoute(project, update, req({ price: 30 }, { id: "6" }), ds)).toMatchObject({
    status: 200,
    body: { id: "6", name: "Lamp", price: 30 },
  });
  expect(executeRoute(project, update, req({ name: "" }, { id: "6" }), ds).status).toBe(400);

  expect(executeRoute(project, routeFor(project, "Product", "delete"), req(undefined, { id: "6" }), ds)).toEqual({
    status: 204,
    body: null,
  });
  expect(executeRoute(project, routeFor(project, "Product", "get"), req(undefined, { id: "6" }), ds).status).toBe(404);
});

it("enforces unique fields and links", () => {
  const taken = ds[modelNamed(project, "Customer").id][0].email;
  const dup = executeRoute(project, routeFor(project, "Customer", "create"), req({ name: "A", email: taken }), ds);
  expect((dup.body as { details: string[] }).details).toEqual([
    "'email' must be unique. Another record already uses this value",
  ]);
  const orphan = executeRoute(project, routeFor(project, "Order", "create"), req({ customer: "999", total: 5 }), ds);
  expect((orphan.body as { details: string[] }).details).toEqual(["'customer' points to a record that doesn't exist"]);
});

it("answers custom routes with a message", () => {
  const custom: Route = { id: "c", method: "GET", path: "/ping", modelId: null, action: "custom", description: "", filters: [] };
  expect(executeRoute(project, custom, req(), ds).status).toBe(200);
});

it("builds deterministic examples", () => {
  const create = routeFor(project, "Product", "create");
  const body = exampleRequest(create, project)!;
  expect(body).toEqual(exampleRequest(create, project));
  const response = exampleResponse(create, project);
  expect(response.status).toBe(201);
  expect(response.body).toMatchObject(body);
  expect(exampleRequest(routeFor(project, "Product", "list"), project)).toBeNull();
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npm test -- src/lib/mock-engine.test.ts`
Expected: FAIL with unresolved imports.

- [ ] **Step 3: Create `src/lib/mock-engine.ts`**

```ts
import { faker } from "@faker-js/faker";
import type { Field, Model, Project, Route } from "./types";

export type DataRecord = Record<string, unknown> & { id: string };
export type Dataset = Record<string, DataRecord[]>;
export interface EngineRequest {
  params: Record<string, string>;
  query: Record<string, string>;
  body: unknown;
}
export interface EngineResult {
  status: number;
  body: unknown;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function nextId(records: DataRecord[]): number {
  return records.reduce((max, r) => Math.max(max, Number(r.id) || 0), 0) + 1;
}

function isEmpty(value: unknown): boolean {
  return value === undefined || value === null || value === "";
}

function generateValue(field: Field, dataset: Dataset): unknown {
  const name = field.name.toLowerCase();
  switch (field.type) {
    case "text":
      if (name.includes("name")) return faker.person.fullName();
      if (name.includes("title")) return faker.lorem.sentence(4);
      return faker.lorem.words(3);
    case "number":
      return faker.number.int({ min: 1, max: 500 });
    case "boolean":
      return faker.datatype.boolean();
    case "date":
      return faker.date.recent({ days: 30 }).toISOString().slice(0, 10);
    case "email":
      return faker.internet.email().toLowerCase();
    case "url":
      return faker.internet.url();
    case "choice":
      return field.options?.length ? faker.helpers.arrayElement(field.options) : null;
    case "link": {
      const targets = field.linkTo ? (dataset[field.linkTo] ?? []) : [];
      return targets.length ? faker.helpers.arrayElement(targets).id : null;
    }
    case "json":
      return { note: faker.lorem.word() };
  }
}

export function generateRecords(model: Model, count: number, dataset: Dataset): DataRecord[] {
  const start = nextId(dataset[model.id] ?? []);
  return Array.from({ length: count }, (_, i) => ({
    ...Object.fromEntries(model.fields.map((f) => [f.name, generateValue(f, dataset)])),
    id: String(start + i),
  }));
}

export function ensureDataset(project: Project, dataset: Dataset, count = 5): Dataset {
  for (const model of project.models) {
    if (!dataset[model.id]) dataset[model.id] = generateRecords(model, count, dataset);
  }
  // Fill links whose target model was generated after the linking model.
  for (const model of project.models) {
    for (const field of model.fields) {
      if (field.type !== "link") continue;
      for (const record of dataset[model.id]) {
        if (record[field.name] === null) record[field.name] = generateValue(field, dataset);
      }
    }
  }
  return dataset;
}

export function seedDataset(project: Project, count = 5, seed = 42): Dataset {
  faker.seed(seed);
  return ensureDataset(project, {}, count);
}

function typeError(field: Field, value: unknown, dataset: Dataset): string | null {
  const q = `'${field.name}'`;
  switch (field.type) {
    case "text":
      return typeof value === "string" ? null : `${q} should be text`;
    case "number":
      return typeof value === "number" && Number.isFinite(value) ? null : `${q} should be a number`;
    case "boolean":
      return typeof value === "boolean" ? null : `${q} should be true or false`;
    case "date":
      return typeof value === "string" && !Number.isNaN(Date.parse(value)) ? null : `${q} should be a date, like 2026-01-31`;
    case "email":
      return typeof value === "string" && EMAIL_RE.test(value) ? null : `${q} should be an email address`;
    case "url":
      if (typeof value !== "string") return `${q} should be a web link`;
      try {
        new URL(value);
        return null;
      } catch {
        return `${q} should be a web link, like https://example.com`;
      }
    case "choice":
      return field.options?.includes(String(value)) ? null : `${q} should be one of: ${(field.options ?? []).join(", ")}`;
    case "link":
      if (!field.linkTo || !dataset[field.linkTo]) return null;
      return dataset[field.linkTo].some((r) => r.id === String(value)) ? null : `${q} points to a record that doesn't exist`;
    case "json":
      return null;
  }
  return null;
}

export function validateBody(
  model: Model,
  body: unknown,
  mode: "create" | "update",
  dataset: Dataset,
  selfId?: string,
): string[] {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return [`Send the data as an object, like { "name": "..." }`];
  }
  const input = body as Record<string, unknown>;
  const errors: string[] = [];
  const known = new Set(model.fields.map((f) => f.name));
  for (const key of Object.keys(input)) {
    if (key !== "id" && !known.has(key)) errors.push(`'${key}' is not a field on ${model.name}`);
  }
  for (const field of model.fields) {
    const present = field.name in input;
    const value = input[field.name];
    if (isEmpty(value)) {
      if (field.required && (mode === "create" || present)) errors.push(`'${field.name}' is required`);
      continue;
    }
    const err = typeError(field, value, dataset);
    if (err) {
      errors.push(err);
      continue;
    }
    if (field.unique && (dataset[model.id] ?? []).some((r) => r.id !== selfId && r[field.name] === value)) {
      errors.push(`'${field.name}' must be unique. Another record already uses this value`);
    }
  }
  return errors;
}

function pickFields(model: Model, input: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of model.fields) {
    if (f.name in input && !isEmpty(input[f.name])) {
      out[f.name] = f.type === "link" ? String(input[f.name]) : input[f.name];
    }
  }
  return out;
}

export function executeRoute(project: Project, route: Route, req: EngineRequest, dataset: Dataset): EngineResult {
  const model = project.models.find((m) => m.id === route.modelId);
  if (!model || route.action === "custom") {
    return { status: 200, body: { message: "This route has no model action yet. Link it to a model to return data." } };
  }
  const records = (dataset[model.id] ??= []);
  const id = req.params.id;
  const index = records.findIndex((r) => r.id === String(id));
  const notFound: EngineResult = { status: 404, body: { error: `No ${model.name.toLowerCase()} with id ${id}` } };
  const invalid = (details: string[]): EngineResult => ({ status: 400, body: { error: "Validation failed", details } });

  switch (route.action) {
    case "list": {
      const data = records.filter((r) =>
        route.filters.every((name) => !req.query[name] || String(r[name]) === req.query[name]),
      );
      return { status: 200, body: { data, count: data.length } };
    }
    case "get":
      return index < 0 ? notFound : { status: 200, body: records[index] };
    case "create": {
      const errors = validateBody(model, req.body, "create", dataset);
      if (errors.length) return invalid(errors);
      const record: DataRecord = {
        ...Object.fromEntries(model.fields.map((f) => [f.name, null])),
        ...pickFields(model, req.body as Record<string, unknown>),
        id: String(nextId(records)),
      };
      records.push(record);
      return { status: 201, body: record };
    }
    case "update": {
      if (index < 0) return notFound;
      const errors = validateBody(model, req.body, "update", dataset, records[index].id);
      if (errors.length) return invalid(errors);
      records[index] = { ...records[index], ...pickFields(model, req.body as Record<string, unknown>) };
      return { status: 200, body: records[index] };
    }
    case "delete":
      if (index < 0) return notFound;
      records.splice(index, 1);
      return { status: 204, body: null };
    default:
      return { status: 500, body: { error: "Unknown action" } };
  }
}
```

- [ ] **Step 4: Create `src/lib/examples.ts`**

```ts
import { executeRoute, generateRecords, seedDataset, type Dataset, type EngineResult } from "./mock-engine";
import type { Model, Project, Route } from "./types";

const EXAMPLE_SEED = 7;

function bodyFrom(model: Model, dataset: Dataset): Record<string, unknown> {
  const record: Record<string, unknown> = { ...generateRecords(model, 1, dataset)[0] };
  delete record.id;
  return record;
}

function hasBody(route: Route): boolean {
  return route.action === "create" || route.action === "update";
}

export function exampleRequest(route: Route, project: Project): Record<string, unknown> | null {
  const model = project.models.find((m) => m.id === route.modelId);
  if (!model || !hasBody(route)) return null;
  return bodyFrom(model, seedDataset(project, 2, EXAMPLE_SEED));
}

export function exampleResponse(route: Route, project: Project): EngineResult {
  const dataset = seedDataset(project, 2, EXAMPLE_SEED);
  const model = project.models.find((m) => m.id === route.modelId);
  const body = model && hasBody(route) ? bodyFrom(model, dataset) : undefined;
  return executeRoute(project, route, { params: { id: "1" }, query: {}, body }, dataset);
}
```

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `npm test -- src/lib/mock-engine.test.ts`
Expected: PASS. If the "filters" test finds no records, check that the filter compares `String(r[name])` with the query value.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "feat: add mock engine with validation and example generation" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Service layer, stores and hooks

**Files:**
- Create: `src/lib/services/types.ts`, `src/lib/services/index.ts`, `src/lib/services/mock/latency.ts`, `src/lib/services/mock/db.ts`, `src/lib/services/mock/project-service.ts`, `src/lib/services/mock/model-service.ts`, `src/lib/services/mock/route-service.ts`, `src/lib/services/mock/console-service.ts`, `src/store/project-store.ts`, `src/store/ui-store.ts`, `src/store/use-project.ts`
- Test: `src/lib/services/mock/services.test.ts`, `src/store/project-store.test.ts`

**Interfaces:**
- Consumes: Tasks 2–4.
- Produces:
  - `CreateProjectInput { name: string; description: string; templateId: TemplateId | null }`
  - `projectService.{list, get, create, update, remove, restore}`, `modelService.{create, update, remove}`, `routeService.{createMany, update, remove}`, `consoleService.{send, sampleData, reset}` (all exported from `@/lib/services`)
  - `setMockLatency(ms)`, `resetMockDatasets()` (from `@/lib/services/mock/latency` and `/console-service`; tests only)
  - `useProjectStore` with state `{ projects, loaded }` and actions `loadProjects()`, `createProject(input): Promise<Project>`, `updateProject(id, patch)`, `deleteProject(id): Promise<Project /*snapshot*/>`, `restoreProject(project)`, `createModel(projectId, name): Promise<Model>`, `saveModel(projectId, model)`, `deleteModel(projectId, modelId): Promise<Project>`, `addRoutes(projectId, routes)`, `saveRoute(projectId, route)`, `deleteRoute(projectId, routeId): Promise<Project>`
  - `useUiStore` with `{ sidebarCollapsed, commandOpen, progress: Record<projectId, { tested?: boolean; viewedDocs?: boolean }> }` and `toggleSidebar()`, `setCommandOpen(open)`, `markProgress(projectId, "tested" | "viewedDocs")`
  - `useProjects(): { projects, loaded }`, `useProject(id): { project | null, loaded }`, `useCurrentProject(): Project` (reads `projectId` from the URL; only use it under the project layout)

- [ ] **Step 1: Write the failing tests**

`src/lib/services/mock/services.test.ts`:
```ts
import { buildCrudRoutes } from "@/lib/crud";
import { mockConsoleService, resetMockDatasets } from "./console-service";
import { setMockLatency } from "./latency";
import { mockModelService } from "./model-service";
import { mockProjectService } from "./project-service";
import { mockRouteService } from "./route-service";

beforeEach(() => {
  setMockLatency(0);
  resetMockDatasets();
});

const newStore = () => mockProjectService.create({ name: "My Store", description: "", templateId: "store" });

it("creates a project from a template with models but no routes", async () => {
  const p = await newStore();
  expect(p.slug).toBe("my-store");
  expect(p.models.map((m) => m.name)).toEqual(["Product", "Customer", "Order"]);
  expect(p.routes).toEqual([]);
  expect(await mockProjectService.list()).toHaveLength(1);
  expect(localStorage.getItem("universal-api:db:v1")).toContain("My Store");
});

it("rejects a duplicate project name", async () => {
  await newStore();
  await expect(newStore()).rejects.toThrow("You already have an API with this name.");
});

it("removes a model with its routes and clears links to it", async () => {
  const p = await newStore();
  const customer = p.models.find((m) => m.name === "Customer")!;
  await mockRouteService.createMany(p.id, buildCrudRoutes(customer, ["list"], []));
  await mockModelService.remove(p.id, customer.id);
  const after = (await mockProjectService.get(p.id))!;
  expect(after.routes).toEqual([]);
  const order = after.models.find((m) => m.name === "Order")!;
  expect(order.fields.find((f) => f.name === "customer")!.linkTo).toBeUndefined();
});

it("rejects conflicting routes", async () => {
  const p = await newStore();
  const product = p.models[0];
  await mockRouteService.createMany(p.id, buildCrudRoutes(product, ["list"], []));
  const dup = buildCrudRoutes(product, ["list"], []);
  await expect(mockRouteService.createMany(p.id, dup)).rejects.toThrow("Two routes can't share the same method and path.");
});

it("runs requests against sample data", async () => {
  const p = await newStore();
  const product = p.models[0];
  const routes = buildCrudRoutes(product, ["list", "create"], []);
  await mockRouteService.createMany(p.id, routes);
  const [list, create] = routes;
  const bad = await mockConsoleService.send(p.id, { routeId: create.id, params: {}, query: {}, body: { price: 5 } });
  expect(bad.status).toBe(400);
  const ok = await mockConsoleService.send(p.id, { routeId: create.id, params: {}, query: {}, body: { name: "Lamp", price: 25 } });
  expect(ok.status).toBe(201);
  const all = await mockConsoleService.send(p.id, { routeId: list.id, params: {}, query: {}, body: undefined });
  expect((all.body as { data: { name: string }[] }).data.some((r) => r.name === "Lamp")).toBe(true);
  expect(all.durationMs).toBeGreaterThan(0);
  expect(await mockConsoleService.sampleData(p.id, product.id)).toHaveLength(6);
});
```

`src/store/project-store.test.ts`:
```ts
import { setMockLatency } from "@/lib/services/mock/latency";
import { useProjectStore } from "./project-store";

beforeEach(() => {
  setMockLatency(0);
  useProjectStore.setState({ projects: [], loaded: false });
});

it("loads, creates, deletes and restores projects", async () => {
  await useProjectStore.getState().loadProjects();
  expect(useProjectStore.getState().loaded).toBe(true);
  const p = await useProjectStore.getState().createProject({ name: "Blog", description: "", templateId: "blog" });
  expect(useProjectStore.getState().projects).toHaveLength(1);
  const snapshot = await useProjectStore.getState().deleteProject(p.id);
  expect(useProjectStore.getState().projects).toHaveLength(0);
  await useProjectStore.getState().restoreProject(snapshot);
  expect(useProjectStore.getState().projects[0].name).toBe("Blog");
});

it("refreshes the cached project after model changes", async () => {
  const p = await useProjectStore.getState().createProject({ name: "Todo", description: "", templateId: null });
  const model = await useProjectStore.getState().createModel(p.id, "Task");
  expect(useProjectStore.getState().projects[0].models).toEqual([model]);
  await useProjectStore.getState().saveModel(p.id, {
    ...model,
    fields: [{ id: "f1", name: "title", type: "text", required: true, unique: false }],
  });
  expect(useProjectStore.getState().projects[0].models[0].fields).toHaveLength(1);
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `npm test -- src/lib/services src/store`
Expected: FAIL with unresolved imports.

- [ ] **Step 3: Create `src/lib/services/types.ts`**

```ts
import type { Model, Project, Route, TemplateId, TestRequest, TestResponse } from "@/lib/types";

export interface CreateProjectInput {
  name: string;
  description: string;
  templateId: TemplateId | null;
}

export interface ProjectService {
  list(): Promise<Project[]>;
  get(id: string): Promise<Project | null>;
  create(input: CreateProjectInput): Promise<Project>;
  update(id: string, patch: Partial<Pick<Project, "name" | "description" | "slug">>): Promise<Project>;
  remove(id: string): Promise<void>;
  /** Put back a previously deleted or changed project (used by Undo). */
  restore(project: Project): Promise<void>;
}

export interface ModelService {
  create(projectId: string, name: string): Promise<Model>;
  update(projectId: string, model: Model): Promise<Model>;
  remove(projectId: string, modelId: string): Promise<void>;
}

export interface RouteService {
  createMany(projectId: string, routes: Route[]): Promise<Route[]>;
  update(projectId: string, route: Route): Promise<Route>;
  remove(projectId: string, routeId: string): Promise<void>;
}

export interface ConsoleService {
  send(projectId: string, request: TestRequest): Promise<TestResponse>;
  sampleData(projectId: string, modelId: string): Promise<Record<string, unknown>[]>;
  reset(projectId: string): Promise<void>;
}
```

- [ ] **Step 4: Create `src/lib/services/mock/latency.ts`**

```ts
let latencyMs = 200;

export function setMockLatency(ms: number) {
  latencyMs = ms;
}

/** Resolves with a deep copy after the fake network delay, so callers can't mutate stored data. */
export function delay<T>(value: T): Promise<T> {
  const copy = value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
  return new Promise((resolve) => setTimeout(() => resolve(copy), latencyMs));
}
```

- [ ] **Step 5: Create `src/lib/services/mock/db.ts`**

```ts
import type { Project } from "@/lib/types";

const KEY = "universal-api:db:v1";

interface DbShape {
  projects: Project[];
}

export function readDb(): DbShape {
  if (typeof window === "undefined") return { projects: [] };
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as DbShape) : { projects: [] };
  } catch {
    return { projects: [] };
  }
}

export function writeDb(db: DbShape) {
  localStorage.setItem(KEY, JSON.stringify(db));
}

export function findProject(id: string): Project | undefined {
  return readDb().projects.find((p) => p.id === id);
}

export function updateProject(id: string, change: (project: Project) => Project): Project {
  const db = readDb();
  const index = db.projects.findIndex((p) => p.id === id);
  if (index < 0) throw new Error("This API no longer exists.");
  const next = { ...change(db.projects[index]), updatedAt: new Date().toISOString() };
  db.projects[index] = next;
  writeDb(db);
  return next;
}
```

- [ ] **Step 6: Create `src/lib/services/mock/project-service.ts`**

```ts
import { createId } from "@/lib/ids";
import { slugify } from "@/lib/slug";
import { buildTemplateModels } from "@/lib/templates";
import type { Project } from "@/lib/types";
import { validateProjectName, validateSlug } from "@/lib/validation";
import type { ProjectService } from "../types";
import { readDb, updateProject, writeDb } from "./db";
import { delay } from "./latency";

export const mockProjectService: ProjectService = {
  async list() {
    const projects = readDb().projects.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    return delay(projects);
  },

  async get(id) {
    return delay(readDb().projects.find((p) => p.id === id) ?? null);
  },

  async create({ name, description, templateId }) {
    const db = readDb();
    const err = validateProjectName(name, db.projects);
    if (err) throw new Error(err);
    const now = new Date().toISOString();
    const project: Project = {
      id: createId("prj"),
      name: name.trim(),
      slug: slugify(name),
      description: description.trim(),
      models: templateId ? buildTemplateModels(templateId) : [],
      routes: [],
      createdAt: now,
      updatedAt: now,
    };
    db.projects.push(project);
    writeDb(db);
    return delay(project);
  },

  async update(id, patch) {
    const others = readDb().projects;
    const err =
      (patch.name !== undefined ? validateProjectName(patch.name, others, id) : null) ??
      (patch.slug !== undefined ? validateSlug(patch.slug, others, id) : null);
    if (err) throw new Error(err);
    return delay(updateProject(id, (p) => ({ ...p, ...patch })));
  },

  async remove(id) {
    const db = readDb();
    db.projects = db.projects.filter((p) => p.id !== id);
    writeDb(db);
    return delay(undefined);
  },

  async restore(project) {
    const db = readDb();
    db.projects = [...db.projects.filter((p) => p.id !== project.id), project];
    writeDb(db);
    return delay(undefined);
  },
};
```

- [ ] **Step 7: Create `src/lib/services/mock/model-service.ts`**

```ts
import { createId } from "@/lib/ids";
import type { Model } from "@/lib/types";
import { validateFields, validateModelName } from "@/lib/validation";
import type { ModelService } from "../types";
import { updateProject } from "./db";
import { delay } from "./latency";

export const mockModelService: ModelService = {
  async create(projectId, name) {
    let created: Model | undefined;
    updateProject(projectId, (p) => {
      const err = validateModelName(name, p.models);
      if (err) throw new Error(err);
      created = { id: createId("mdl"), name: name.trim(), fields: [] };
      return { ...p, models: [...p.models, created] };
    });
    return delay(created as Model);
  },

  async update(projectId, model) {
    updateProject(projectId, (p) => {
      const err = validateModelName(model.name, p.models, model.id) ?? validateFields(model.fields);
      if (err) throw new Error(err);
      return { ...p, models: p.models.map((m) => (m.id === model.id ? model : m)) };
    });
    return delay(model);
  },

  async remove(projectId, modelId) {
    updateProject(projectId, (p) => ({
      ...p,
      models: p.models
        .filter((m) => m.id !== modelId)
        .map((m) => ({ ...m, fields: m.fields.map((f) => (f.linkTo === modelId ? { ...f, linkTo: undefined } : f)) })),
      routes: p.routes.filter((r) => r.modelId !== modelId),
    }));
    return delay(undefined);
  },
};
```

- [ ] **Step 8: Create `src/lib/services/mock/route-service.ts`**

```ts
import { validateRoute } from "@/lib/validation";
import type { RouteService } from "../types";
import { updateProject } from "./db";
import { delay } from "./latency";

export const mockRouteService: RouteService = {
  async createMany(projectId, routes) {
    updateProject(projectId, (p) => {
      const all = [...p.routes];
      for (const route of routes) {
        const err = validateRoute(route, all);
        if (err) throw new Error(err);
        all.push(route);
      }
      return { ...p, routes: all };
    });
    return delay(routes);
  },

  async update(projectId, route) {
    updateProject(projectId, (p) => {
      const err = validateRoute(route, p.routes);
      if (err) throw new Error(err);
      return { ...p, routes: p.routes.map((r) => (r.id === route.id ? route : r)) };
    });
    return delay(route);
  },

  async remove(projectId, routeId) {
    updateProject(projectId, (p) => ({ ...p, routes: p.routes.filter((r) => r.id !== routeId) }));
    return delay(undefined);
  },
};
```

- [ ] **Step 9: Create `src/lib/services/mock/console-service.ts`**

```ts
import { ensureDataset, executeRoute, seedDataset, type Dataset, type EngineResult } from "@/lib/mock-engine";
import type { Project } from "@/lib/types";
import type { ConsoleService } from "../types";
import { findProject } from "./db";
import { delay } from "./latency";

const datasets = new Map<string, Dataset>();

export function resetMockDatasets() {
  datasets.clear();
}

function datasetFor(project: Project): Dataset {
  const existing = datasets.get(project.id);
  if (existing) return ensureDataset(project, existing);
  const fresh = seedDataset(project);
  datasets.set(project.id, fresh);
  return fresh;
}

export const mockConsoleService: ConsoleService = {
  async send(projectId, request) {
    const started = performance.now();
    const project = findProject(projectId);
    const route = project?.routes.find((r) => r.id === request.routeId);
    const result: EngineResult =
      project && route
        ? executeRoute(project, route, request, datasetFor(project))
        : { status: 404, body: { error: "This route no longer exists." } };
    const settled = await delay(result);
    return { ...settled, durationMs: Math.max(1, Math.round(performance.now() - started)) };
  },

  async sampleData(projectId, modelId) {
    const project = findProject(projectId);
    return delay(project ? (datasetFor(project)[modelId] ?? []) : []);
  },

  async reset(projectId) {
    datasets.delete(projectId);
    return delay(undefined);
  },
};
```

- [ ] **Step 10: Create `src/lib/services/index.ts`**

```ts
// The one place to swap mock services for HTTP ones when the Express backend exists.
import { mockConsoleService } from "./mock/console-service";
import { mockModelService } from "./mock/model-service";
import { mockProjectService } from "./mock/project-service";
import { mockRouteService } from "./mock/route-service";
import type { ConsoleService, ModelService, ProjectService, RouteService } from "./types";

export type { CreateProjectInput } from "./types";

export const projectService: ProjectService = mockProjectService;
export const modelService: ModelService = mockModelService;
export const routeService: RouteService = mockRouteService;
export const consoleService: ConsoleService = mockConsoleService;
```

- [ ] **Step 11: Create `src/store/project-store.ts`**

```ts
import { create } from "zustand";
import { modelService, projectService, routeService, type CreateProjectInput } from "@/lib/services";
import type { Model, Project, Route } from "@/lib/types";

interface ProjectState {
  projects: Project[];
  loaded: boolean;
  loadProjects(): Promise<void>;
  createProject(input: CreateProjectInput): Promise<Project>;
  updateProject(id: string, patch: Partial<Pick<Project, "name" | "description" | "slug">>): Promise<void>;
  deleteProject(id: string): Promise<Project>;
  restoreProject(project: Project): Promise<void>;
  createModel(projectId: string, name: string): Promise<Model>;
  saveModel(projectId: string, model: Model): Promise<void>;
  deleteModel(projectId: string, modelId: string): Promise<Project>;
  addRoutes(projectId: string, routes: Route[]): Promise<void>;
  saveRoute(projectId: string, route: Route): Promise<void>;
  deleteRoute(projectId: string, routeId: string): Promise<Project>;
}

export const useProjectStore = create<ProjectState>()((set, get) => {
  const replace = (project: Project) =>
    set((s) => ({
      projects: s.projects.some((p) => p.id === project.id)
        ? s.projects.map((p) => (p.id === project.id ? project : p))
        : [project, ...s.projects],
    }));
  const refresh = async (id: string) => {
    const project = await projectService.get(id);
    if (project) replace(project);
  };
  const snapshot = (id: string): Project => {
    const project = get().projects.find((p) => p.id === id);
    if (!project) throw new Error("Project is not loaded");
    return project;
  };

  return {
    projects: [],
    loaded: false,
    async loadProjects() {
      set({ projects: await projectService.list(), loaded: true });
    },
    async createProject(input) {
      const project = await projectService.create(input);
      replace(project);
      return project;
    },
    async updateProject(id, patch) {
      replace(await projectService.update(id, patch));
    },
    async deleteProject(id) {
      const previous = snapshot(id);
      await projectService.remove(id);
      set((s) => ({ projects: s.projects.filter((p) => p.id !== id) }));
      return previous;
    },
    async restoreProject(project) {
      await projectService.restore(project);
      replace(project);
    },
    async createModel(projectId, name) {
      const model = await modelService.create(projectId, name);
      await refresh(projectId);
      return model;
    },
    async saveModel(projectId, model) {
      await modelService.update(projectId, model);
      await refresh(projectId);
    },
    async deleteModel(projectId, modelId) {
      const previous = snapshot(projectId);
      await modelService.remove(projectId, modelId);
      await refresh(projectId);
      return previous;
    },
    async addRoutes(projectId, routes) {
      await routeService.createMany(projectId, routes);
      await refresh(projectId);
    },
    async saveRoute(projectId, route) {
      await routeService.update(projectId, route);
      await refresh(projectId);
    },
    async deleteRoute(projectId, routeId) {
      const previous = snapshot(projectId);
      await routeService.remove(projectId, routeId);
      await refresh(projectId);
      return previous;
    },
  };
});
```

- [ ] **Step 12: Create `src/store/ui-store.ts`**

```ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ProgressKey = "tested" | "viewedDocs";
export type ProjectProgress = Partial<Record<ProgressKey, boolean>>;

interface UiState {
  sidebarCollapsed: boolean;
  commandOpen: boolean;
  progress: Record<string, ProjectProgress>;
  toggleSidebar(): void;
  setCommandOpen(open: boolean): void;
  markProgress(projectId: string, key: ProgressKey): void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      commandOpen: false,
      progress: {},
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setCommandOpen: (open) => set({ commandOpen: open }),
      markProgress: (projectId, key) =>
        set((s) =>
          s.progress[projectId]?.[key]
            ? s
            : { progress: { ...s.progress, [projectId]: { ...s.progress[projectId], [key]: true } } },
        ),
    }),
    {
      name: "universal-api:ui:v1",
      partialize: (s) => ({ sidebarCollapsed: s.sidebarCollapsed, progress: s.progress }),
    },
  ),
);
```

- [ ] **Step 13: Create `src/store/use-project.ts`**

```ts
"use client";

import { useParams } from "next/navigation";
import { useEffect } from "react";
import type { Project } from "@/lib/types";
import { useProjectStore } from "./project-store";

export function useProjects() {
  const projects = useProjectStore((s) => s.projects);
  const loaded = useProjectStore((s) => s.loaded);
  const loadProjects = useProjectStore((s) => s.loadProjects);
  useEffect(() => {
    if (!loaded) void loadProjects();
  }, [loaded, loadProjects]);
  return { projects, loaded };
}

export function useProject(projectId: string) {
  const { projects, loaded } = useProjects();
  return { project: projects.find((p) => p.id === projectId) ?? null, loaded };
}

/** For pages under /projects/[projectId]; the project layout guarantees the project is loaded. */
export function useCurrentProject(): Project {
  const { projectId } = useParams<{ projectId: string }>();
  const project = useProjectStore((s) => s.projects.find((p) => p.id === projectId));
  if (!project) throw new Error("useCurrentProject must be used inside a loaded project layout");
  return project;
}
```

- [ ] **Step 14: Run the tests and confirm they pass**

Run: `npm test -- src/lib/services src/store`
Expected: PASS.

- [ ] **Step 15: Commit**

```bash
git add -A
git commit -m "feat: add mock service layer and Zustand stores" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: App shell and shared domain components

**Files:**
- Create: `src/components/domain/{method-badge,help-hint,empty-state,page-header,copy-button,code-block}.tsx`, `src/lib/json-highlight.ts`, `src/components/shell/{logo,user-avatar,nav-items,app-sidebar,project-switcher,top-bar,project-shell,dashboard-header}.tsx` (`nav-items` is a `.ts` file), `src/app/projects/[projectId]/layout.tsx`
- Test: `src/components/shell/app-sidebar.test.tsx`, `src/components/domain/method-badge.test.tsx`, `src/lib/json-highlight.test.ts`

**Interfaces:**
- Consumes: `useProject`, `useUiStore`, `useProjectStore`, `METHOD_META`, `ThemeToggle`.
- Produces:
  - `<MethodBadge method showLabel? tooltip? className? />`
  - `<HelpHint term>{children}</HelpHint>`
  - `<EmptyState icon title description action? />`
  - `<PageHeader title description? actions? />`
  - `<CopyButton text className? />`
  - `<CodeBlock code language?: "json" | "text" className? />`
  - `tokenizeJson(src): Token[]`
  - `PROJECT_NAV`, `navHref(projectId, segment)`, `isNavActive(pathname, projectId, segment)`
  - `<AppSidebar projectId collapsed? onNavigate? />`
  - `<ProjectShell project>{children}</ProjectShell>`
  - `<DashboardHeader />`, `<Logo compact? />`, `<UserAvatar />`

- [ ] **Step 1: Write the failing tests**

`src/lib/json-highlight.test.ts`:
```ts
import { tokenizeJson } from "./json-highlight";

it("tokenizes JSON without losing text", () => {
  const src = '{\n  "a": 1,\n  "b": "x",\n  "c": true,\n  "d": null\n}';
  const tokens = tokenizeJson(src);
  expect(tokens.map((t) => t.text).join("")).toBe(src);
  const kinds = tokens.filter((t) => t.kind !== "punct").map((t) => `${t.kind}:${t.text}`);
  expect(kinds).toEqual(['key:"a"', "number:1", 'key:"b"', 'string:"x"', 'key:"c"', "boolean:true", 'key:"d"', "null:null"]);
});
```

`src/components/domain/method-badge.test.tsx`:
```tsx
import { screen } from "@testing-library/react";
import { renderUi } from "@/test/render";
import { MethodBadge } from "./method-badge";

it("shows the method and optional friendly label", () => {
  renderUi(<MethodBadge method="POST" showLabel />);
  const label = screen.getByText("· Create");
  expect(label.parentElement).toHaveTextContent("POST· Create");
});
```

`src/components/shell/app-sidebar.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { AppSidebar } from "./app-sidebar";

it("links every section and marks the active one", () => {
  vi.mocked(usePathname).mockReturnValue("/projects/p1/models/m1");
  render(<AppSidebar projectId="p1" />);
  expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/projects/p1");
  expect(screen.getByRole("link", { name: "Test" })).toHaveAttribute("href", "/projects/p1/console");
  expect(screen.getByRole("link", { name: "Models" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("link", { name: "Home" })).not.toHaveAttribute("aria-current");
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `npm test -- src/lib/json-highlight.test.ts src/components`
Expected: FAIL with unresolved imports.

- [ ] **Step 3: Create `src/lib/json-highlight.ts`**

```ts
export type TokenKind = "key" | "string" | "number" | "boolean" | "null" | "punct";
export interface Token {
  kind: TokenKind;
  text: string;
}

const TOKEN_RE = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false)\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;

export function tokenizeJson(src: string): Token[] {
  const tokens: Token[] = [];
  let last = 0;
  for (const m of src.matchAll(TOKEN_RE)) {
    const index = m.index ?? 0;
    if (index > last) tokens.push({ kind: "punct", text: src.slice(last, index) });
    if (m[1]) {
      tokens.push({ kind: m[2] ? "key" : "string", text: m[1] });
      if (m[2]) tokens.push({ kind: "punct", text: m[2] });
    } else if (m[3]) {
      tokens.push({ kind: "boolean", text: m[0] });
    } else if (m[0] === "null") {
      tokens.push({ kind: "null", text: m[0] });
    } else {
      tokens.push({ kind: "number", text: m[0] });
    }
    last = index + m[0].length;
  }
  if (last < src.length) tokens.push({ kind: "punct", text: src.slice(last) });
  return tokens;
}
```

- [ ] **Step 4: Create `src/components/domain/method-badge.tsx`**

```tsx
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { METHOD_META } from "@/lib/methods";
import type { HttpMethod } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  method: HttpMethod;
  showLabel?: boolean;
  tooltip?: boolean;
  className?: string;
}

export function MethodBadge({ method, showLabel = false, tooltip = true, className }: Props) {
  const meta = METHOD_META[method];
  const badge = (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 font-mono text-xs font-semibold",
        meta.className,
        className,
      )}
    >
      {method}
      {showLabel && <span className="font-sans font-medium opacity-80">· {meta.label}</span>}
    </span>
  );
  if (!tooltip) return badge;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{badge}</TooltipTrigger>
      <TooltipContent>
        {meta.label}: {meta.hint}
      </TooltipContent>
    </Tooltip>
  );
}
```

- [ ] **Step 5: Create `src/components/domain/help-hint.tsx`**

```tsx
import { Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function HelpHint({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`What is ${term}?`}
          className="inline-flex size-4 items-center justify-center rounded-full text-muted-foreground transition-colors duration-150 hover:text-foreground"
        >
          <Info className="size-3.5" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">{children}</TooltipContent>
    </Tooltip>
  );
}
```

- [ ] **Step 6: Create `src/components/domain/empty-state.tsx`**

```tsx
import type { LucideIcon } from "lucide-react";

interface Props {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon: Icon, title, description, action }: Props) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[10px] border border-dashed bg-surface px-6 py-16 text-center">
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Icon className="size-6" />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}
```

- [ ] **Step 7: Create `src/components/domain/page-header.tsx`**

```tsx
interface Props {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}

export function PageHeader({ title, description, actions }: Props) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
```

- [ ] **Step 8: Create `src/components/domain/copy-button.tsx`**

```tsx
"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CopyButton({ text, className }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  return (
    <Button type="button" variant="ghost" size="icon" onClick={copy} aria-label={copied ? "Copied" : "Copy"} className={cn("size-7", className)}>
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
    </Button>
  );
}
```

- [ ] **Step 9: Create `src/components/domain/code-block.tsx`**

```tsx
import { tokenizeJson, type TokenKind } from "@/lib/json-highlight";
import { cn } from "@/lib/utils";
import { CopyButton } from "./copy-button";

const TOKEN_CLASS: Record<TokenKind, string> = {
  key: "text-primary",
  string: "text-success",
  number: "text-warning",
  boolean: "text-method-patch",
  null: "text-muted-foreground",
  punct: "text-muted-foreground",
};

interface Props {
  code: string;
  language?: "json" | "text";
  className?: string;
}

export function CodeBlock({ code, language = "json", className }: Props) {
  return (
    <div className={cn("relative rounded-[10px] border bg-surface", className)}>
      <CopyButton text={code} className="absolute right-2 top-2" />
      <pre className="max-h-[480px] overflow-auto p-4 pr-12 font-mono text-xs leading-relaxed">
        <code>
          {language === "json"
            ? tokenizeJson(code).map((t, i) => (
                <span key={i} className={TOKEN_CLASS[t.kind]}>
                  {t.text}
                </span>
              ))
            : code}
        </code>
      </pre>
    </div>
  );
}
```

- [ ] **Step 10: Create `src/components/shell/nav-items.ts`**

```ts
import { BookOpen, Database, Home, Play, Route as RouteIcon, Settings, type LucideIcon } from "lucide-react";

export interface NavItem {
  segment: string;
  label: string;
  icon: LucideIcon;
}

export const PROJECT_NAV: NavItem[] = [
  { segment: "", label: "Home", icon: Home },
  { segment: "models", label: "Models", icon: Database },
  { segment: "routes", label: "Routes", icon: RouteIcon },
  { segment: "console", label: "Test", icon: Play },
  { segment: "docs", label: "Docs", icon: BookOpen },
  { segment: "settings", label: "Settings", icon: Settings },
];

export function navHref(projectId: string, segment: string): string {
  return segment ? `/projects/${projectId}/${segment}` : `/projects/${projectId}`;
}

export function isNavActive(pathname: string, projectId: string, segment: string): boolean {
  const href = navHref(projectId, segment);
  return segment ? pathname.startsWith(href) : pathname === href;
}
```

- [ ] **Step 11: Create `src/components/shell/app-sidebar.tsx`**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { PROJECT_NAV, isNavActive, navHref } from "./nav-items";

interface Props {
  projectId: string;
  collapsed?: boolean;
  onNavigate?: () => void;
}

export function AppSidebar({ projectId, collapsed = false, onNavigate }: Props) {
  const pathname = usePathname();
  return (
    <nav aria-label="Project" className="flex flex-col gap-1 p-2">
      {PROJECT_NAV.map(({ segment, label, icon: Icon }) => {
        const active = isNavActive(pathname, projectId, segment);
        return (
          <Link
            key={label}
            href={navHref(projectId, segment)}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            title={collapsed ? label : undefined}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors duration-150 hover:bg-accent hover:text-foreground",
              active && "bg-primary/10 text-foreground",
              collapsed && "justify-center px-2",
            )}
          >
            <Icon className={cn("size-4 shrink-0", active && "text-primary")} />
            <span className={cn(collapsed && "sr-only")}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 12: Create `src/components/shell/logo.tsx` and `user-avatar.tsx`**

```tsx
// logo.tsx
import { Braces } from "lucide-react";
import Link from "next/link";

export function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/projects" className="flex items-center gap-2 font-semibold" aria-label="Universal API home">
      <span className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <Braces className="size-4" />
      </span>
      {!compact && <span>Universal API</span>}
    </Link>
  );
}
```

```tsx
// user-avatar.tsx
export function UserAvatar() {
  return (
    <div
      role="img"
      aria-label="Your account"
      className="flex size-8 items-center justify-center rounded-full border bg-surface-2 text-xs font-semibold"
    >
      You
    </div>
  );
}
```

- [ ] **Step 13: Create `src/components/shell/project-switcher.tsx`**

```tsx
"use client";

import { Check, ChevronsUpDown, LayoutGrid, Plus } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Project } from "@/lib/types";
import { useProjectStore } from "@/store/project-store";

export function ProjectSwitcher({ current }: { current: Project }) {
  const projects = useProjectStore((s) => s.projects);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="gap-2 px-2 font-medium">
          <span className="flex size-6 items-center justify-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
            {current.name.charAt(0).toUpperCase()}
          </span>
          <span className="max-w-40 truncate">{current.name}</span>
          <ChevronsUpDown className="size-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Your APIs</DropdownMenuLabel>
        {projects.map((p) => (
          <DropdownMenuItem key={p.id} asChild>
            <Link href={`/projects/${p.id}`}>
              <span className="truncate">{p.name}</span>
              {p.id === current.id && <Check className="ml-auto size-4" />}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/projects">
            <LayoutGrid className="size-4" /> All APIs
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/projects/new">
            <Plus className="size-4" /> New API
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 14: Create `src/components/shell/top-bar.tsx`**

```tsx
"use client";

import { Menu } from "lucide-react";
import { useState } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import type { Project } from "@/lib/types";
import { AppSidebar } from "./app-sidebar";
import { ProjectSwitcher } from "./project-switcher";
import { UserAvatar } from "./user-avatar";

export function TopBar({ project }: { project: Project }) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur">
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
            <Menu className="size-4" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-64 p-0">
          <SheetTitle className="px-4 pt-4 text-sm">{project.name}</SheetTitle>
          <AppSidebar projectId={project.id} onNavigate={() => setMenuOpen(false)} />
        </SheetContent>
      </Sheet>
      <ProjectSwitcher current={project} />
      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />
        <UserAvatar />
      </div>
    </header>
  );
}
```

- [ ] **Step 15: Create `src/components/shell/project-shell.tsx`**

```tsx
"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Project } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/store/ui-store";
import { AppSidebar } from "./app-sidebar";
import { Logo } from "./logo";
import { TopBar } from "./top-bar";

export function ProjectShell({ project, children }: { project: Project; children: React.ReactNode }) {
  const collapsed = useUiStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);
  return (
    <div className="flex min-h-screen bg-background">
      <aside
        className={cn(
          "sticky top-0 hidden h-screen shrink-0 flex-col border-r bg-surface transition-[width] duration-200 md:flex",
          collapsed ? "w-16" : "w-60",
        )}
      >
        <div className={cn("flex h-14 items-center border-b px-4", collapsed && "justify-center px-2")}>
          <Logo compact={collapsed} />
        </div>
        <div className="flex-1 overflow-y-auto">
          <AppSidebar projectId={project.id} collapsed={collapsed} />
        </div>
        <div className="border-t p-2">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-muted-foreground"
            onClick={toggleSidebar}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen className="size-4" /> : <><PanelLeftClose className="size-4" /> Collapse</>}
          </Button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar project={project} />
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
      </div>
    </div>
  );
}
```

- [ ] **Step 16: Create `src/components/shell/dashboard-header.tsx`**

```tsx
import { ThemeToggle } from "@/components/theme-toggle";
import { Logo } from "./logo";
import { UserAvatar } from "./user-avatar";

export function DashboardHeader() {
  return (
    <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 md:px-8">
        <Logo />
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <UserAvatar />
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 17: Create `src/app/projects/[projectId]/layout.tsx`**

```tsx
"use client";

import { SearchX } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { EmptyState } from "@/components/domain/empty-state";
import { ProjectShell } from "@/components/shell/project-shell";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useProject } from "@/store/use-project";

export default function ProjectLayout({ children }: { children: React.ReactNode }) {
  const { projectId } = useParams<{ projectId: string }>();
  const { project, loaded } = useProject(projectId);

  if (!loaded) {
    return (
      <div className="flex min-h-screen">
        <Skeleton className="hidden h-screen w-60 rounded-none md:block" />
        <div className="flex-1 space-y-4 p-8">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-40 w-full" />
        </div>
      </div>
    );
  }
  if (!project) {
    return (
      <div className="p-8">
        <EmptyState
          icon={SearchX}
          title="API not found"
          description="It may have been deleted."
          action={
            <Button asChild>
              <Link href="/projects">Back to your APIs</Link>
            </Button>
          }
        />
      </div>
    );
  }
  return <ProjectShell project={project}>{children}</ProjectShell>;
}
```

- [ ] **Step 18: Run the tests and confirm they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 19: Lint and commit**

Run: `npm run lint`
Expected: no errors.

```bash
git add -A
git commit -m "feat: add app shell and shared domain components" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Projects dashboard and Create wizard

**Files:**
- Create: `src/components/domain/project-card.tsx`, `src/components/domain/template-card.tsx`, `src/components/dashboard/create-project-wizard.tsx`, `src/app/projects/page.tsx`, `src/app/projects/new/page.tsx`
- Test: `src/components/dashboard/create-project-wizard.test.tsx`, `src/components/domain/project-card.test.tsx`

**Interfaces:**
- Consumes: `useProjects`, `useProjectStore.createProject`, `TEMPLATES`, `templateModelNames`, `validateProjectName`, `slugify`, `baseUrl`, `timeAgo`, `countLabel`, `DashboardHeader`, `EmptyState`, `PageHeader`.
- Produces:
  - `<ProjectCard project />`
  - `<TemplateCard emoji name description selected? onSelect />`
  - `<CreateProjectWizard existingProjects initialTemplate onCreate(input: CreateProjectInput): Promise<void> />`

- [ ] **Step 1: Write the failing tests**

`src/components/domain/project-card.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import type { Project } from "@/lib/types";
import { ProjectCard } from "./project-card";

it("summarises a project", () => {
  const project: Project = {
    id: "p1", name: "My Store", slug: "my-store", description: "Sells lamps",
    models: [{ id: "m", name: "Product", fields: [] }], routes: [],
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  };
  render(<ProjectCard project={project} />);
  expect(screen.getByRole("link")).toHaveAttribute("href", "/projects/p1");
  expect(screen.getByText("/api/my-store")).toBeInTheDocument();
  expect(screen.getByText("1 model · 0 routes")).toBeInTheDocument();
});
```

`src/components/dashboard/create-project-wizard.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateProjectWizard } from "./create-project-wizard";

it("walks through the three steps and creates the API", async () => {
  const user = userEvent.setup();
  const onCreate = vi.fn().mockResolvedValue(undefined);
  render(<CreateProjectWizard existingProjects={[]} initialTemplate={null} onCreate={onCreate} />);

  expect(screen.getByText("Step 1 of 3")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Next" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Give your API a name.");

  await user.type(screen.getByLabelText("API name"), "My Store");
  expect(screen.getByText("/api/my-store")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Next" }));

  await user.click(screen.getByRole("button", { name: /Products, customers and orders/ }));
  await user.click(screen.getByRole("button", { name: "Next" }));

  expect(screen.getByText("Product, Customer, Order")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Create API" }));
  expect(onCreate).toHaveBeenCalledWith({ name: "My Store", description: "", templateId: "store" });
});

it("lets you go back", async () => {
  const user = userEvent.setup();
  render(<CreateProjectWizard existingProjects={[]} initialTemplate="todo" onCreate={vi.fn()} />);
  await user.type(screen.getByLabelText("API name"), "Tasks");
  await user.click(screen.getByRole("button", { name: "Next" }));
  expect(screen.getByRole("button", { name: /Tasks with due dates/ })).toHaveAttribute("aria-pressed", "true");
  await user.click(screen.getByRole("button", { name: "Back" }));
  expect(screen.getByLabelText("API name")).toHaveValue("Tasks");
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `npm test -- src/components/dashboard src/components/domain/project-card.test.tsx`
Expected: FAIL with unresolved imports.

- [ ] **Step 3: Create `src/components/domain/project-card.tsx`**

```tsx
import Link from "next/link";
import { countLabel, timeAgo } from "@/lib/format";
import { baseUrl } from "@/lib/slug";
import type { Project } from "@/lib/types";

export function ProjectCard({ project }: { project: Project }) {
  return (
    <Link
      href={`/projects/${project.id}`}
      className="flex flex-col rounded-[10px] border bg-surface-2 p-5 transition-colors duration-150 hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-ring"
    >
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/15 font-semibold text-primary">
          {project.name.charAt(0).toUpperCase()}
        </span>
        <div className="min-w-0">
          <h3 className="truncate font-semibold">{project.name}</h3>
          <code className="block truncate font-mono text-xs text-muted-foreground">{baseUrl(project.slug)}</code>
        </div>
      </div>
      {project.description && <p className="mt-3 line-clamp-2 text-sm text-muted-foreground">{project.description}</p>}
      <div className="mt-auto flex items-center justify-between gap-2 pt-4 text-xs text-muted-foreground">
        <span>
          {countLabel(project.models.length, "model")} · {countLabel(project.routes.length, "route")}
        </span>
        <span>Edited {timeAgo(project.updatedAt)}</span>
      </div>
    </Link>
  );
}
```

- [ ] **Step 4: Create `src/components/domain/template-card.tsx`**

```tsx
import { cn } from "@/lib/utils";

interface Props {
  emoji: string;
  name: string;
  description: string;
  selected?: boolean;
  onSelect: () => void;
}

export function TemplateCard({ emoji, name, description, selected = false, onSelect }: Props) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex w-full flex-col items-start gap-1 rounded-[10px] border bg-surface-2 p-4 text-left transition-colors duration-150 hover:border-primary/50",
        selected && "border-primary bg-primary/10",
      )}
    >
      <span className="text-2xl" aria-hidden>
        {emoji}
      </span>
      <span className="font-medium">{name}</span>
      <span className="text-sm text-muted-foreground">{description}</span>
    </button>
  );
}
```

- [ ] **Step 5: Create `src/components/dashboard/create-project-wizard.tsx`**

```tsx
"use client";

import { useState } from "react";
import { TemplateCard } from "@/components/domain/template-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import type { CreateProjectInput } from "@/lib/services";
import { baseUrl, slugify } from "@/lib/slug";
import { TEMPLATES, templateModelNames } from "@/lib/templates";
import type { Project, TemplateId } from "@/lib/types";
import { validateProjectName } from "@/lib/validation";

const STEPS = ["Name your API", "Choose a starting point", "Review"];

interface Props {
  existingProjects: Project[];
  initialTemplate: TemplateId | null;
  onCreate: (input: CreateProjectInput) => Promise<void>;
}

export function CreateProjectWizard({ existingProjects, initialTemplate, onCreate }: Props) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [templateId, setTemplateId] = useState<TemplateId | null>(initialTemplate);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const template = TEMPLATES.find((t) => t.id === templateId);

  function next() {
    if (step === 0) {
      const err = validateProjectName(name, existingProjects);
      setError(err);
      if (err) return;
    }
    setStep((s) => s + 1);
  }

  async function create() {
    setSubmitting(true);
    try {
      await onCreate({ name, description, templateId });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <Card className="mx-auto max-w-2xl">
      <CardHeader>
        <p className="text-sm text-muted-foreground">Step {step + 1} of 3</p>
        <CardTitle className="text-2xl">{STEPS[step]}</CardTitle>
        <Progress value={((step + 1) / 3) * 100} aria-label="Wizard progress" className="mt-2" />
      </CardHeader>
      <CardContent className="space-y-6">
        {step === 0 && (
          <>
            <div className="space-y-2">
              <Label htmlFor="api-name">API name</Label>
              <Input
                id="api-name"
                autoFocus
                value={name}
                placeholder="My Store"
                aria-invalid={!!error}
                aria-describedby="api-name-help"
                onChange={(e) => {
                  setName(e.target.value);
                  setError(null);
                }}
              />
              <p id="api-name-help" className="text-sm text-muted-foreground">
                Your API will live at <code className="font-mono text-foreground">{baseUrl(slugify(name) || "your-api")}</code>
              </p>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="api-description">
                Description <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="api-description"
                value={description}
                maxLength={200}
                placeholder="What is this API for?"
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </>
        )}

        {step === 1 && (
          <div className="grid gap-3 sm:grid-cols-2">
            <TemplateCard
              emoji="⬜"
              name="Start blank"
              description="Add your own models from scratch"
              selected={templateId === null}
              onSelect={() => setTemplateId(null)}
            />
            {TEMPLATES.map((t) => (
              <TemplateCard
                key={t.id}
                emoji={t.emoji}
                name={t.name}
                description={t.description}
                selected={templateId === t.id}
                onSelect={() => setTemplateId(t.id)}
              />
            ))}
          </div>
        )}

        {step === 2 && (
          <dl className="grid gap-4 rounded-[10px] border bg-surface p-4 text-sm sm:grid-cols-[160px_1fr]">
            <dt className="text-muted-foreground">Name</dt>
            <dd className="font-medium">{name.trim()}</dd>
            <dt className="text-muted-foreground">Address</dt>
            <dd>
              <code className="font-mono">{baseUrl(slugify(name))}</code>
            </dd>
            <dt className="text-muted-foreground">Starting point</dt>
            <dd>{template ? `${template.emoji} ${template.name}` : "Blank"}</dd>
            <dt className="text-muted-foreground">Models</dt>
            <dd>{template ? templateModelNames(template.id).join(", ") : "None yet. You'll add them next."}</dd>
          </dl>
        )}

        {step === 2 && error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex justify-between gap-2">
          <Button variant="outline" onClick={() => setStep((s) => s - 1)} disabled={step === 0 || submitting}>
            Back
          </Button>
          {step < 2 ? (
            <Button onClick={next}>Next</Button>
          ) : (
            <Button onClick={create} disabled={submitting}>
              {submitting ? "Creating…" : "Create API"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `npm test -- src/components/dashboard src/components/domain/project-card.test.tsx`
Expected: PASS.

- [ ] **Step 7: Create `src/app/projects/page.tsx`**

```tsx
"use client";

import { Plus, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/domain/empty-state";
import { PageHeader } from "@/components/domain/page-header";
import { ProjectCard } from "@/components/domain/project-card";
import { TemplateCard } from "@/components/domain/template-card";
import { DashboardHeader } from "@/components/shell/dashboard-header";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TEMPLATES } from "@/lib/templates";
import { useProjects } from "@/store/use-project";

export default function ProjectsPage() {
  const { projects, loaded } = useProjects();
  const router = useRouter();

  return (
    <div className="min-h-screen">
      <DashboardHeader />
      <main className="mx-auto max-w-6xl px-4 py-8 md:px-8">
        <PageHeader
          title="Your APIs"
          description="Each API has its own models, routes and docs."
          actions={
            projects.length > 0 && (
              <Button asChild>
                <Link href="/projects/new">
                  <Plus className="size-4" /> New API
                </Link>
              </Button>
            )
          }
        />
        {!loaded ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-40 rounded-[10px]" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="space-y-8">
            <EmptyState
              icon={Sparkles}
              title="Create your first API"
              description={"Describe the things you want to store, and we'll build the endpoints for you."}
              action={
                <Button size="lg" asChild>
                  <Link href="/projects/new">Create your first API</Link>
                </Button>
              }
            />
            <section>
              <h2 className="mb-3 text-sm font-medium text-muted-foreground">Or start from a template</h2>
              <div className="grid gap-4 sm:grid-cols-3">
                {TEMPLATES.map((t) => (
                  <TemplateCard
                    key={t.id}
                    emoji={t.emoji}
                    name={t.name}
                    description={t.description}
                    onSelect={() => router.push(`/projects/new?template=${t.id}`)}
                  />
                ))}
              </div>
            </section>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((p) => (
              <ProjectCard key={p.id} project={p} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 8: Create `src/app/projects/new/page.tsx`**

```tsx
"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { toast } from "sonner";
import { CreateProjectWizard } from "@/components/dashboard/create-project-wizard";
import { DashboardHeader } from "@/components/shell/dashboard-header";
import { TEMPLATES } from "@/lib/templates";
import type { TemplateId } from "@/lib/types";
import { useProjectStore } from "@/store/project-store";
import { useProjects } from "@/store/use-project";

function NewProject() {
  const params = useSearchParams();
  const requested = params.get("template");
  const initialTemplate = TEMPLATES.some((t) => t.id === requested) ? (requested as TemplateId) : null;
  const { projects } = useProjects();
  const createProject = useProjectStore((s) => s.createProject);
  const router = useRouter();

  return (
    <div className="min-h-screen">
      <DashboardHeader />
      <main className="px-4 py-10">
        <CreateProjectWizard
          existingProjects={projects}
          initialTemplate={initialTemplate}
          onCreate={async (input) => {
            const project = await createProject(input);
            toast.success(`${project.name} is ready`);
            router.push(`/projects/${project.id}`);
          }}
        />
      </main>
    </div>
  );
}

export default function NewProjectPage() {
  return (
    <Suspense>
      <NewProject />
    </Suspense>
  );
}
```

- [ ] **Step 9: Check it in the browser**

Run: `npm run dev` and open http://localhost:3000.
Expected: you land on `/projects`, which shows the empty state and 3 template cards. Clicking "Store" opens the wizard with Store preselected on step 2. Finishing it redirects to `/projects/<id>`, which shows the shell but a 404 body (the home page arrives in Task 12). Back on `/projects`, a card shows "3 models · 0 routes".

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: add projects dashboard and create wizard" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Models — spreadsheet field editor, type picker, sample data

**Files:**
- Create: `src/components/models/{field-type-picker,field-row,model-field-table,model-list,new-model-dialog,sample-data-table,model-editor}.tsx`, `src/app/projects/[projectId]/models/layout.tsx`, `src/app/projects/[projectId]/models/page.tsx`, `src/app/projects/[projectId]/models/[modelId]/page.tsx`
- Test: `src/components/models/field-type-picker.test.tsx`, `src/components/models/model-field-table.test.tsx`

**Interfaces:**
- Consumes: `FIELD_TYPES`, `fieldTypeMeta`, `fieldErrors`, `validateModelName`, `newField`, `moveItem`, `consoleService.sampleData`, `formatCell`, `useProjectStore.{createModel, saveModel, deleteModel, restoreProject}`, `useCurrentProject`.
- Produces:
  - `<FieldTypePicker value onChange />`
  - `<ModelFieldTable model models onSave(model) />`
  - `<ModelEditor project model />` (Task 9 adds `CrudBanner` into it)
  - `<NewModelDialog project open onOpenChange />`

- [ ] **Step 1: Write the failing tests**

`src/components/models/field-type-picker.test.tsx`:
```tsx
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderUi } from "@/test/render";
import { FieldTypePicker } from "./field-type-picker";

it("picks a type from the popover", async () => {
  const user = userEvent.setup();
  const onChange = vi.fn();
  renderUi(<FieldTypePicker value="text" onChange={onChange} />);
  await user.click(screen.getByRole("button", { name: "Field type: Text" }));
  await user.click(screen.getByRole("button", { name: /Prices, counts, ages/ }));
  expect(onChange).toHaveBeenCalledWith("number");
});
```

`src/components/models/model-field-table.test.tsx`:
```tsx
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Model } from "@/lib/types";
import { renderUi } from "@/test/render";
import { ModelFieldTable } from "./model-field-table";

const model: Model = {
  id: "m1",
  name: "Product",
  fields: [{ id: "f1", name: "name", type: "text", required: true, unique: false }],
};

it("adds a field, blocks duplicates, then saves", async () => {
  const user = userEvent.setup();
  const onSave = vi.fn().mockResolvedValue(undefined);
  renderUi(<ModelFieldTable model={model} models={[model]} onSave={onSave} />);

  await user.click(screen.getByRole("button", { name: "Add field" }));
  const second = screen.getAllByLabelText("Field name")[1];
  await user.type(second, "name");
  await user.click(screen.getByRole("button", { name: "Save fields" }));
  expect(screen.getAllByRole("alert")[0]).toHaveTextContent("This model already has a field with that name.");
  expect(onSave).not.toHaveBeenCalled();

  await user.clear(second);
  await user.type(second, "price");
  await user.click(screen.getByRole("checkbox", { name: "price is required" }));
  await user.click(screen.getByRole("button", { name: "Save fields" }));
  expect(onSave).toHaveBeenCalledTimes(1);
  const saved = onSave.mock.calls[0][0] as Model;
  expect(saved.fields.map((f) => [f.name, f.required])).toEqual([["name", true], ["price", true]]);
});

it("reorders with the keyboard", async () => {
  const user = userEvent.setup();
  const two: Model = { ...model, fields: [...model.fields, { id: "f2", name: "price", type: "number", required: false, unique: false }] };
  renderUi(<ModelFieldTable model={two} models={[two]} onSave={vi.fn()} />);
  screen.getByRole("button", { name: /Reorder price/ }).focus();
  await user.keyboard("{ArrowUp}");
  expect(screen.getAllByLabelText("Field name")[0]).toHaveValue("price");
  expect(screen.getByText("You have unsaved changes")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `npm test -- src/components/models`
Expected: FAIL with unresolved imports.

- [ ] **Step 3: Create `src/components/models/field-type-picker.tsx`**

```tsx
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
```

- [ ] **Step 4: Create `src/components/models/field-row.tsx`**

```tsx
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
  return <span className="text-xs text-muted-foreground">{fieldTypeMeta(field.type).description}</span>;
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
          className="cursor-grab rounded p-1 text-muted-foreground hover:text-foreground"
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
          <p role="alert" className="mt-1 text-xs text-destructive">
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
```

- [ ] **Step 5: Create `src/components/models/model-field-table.tsx`**

```tsx
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
      <div className="overflow-x-auto rounded-[10px] border">
        <Table>
          <TableHeader>
            <TableRow className="bg-surface">
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
            <TableRow>
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
```

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `npm test -- src/components/models`
Expected: PASS.

- [ ] **Step 7: Create `src/components/models/new-model-dialog.tsx`**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Project } from "@/lib/types";
import { validateModelName } from "@/lib/validation";
import { useProjectStore } from "@/store/project-store";

interface Props {
  project: Project;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewModelDialog({ project, open, onOpenChange }: Props) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const createModel = useProjectStore((s) => s.createModel);
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const err = validateModelName(name, project.models);
    setError(err);
    if (err) return;
    setSaving(true);
    try {
      const model = await createModel(project.id, name);
      onOpenChange(false);
      setName("");
      router.push(`/projects/${project.id}/models/${model.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the model.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>New model</DialogTitle>
            <DialogDescription>{'Name the kind of thing you want to store. Use a singular word, like "Customer".'}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="model-name">Model name</Label>
            <Input
              id="model-name"
              autoFocus
              value={name}
              placeholder="Customer"
              aria-invalid={!!error}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
              }}
            />
            {error && (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="submit" disabled={saving}>
              {saving ? "Creating…" : "Create model"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 8: Create `src/components/models/model-list.tsx`**

```tsx
"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { HelpHint } from "@/components/domain/help-hint";
import { Button } from "@/components/ui/button";
import { countLabel } from "@/lib/format";
import type { Project } from "@/lib/types";
import { cn } from "@/lib/utils";
import { NewModelDialog } from "./new-model-dialog";

export function ModelList({ project }: { project: Project }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  return (
    <aside className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          Models
          <HelpHint term="a model">
            A model is like a spreadsheet tab: it describes one kind of thing your API stores, such as Customers or Orders.
          </HelpHint>
        </h2>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
          <Plus className="size-4" /> New
        </Button>
      </div>
      <nav aria-label="Models" className="flex flex-col gap-1">
        {project.models.map((m) => {
          const href = `/projects/${project.id}/models/${m.id}`;
          const active = pathname === href;
          return (
            <Link
              key={m.id}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm transition-colors duration-150 hover:bg-accent",
                active && "bg-primary/10 font-medium",
              )}
            >
              <span className="truncate">{m.name}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{countLabel(m.fields.length, "field")}</span>
            </Link>
          );
        })}
        {project.models.length === 0 && <p className="px-3 text-sm text-muted-foreground">No models yet.</p>}
      </nav>
      <NewModelDialog project={project} open={open} onOpenChange={setOpen} />
    </aside>
  );
}
```

- [ ] **Step 9: Create `src/components/models/sample-data-table.tsx`**

```tsx
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
      <p className="text-sm text-muted-foreground">
        This is example data, generated to match your fields. Use the Test console to add or change records.
      </p>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No sample records yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-[10px] border">
          <Table>
            <TableHeader>
              <TableRow className="bg-surface">
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
```

- [ ] **Step 10: Create `src/components/models/model-editor.tsx`**

```tsx
"use client";

import { MoreHorizontal, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PageHeader } from "@/components/domain/page-header";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Model, Project } from "@/lib/types";
import { useProjectStore } from "@/store/project-store";
import { ModelFieldTable } from "./model-field-table";
import { SampleDataTable } from "./sample-data-table";

export function ModelEditor({ project, model }: { project: Project; model: Model }) {
  const saveModel = useProjectStore((s) => s.saveModel);
  const deleteModel = useProjectStore((s) => s.deleteModel);
  const restoreProject = useProjectStore((s) => s.restoreProject);
  const router = useRouter();

  async function handleSave(next: Model) {
    try {
      await saveModel(project.id, next);
      toast.success(`${next.name} saved`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save the model.");
    }
  }

  async function handleDelete() {
    const snapshot = await deleteModel(project.id, model.id);
    router.push(`/projects/${project.id}/models`);
    toast(`${model.name} deleted`, {
      action: { label: "Undo", onClick: () => void restoreProject(snapshot) },
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={model.name}
        description={`Describe the fields every ${model.name.toLowerCase()} has. Think of them as columns in a spreadsheet.`}
        actions={
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Model actions">
                <MoreHorizontal className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem className="text-destructive" onSelect={handleDelete}>
                <Trash2 className="size-4" /> Delete model
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        }
      />
      <Tabs defaultValue="fields">
        <TabsList>
          <TabsTrigger value="fields">Fields</TabsTrigger>
          <TabsTrigger value="sample">Sample data</TabsTrigger>
        </TabsList>
        <TabsContent value="fields" className="mt-4">
          <ModelFieldTable key={JSON.stringify(model.fields)} model={model} models={project.models} onSave={handleSave} />
        </TabsContent>
        <TabsContent value="sample" className="mt-4">
          <SampleDataTable projectId={project.id} model={model} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
```

- [ ] **Step 11: Create the model pages**

`src/app/projects/[projectId]/models/layout.tsx`:
```tsx
"use client";

import { ModelList } from "@/components/models/model-list";
import { useCurrentProject } from "@/store/use-project";

export default function ModelsLayout({ children }: { children: React.ReactNode }) {
  const project = useCurrentProject();
  return (
    <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
      <ModelList project={project} />
      <div className="min-w-0">{children}</div>
    </div>
  );
}
```

`src/app/projects/[projectId]/models/page.tsx`:
```tsx
"use client";

import { Database } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/domain/empty-state";
import { NewModelDialog } from "@/components/models/new-model-dialog";
import { Button } from "@/components/ui/button";
import { useCurrentProject } from "@/store/use-project";

export default function ModelsPage() {
  const project = useCurrentProject();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const first = project.models[0];

  useEffect(() => {
    if (first) router.replace(`/projects/${project.id}/models/${first.id}`);
  }, [first, project.id, router]);

  if (first) return null;
  return (
    <>
      <EmptyState
        icon={Database}
        title="Create your first model"
        description="A model describes one kind of thing your API stores, like Customers or Orders."
        action={<Button onClick={() => setOpen(true)}>Create a model</Button>}
      />
      <NewModelDialog project={project} open={open} onOpenChange={setOpen} />
    </>
  );
}
```

`src/app/projects/[projectId]/models/[modelId]/page.tsx`:
```tsx
"use client";

import { SearchX } from "lucide-react";
import { useParams } from "next/navigation";
import { EmptyState } from "@/components/domain/empty-state";
import { ModelEditor } from "@/components/models/model-editor";
import { useCurrentProject } from "@/store/use-project";

export default function ModelPage() {
  const project = useCurrentProject();
  const { modelId } = useParams<{ modelId: string }>();
  const model = project.models.find((m) => m.id === modelId);
  if (!model) return <EmptyState icon={SearchX} title="Model not found" description="It may have been deleted." />;
  return <ModelEditor key={model.id} project={project} model={model} />;
}
```

- [ ] **Step 12: Check it in the browser**

Run: `npm run dev`. Open a Store project, then go to Models.
Expected: it redirects to Product, whose field table shows 4 fields. Changing a type, adding a "color" field and saving shows a toast, and the field count in the list updates. Sample data shows 5 rows. Deleting a model and clicking Undo in the toast brings it back. Keyboard: Tab reaches the grip, and ArrowUp/Down reorders.

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "feat: add spreadsheet-style model editor with sample data" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Auto CRUD, routes list and route editor

**Files:**
- Create: `src/components/routes/{crud-generator-dialog,crud-banner,route-row,path-preview,route-editor}.tsx`, `src/app/projects/[projectId]/routes/page.tsx`, `src/app/projects/[projectId]/routes/[routeId]/page.tsx`
- Modify: `src/components/models/model-editor.tsx` (render `CrudBanner`)
- Test: `src/components/routes/crud-generator-dialog.test.tsx`, `src/components/routes/route-editor.test.tsx`

**Interfaces:**
- Consumes: `crudOptions`, `buildCrudRoutes`, `CrudAction`, `groupRoutes`, `missingCrud`, `uniquePath`, `validateRoute`, `exampleResponse`, `ACTIONS`, `ACTION_META`, `METHODS`, `METHOD_META`, `CodeBlock`, `MethodBadge`, `HelpHint`, and the store actions `addRoutes`, `saveRoute`, `deleteRoute`, `restoreProject`.
- Produces:
  - `<CrudGeneratorDialog project model open onOpenChange onGenerate(routes) />` (mount only while open, so its selection resets)
  - `<CrudBanner project model />`
  - `<RouteRow route base href onDelete />`
  - `<PathPreview base path />`
  - `<RouteEditor project route onSave(route) />`

- [ ] **Step 1: Write the failing tests**

`src/components/routes/crud-generator-dialog.test.tsx`:
```tsx
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildCrudRoutes } from "@/lib/crud";
import type { Model, Project, Route } from "@/lib/types";
import { renderUi } from "@/test/render";
import { CrudGeneratorDialog } from "./crud-generator-dialog";

const product: Model = { id: "m1", name: "Product", fields: [] };
const project: Project = {
  id: "p1", name: "Store", slug: "store", description: "", models: [product],
  routes: buildCrudRoutes(product, ["list"], []), createdAt: "", updatedAt: "",
};

it("disables existing endpoints and creates the selected ones", async () => {
  const user = userEvent.setup();
  const onGenerate = vi.fn().mockResolvedValue(undefined);
  renderUi(<CrudGeneratorDialog project={project} model={product} open onOpenChange={vi.fn()} onGenerate={onGenerate} />);

  expect(screen.getByRole("checkbox", { name: /List all products/ })).toBeDisabled();
  expect(screen.getAllByText("/api/store/products/:id", { selector: "code" })).toHaveLength(3);
  await user.click(screen.getByRole("checkbox", { name: /Delete a product/ }));
  await user.click(screen.getByRole("button", { name: "Create 3 endpoints" }));

  const routes = onGenerate.mock.calls[0][0] as Route[];
  expect(routes.map((r) => r.action)).toEqual(["get", "create", "update"]);
});
```

`src/components/routes/route-editor.test.tsx`:
```tsx
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Project, Route } from "@/lib/types";
import { renderUi } from "@/test/render";
import { RouteEditor } from "./route-editor";

const list: Route = { id: "r1", method: "GET", path: "/products", modelId: null, action: "custom", description: "List", filters: [] };
const hello: Route = { id: "r2", method: "GET", path: "/hello", modelId: null, action: "custom", description: "Hello", filters: [] };
const project: Project = {
  id: "p1", name: "Store", slug: "store", description: "", models: [], routes: [list, hello], createdAt: "", updatedAt: "",
};

it("blocks a method + path conflict, then saves a valid path", async () => {
  const user = userEvent.setup();
  const onSave = vi.fn().mockResolvedValue(undefined);
  renderUi(<RouteEditor project={project} route={hello} onSave={onSave} />);

  const path = screen.getByLabelText("Path");
  await user.clear(path);
  await user.type(path, "/products");
  await user.click(screen.getByRole("button", { name: "Save route" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Two routes can't share the same method and path.");
  expect(onSave).not.toHaveBeenCalled();

  await user.clear(path);
  await user.type(path, "/hello-world");
  await user.click(screen.getByRole("button", { name: "Save route" }));
  expect(onSave).toHaveBeenCalledWith({ ...hello, path: "/hello-world" });
});

it("previews the response", () => {
  renderUi(<RouteEditor project={project} route={hello} onSave={vi.fn()} />);
  expect(screen.getByText(/This route has no model action yet/)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `npm test -- src/components/routes`
Expected: FAIL with unresolved imports.

- [ ] **Step 3: Create `src/components/routes/crud-generator-dialog.tsx`**

```tsx
"use client";

import { useState } from "react";
import { MethodBadge } from "@/components/domain/method-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { buildCrudRoutes, crudOptions, type CrudAction, type CrudOption } from "@/lib/crud";
import { countLabel } from "@/lib/format";
import { baseUrl, pluralize } from "@/lib/slug";
import type { Model, Project, Route } from "@/lib/types";

interface Props {
  project: Project;
  model: Model;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerate: (routes: Route[]) => Promise<void> | void;
}

export function CrudGeneratorDialog({ project, model, open, onOpenChange, onGenerate }: Props) {
  const options = crudOptions(model);
  const exists = (o: CrudOption) => project.routes.some((r) => r.method === o.method && r.path === o.path);
  const [selected, setSelected] = useState<CrudAction[]>(() => options.filter((o) => !exists(o)).map((o) => o.action));
  const [saving, setSaving] = useState(false);

  const toggle = (action: CrudAction, on: boolean) =>
    setSelected((s) => (on ? [...s, action] : s.filter((a) => a !== action)));

  async function generate() {
    setSaving(true);
    try {
      await onGenerate(buildCrudRoutes(model, selected, project.routes));
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Create endpoints for {model.name}</DialogTitle>
          <DialogDescription>
            Pick the actions people can take on {pluralize(model.name)}. You can change or delete them later.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-2">
          {options.map((o) => {
            const already = exists(o);
            const id = `crud-${o.action}`;
            return (
              <li key={o.action} className="flex items-start gap-3 rounded-md border p-3">
                <Checkbox
                  id={id}
                  className="mt-0.5"
                  checked={already || selected.includes(o.action)}
                  disabled={already}
                  onCheckedChange={(v) => toggle(o.action, v === true)}
                />
                <label htmlFor={id} className="flex-1 space-y-1">
                  <span className="flex items-center justify-between gap-2 text-sm font-medium">
                    {o.label}
                    {already ? (
                      <span className="text-xs text-muted-foreground">Already exists</span>
                    ) : (
                      <MethodBadge method={o.method} tooltip={false} />
                    )}
                  </span>
                  <code className="block font-mono text-xs text-muted-foreground">
                    {baseUrl(project.slug)}
                    {o.path}
                  </code>
                </label>
              </li>
            );
          })}
        </ul>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={generate} disabled={selected.length === 0 || saving}>
            Create {countLabel(selected.length, "endpoint")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Create `src/components/routes/path-preview.tsx`**

```tsx
export function PathPreview({ base, path }: { base: string; path: string }) {
  return (
    <code className="font-mono">
      {base}
      {path.split(/(\/)/).map((part, i) =>
        part.startsWith(":") ? (
          <span key={i} className="rounded bg-primary/15 px-0.5 text-primary">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </code>
  );
}
```

- [ ] **Step 5: Create `src/components/routes/route-editor.tsx`**

```tsx
"use client";

import { useState } from "react";
import { CodeBlock } from "@/components/domain/code-block";
import { HelpHint } from "@/components/domain/help-hint";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ACTION_META, ACTIONS } from "@/lib/actions";
import { exampleResponse } from "@/lib/examples";
import { METHOD_META, METHODS } from "@/lib/methods";
import { baseUrl } from "@/lib/slug";
import type { HttpMethod, Project, Route, RouteAction } from "@/lib/types";
import { validateRoute } from "@/lib/validation";
import { PathPreview } from "./path-preview";

const NONE = "none";

interface Props {
  project: Project;
  route: Route;
  onSave: (route: Route) => Promise<void> | void;
}

export function RouteEditor({ project, route, onSave }: Props) {
  const [draft, setDraft] = useState<Route>(route);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const model = project.models.find((m) => m.id === draft.modelId) ?? null;
  const preview = exampleResponse(draft, project);

  const set = (patch: Partial<Route>) => {
    setDraft((d) => ({ ...d, ...patch }));
    setError(null);
  };

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const err = validateRoute(draft, project.routes);
    setError(err);
    if (err) return;
    setSaving(true);
    try {
      await onSave(draft);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the route.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="grid gap-6 lg:grid-cols-[1fr_380px]">
      <div className="space-y-5 rounded-[10px] border bg-surface p-5">
        <div className="space-y-2">
          <Label htmlFor="route-name">Friendly name</Label>
          <Input id="route-name" value={draft.description} placeholder="List all customers" onChange={(e) => set({ description: e.target.value })} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="route-action" className="flex items-center gap-1.5">
            What should it do?
            <HelpHint term="an action">
              The action decides what happens when an app calls this route: read records, add one, change one or delete one.
            </HelpHint>
          </Label>
          <Select
            value={draft.action}
            onValueChange={(v) => {
              const action = v as RouteAction;
              set({ action, method: ACTION_META[action].method, filters: action === "list" ? draft.filters : [] });
            }}
          >
            <SelectTrigger id="route-action" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ACTIONS.map((a) => (
                <SelectItem key={a} value={a}>
                  {ACTION_META[a].label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">{ACTION_META[draft.action].description}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="route-model">Which model?</Label>
          <Select value={draft.modelId ?? NONE} onValueChange={(v) => set({ modelId: v === NONE ? null : v, filters: [] })}>
            <SelectTrigger id="route-model" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>None</SelectItem>
              {project.models.map((m) => (
                <SelectItem key={m.id} value={m.id}>
                  {m.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
          <div className="space-y-2">
            <Label htmlFor="route-method" className="flex items-center gap-1.5">
              Method
              <HelpHint term="a method">GET reads data, POST creates, PUT and PATCH update, DELETE removes.</HelpHint>
            </Label>
            <Select value={draft.method} onValueChange={(v) => set({ method: v as HttpMethod })}>
              <SelectTrigger id="route-method" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {METHODS.map((m) => (
                  <SelectItem key={m} value={m}>
                    <span className="font-mono">{m}</span>
                    <span className="text-muted-foreground">· {METHOD_META[m].label}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="route-path">Path</Label>
            <Input
              id="route-path"
              value={draft.path}
              className="font-mono"
              aria-invalid={!!error}
              aria-describedby="route-path-preview"
              onChange={(e) => set({ path: e.target.value })}
            />
            <p id="route-path-preview" className="break-all text-xs text-muted-foreground">
              Full address: <PathPreview base={baseUrl(project.slug)} path={draft.path} />
            </p>
          </div>
        </div>

        {draft.action === "list" && model && model.fields.length > 0 && (
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Let callers filter by</legend>
            <div className="flex flex-wrap gap-4">
              {model.fields.map((f) => (
                <label key={f.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={draft.filters.includes(f.name)}
                    onCheckedChange={(v) =>
                      set({ filters: v === true ? [...draft.filters, f.name] : draft.filters.filter((x) => x !== f.name) })
                    }
                  />
                  <span className="font-mono">{f.name}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              Example: <code className="font-mono">?{draft.filters[0] ?? model.fields[0].name}=value</code>
            </p>
          </fieldset>
        )}

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex justify-end">
          <Button type="submit" disabled={saving}>
            {saving ? "Saving…" : "Save route"}
          </Button>
        </div>
      </div>

      <aside className="space-y-2">
        <h3 className="text-sm font-medium">Response preview</h3>
        <p className="text-xs text-muted-foreground">An example of what callers get back (status {preview.status}).</p>
        {preview.body === null ? (
          <CodeBlock code="(empty: 204 No Content)" language="text" />
        ) : (
          <CodeBlock code={JSON.stringify(preview.body, null, 2)} />
        )}
      </aside>
    </form>
  );
}
```

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `npm test -- src/components/routes`
Expected: PASS.

- [ ] **Step 7: Create `src/components/routes/crud-banner.tsx`**

```tsx
"use client";

import { Wand2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { countLabel } from "@/lib/format";
import { pluralize } from "@/lib/slug";
import type { Model, Project } from "@/lib/types";
import { useProjectStore } from "@/store/project-store";
import { CrudGeneratorDialog } from "./crud-generator-dialog";

export function CrudBanner({ project, model }: { project: Project; model: Model }) {
  const [open, setOpen] = useState(false);
  const addRoutes = useProjectStore((s) => s.addRoutes);
  const router = useRouter();

  if (project.routes.some((r) => r.modelId === model.id) || model.fields.length === 0) return null;

  return (
    <div className="flex flex-col gap-3 rounded-[10px] border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center">
      <Wand2 className="size-5 shrink-0 text-primary" />
      <div className="flex-1">
        <p className="font-medium">Create ready-made endpoints for {model.name}?</p>
        <p className="text-sm text-muted-foreground">
          {`We'll set up the 5 standard ways to list, get, add, update and delete ${pluralize(model.name)}.`}
        </p>
      </div>
      <Button onClick={() => setOpen(true)}>Create endpoints</Button>
      {open && (
        <CrudGeneratorDialog
          project={project}
          model={model}
          open={open}
          onOpenChange={setOpen}
          onGenerate={async (routes) => {
            await addRoutes(project.id, routes);
            toast.success(`${countLabel(routes.length, "endpoint")} created`, {
              action: { label: "View routes", onClick: () => router.push(`/projects/${project.id}/routes`) },
            });
          }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 8: Show the banner in `src/components/models/model-editor.tsx`**

Add the import `import { CrudBanner } from "@/components/routes/crud-banner";` and insert `<CrudBanner project={project} model={model} />` between `</PageHeader ... />` and `<Tabs defaultValue="fields">`.

- [ ] **Step 9: Create `src/components/routes/route-row.tsx`**

```tsx
import { Trash2 } from "lucide-react";
import Link from "next/link";
import { MethodBadge } from "@/components/domain/method-badge";
import { Button } from "@/components/ui/button";
import type { Route } from "@/lib/types";

interface Props {
  route: Route;
  base: string;
  href: string;
  onDelete: () => void;
}

export function RouteRow({ route, base, href, onDelete }: Props) {
  return (
    <li className="flex items-center gap-3 rounded-md border bg-surface-2 p-3 transition-colors duration-150 hover:border-primary/40">
      <MethodBadge method={route.method} className="w-16 justify-center" />
      <Link href={href} className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{route.description || "Untitled route"}</span>
        <code className="block truncate font-mono text-xs text-muted-foreground">
          {base}
          {route.path}
        </code>
      </Link>
      <Button variant="ghost" size="icon" aria-label={`Delete ${route.description || route.path}`} onClick={onDelete}>
        <Trash2 className="size-4" />
      </Button>
    </li>
  );
}
```

- [ ] **Step 10: Create `src/app/projects/[projectId]/routes/page.tsx`**

```tsx
"use client";

import { Plus, Route as RouteIcon, Wand2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/domain/empty-state";
import { PageHeader } from "@/components/domain/page-header";
import { CrudGeneratorDialog } from "@/components/routes/crud-generator-dialog";
import { RouteRow } from "@/components/routes/route-row";
import { Button } from "@/components/ui/button";
import { countLabel } from "@/lib/format";
import { createId } from "@/lib/ids";
import { groupRoutes, missingCrud, uniquePath } from "@/lib/routes";
import { baseUrl } from "@/lib/slug";
import type { Model, Route } from "@/lib/types";
import { useProjectStore } from "@/store/project-store";
import { useCurrentProject } from "@/store/use-project";

export default function RoutesPage() {
  const project = useCurrentProject();
  const addRoutes = useProjectStore((s) => s.addRoutes);
  const deleteRoute = useProjectStore((s) => s.deleteRoute);
  const restoreProject = useProjectStore((s) => s.restoreProject);
  const router = useRouter();
  const [crudModel, setCrudModel] = useState<Model | null>(null);
  const base = baseUrl(project.slug);

  async function newRoute() {
    const route: Route = {
      id: createId("rt"),
      method: "GET",
      path: uniquePath(project.routes),
      modelId: null,
      action: "custom",
      description: "New route",
      filters: [],
    };
    await addRoutes(project.id, [route]);
    router.push(`/projects/${project.id}/routes/${route.id}`);
  }

  async function remove(route: Route) {
    const snapshot = await deleteRoute(project.id, route.id);
    toast("Route deleted", { action: { label: "Undo", onClick: () => void restoreProject(snapshot) } });
  }

  if (project.models.length === 0 && project.routes.length === 0) {
    return (
      <EmptyState
        icon={RouteIcon}
        title="No routes yet"
        description={"Routes come from models. Create a model first, then we'll build its endpoints."}
        action={
          <Button asChild>
            <Link href={`/projects/${project.id}/models`}>Go to models</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div>
      <PageHeader
        title="Routes"
        description="Routes are the web addresses apps call to read and change your data."
        actions={
          <Button onClick={newRoute}>
            <Plus className="size-4" /> New route
          </Button>
        }
      />
      <div className="space-y-8">
        {groupRoutes(project).map((group) => (
          <section key={group.key} className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold">
                {group.title} <span className="text-sm font-normal text-muted-foreground">· {countLabel(group.routes.length, "route")}</span>
              </h2>
              {group.model && missingCrud(group.model, project.routes) && (
                <Button variant="outline" size="sm" onClick={() => setCrudModel(group.model)}>
                  <Wand2 className="size-4" /> Add standard endpoints
                </Button>
              )}
            </div>
            {group.routes.length === 0 ? (
              <p className="text-sm text-muted-foreground">No routes for this model yet.</p>
            ) : (
              <ul className="space-y-2">
                {group.routes.map((r) => (
                  <RouteRow key={r.id} route={r} base={base} href={`/projects/${project.id}/routes/${r.id}`} onDelete={() => remove(r)} />
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
      {crudModel && (
        <CrudGeneratorDialog
          project={project}
          model={crudModel}
          open
          onOpenChange={(open) => !open && setCrudModel(null)}
          onGenerate={async (routes) => {
            await addRoutes(project.id, routes);
            toast.success(`${countLabel(routes.length, "endpoint")} created`);
          }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 11: Create `src/app/projects/[projectId]/routes/[routeId]/page.tsx`**

```tsx
"use client";

import { Play, SearchX } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { EmptyState } from "@/components/domain/empty-state";
import { PageHeader } from "@/components/domain/page-header";
import { RouteEditor } from "@/components/routes/route-editor";
import { Button } from "@/components/ui/button";
import { useProjectStore } from "@/store/project-store";
import { useCurrentProject } from "@/store/use-project";

export default function RoutePage() {
  const project = useCurrentProject();
  const { routeId } = useParams<{ routeId: string }>();
  const saveRoute = useProjectStore((s) => s.saveRoute);
  const route = project.routes.find((r) => r.id === routeId);
  if (!route) return <EmptyState icon={SearchX} title="Route not found" description="It may have been deleted." />;

  return (
    <div>
      <PageHeader
        title={route.description || "Route"}
        description="Choose what this route does and where it lives."
        actions={
          <Button variant="outline" asChild>
            <Link href={`/projects/${project.id}/console?route=${route.id}`}>
              <Play className="size-4" /> Test this route
            </Link>
          </Button>
        }
      />
      <RouteEditor
        key={JSON.stringify(route)}
        project={project}
        route={route}
        onSave={async (next) => {
          await saveRoute(project.id, next);
          toast.success("Route saved");
        }}
      />
    </div>
  );
}
```

- [ ] **Step 12: Check it in the browser**

Run: `npm run dev`. In a Store project, open Product.
Expected: the banner "Create ready-made endpoints for Product?" appears. The dialog shows 5 plain-language options, and creating them shows a toast. The banner disappears. Routes lists "Product · 5 routes" with coloured badges, and Customer and Order show "Add standard endpoints". Opening a route shows the editor and a live response preview. Changing the path to a duplicate shows an inline error.

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "feat: add CRUD generator, routes list and route editor" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Test console

**Files:**
- Create: `src/lib/request-body.ts`, `src/components/console/{route-picker,request-form,json-tree,response-viewer}.tsx`, `src/app/projects/[projectId]/console/page.tsx`
- Test: `src/lib/request-body.test.ts`, `src/components/console/request-form.test.tsx`, `src/components/console/response-viewer.test.tsx`

**Interfaces:**
- Consumes: `consoleService.send/reset`, `routeParams`, `fillPath`, `groupRoutes`, `useUiStore.markProgress`, `MethodBadge`, `EmptyState`.
- Produces:
  - `type FormValues = Record<string, string | boolean | undefined>`
  - `buildBody(model, values): Record<string, unknown>`; `valuesFromBody(model, body): FormValues`
  - `<RequestForm project route sending onSend(req: Omit<TestRequest, "routeId">) />`
  - `<ResponseViewer response loading />`
  - `<JsonTree value />`
  - `<RoutePicker project selectedId onSelect(id) />`

- [ ] **Step 1: Write the failing tests**

`src/lib/request-body.test.ts`:
```ts
import { buildBody, valuesFromBody } from "./request-body";
import type { Model } from "./types";

const model: Model = {
  id: "m",
  name: "Product",
  fields: [
    { id: "1", name: "name", type: "text", required: true, unique: false },
    { id: "2", name: "price", type: "number", required: true, unique: false },
    { id: "3", name: "inStock", type: "boolean", required: false, unique: false },
    { id: "4", name: "meta", type: "json", required: false, unique: false },
  ],
};

it("converts form values to a typed body and drops blanks", () => {
  expect(buildBody(model, { name: "Lamp", price: "25", inStock: true, meta: '{"a":1}' })).toEqual({
    name: "Lamp", price: 25, inStock: true, meta: { a: 1 },
  });
  expect(buildBody(model, { name: "", price: "abc" })).toEqual({ price: "abc" });
});

it("turns a body back into form values", () => {
  expect(valuesFromBody(model, { name: "Lamp", price: 25, inStock: false, meta: { a: 1 } })).toEqual({
    name: "Lamp", price: "25", inStock: false, meta: '{"a":1}',
  });
  expect(valuesFromBody(model, "nope")).toEqual({});
});
```

`src/components/console/request-form.test.tsx`:
```tsx
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildCrudRoutes } from "@/lib/crud";
import type { Project } from "@/lib/types";
import { renderUi } from "@/test/render";
import { RequestForm } from "./request-form";

const product = {
  id: "m1",
  name: "Product",
  fields: [
    { id: "f1", name: "name", type: "text" as const, required: true, unique: false },
    { id: "f2", name: "price", type: "number" as const, required: true, unique: false },
  ],
};
const routes = buildCrudRoutes(product, ["create", "get"], []);
const project: Project = { id: "p1", name: "Store", slug: "store", description: "", models: [product], routes, createdAt: "", updatedAt: "" };

it("builds the body from a schema form", async () => {
  const user = userEvent.setup();
  const onSend = vi.fn();
  renderUi(<RequestForm project={project} route={routes[0]} sending={false} onSend={onSend} />);
  expect(screen.getByText("/api/store/products")).toBeInTheDocument();
  await user.type(screen.getByLabelText(/^name/), "Lamp");
  await user.type(screen.getByLabelText(/^price/), "25");
  await user.click(screen.getByRole("button", { name: "Send request" }));
  expect(onSend).toHaveBeenCalledWith({ params: {}, query: {}, body: { name: "Lamp", price: 25 } });
});

it("reports invalid JSON in advanced mode", async () => {
  const user = userEvent.setup();
  const onSend = vi.fn();
  renderUi(<RequestForm project={project} route={routes[0]} sending={false} onSend={onSend} />);
  await user.click(screen.getByRole("switch", { name: "Advanced: JSON" }));
  const box = screen.getByLabelText("Request body JSON");
  await user.clear(box);
  await user.click(box);
  await user.paste("{bad");
  await user.click(screen.getByRole("button", { name: "Send request" }));
  expect(screen.getByRole("alert")).toHaveTextContent("That isn't valid JSON");
  expect(onSend).not.toHaveBeenCalled();
});

it("asks for path values", async () => {
  const user = userEvent.setup();
  const onSend = vi.fn();
  renderUi(<RequestForm project={project} route={routes[1]} sending={false} onSend={onSend} />);
  await user.type(screen.getByLabelText("id"), "3");
  expect(screen.getByText("/api/store/products/3")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Send request" }));
  expect(onSend).toHaveBeenCalledWith({ params: { id: "3" }, query: {}, body: undefined });
});
```

`src/components/console/response-viewer.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { ResponseViewer } from "./response-viewer";

it("explains the status and shows the body", () => {
  render(
    <ResponseViewer
      loading={false}
      response={{ status: 400, durationMs: 212, body: { error: "Validation failed", details: ["'name' is required"] } }}
    />,
  );
  expect(screen.getByText("400 Bad Request")).toBeInTheDocument();
  expect(screen.getByText("212 ms")).toBeInTheDocument();
  expect(screen.getByText(/needs fixing/)).toBeInTheDocument();
  expect(screen.getByText(`"'name' is required"`)).toBeInTheDocument();
});

it("shows an empty state before the first request", () => {
  render(<ResponseViewer loading={false} response={null} />);
  expect(screen.getByText("No response yet")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `npm test -- src/lib/request-body.test.ts src/components/console`
Expected: FAIL with unresolved imports.

- [ ] **Step 3: Create `src/lib/request-body.ts`**

```ts
import type { Model } from "./types";

export type FormValues = Record<string, string | boolean | undefined>;

export function buildBody(model: Model, values: FormValues): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  for (const field of model.fields) {
    const value = values[field.name];
    if (value === undefined || value === "") continue;
    switch (field.type) {
      case "number": {
        const n = Number(value);
        body[field.name] = Number.isNaN(n) ? value : n;
        break;
      }
      case "boolean":
        body[field.name] = value === true || value === "true";
        break;
      case "json":
        try {
          body[field.name] = JSON.parse(String(value));
        } catch {
          body[field.name] = value;
        }
        break;
      default:
        body[field.name] = value;
    }
  }
  return body;
}

export function valuesFromBody(model: Model, body: unknown): FormValues {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return {};
  const input = body as Record<string, unknown>;
  const values: FormValues = {};
  for (const field of model.fields) {
    const value = input[field.name];
    if (value === undefined || value === null) continue;
    if (typeof value === "boolean") values[field.name] = value;
    else if (typeof value === "object") values[field.name] = JSON.stringify(value);
    else values[field.name] = String(value);
  }
  return values;
}
```

- [ ] **Step 4: Create `src/components/console/request-form.tsx`**

```tsx
"use client";

import { Send } from "lucide-react";
import { useState } from "react";
import { MethodBadge } from "@/components/domain/method-badge";
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

export function RequestForm({ project, route, sending, onSend }: Props) {
  const model = project.models.find((m) => m.id === route.modelId) ?? null;
  const params = routeParams(route.path);
  const bodyModel = model && (route.action === "create" || route.action === "update") ? model : null;
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [query, setQuery] = useState<Record<string, string>>({});
  const [values, setValues] = useState<FormValues>({});
  const [jsonMode, setJsonMode] = useState(false);
  const [rawJson, setRawJson] = useState("{}");
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
        setValues(valuesFromBody(bodyModel, JSON.parse(rawJson)));
      } catch {
        // Keep the previous form values if the JSON can't be parsed.
      }
    }
    setJsonMode(on);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
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
    <form onSubmit={submit} noValidate className="space-y-5">
      <div className="flex items-center gap-2 rounded-md border bg-background p-2">
        <MethodBadge method={route.method} />
        <code className="min-w-0 break-all font-mono text-sm">{url}</code>
      </div>

      {params.length > 0 && (
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">Which record?</legend>
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
          <legend className="text-sm font-medium">Filters (optional)</legend>
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
            <legend className="text-sm font-medium">Data to send</legend>
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

      <Button type="submit" disabled={sending} className="w-full sm:w-auto">
        <Send className="size-4" /> {sending ? "Sending…" : "Send request"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 5: Create `src/components/console/json-tree.tsx`**

```tsx
interface Props {
  value: unknown;
  name?: string;
  depth?: number;
}

function valueClass(value: unknown): string {
  if (typeof value === "string") return "text-success";
  if (typeof value === "number") return "text-warning";
  if (typeof value === "boolean") return "text-method-patch";
  return "text-muted-foreground";
}

export function JsonTree({ value, name, depth = 0 }: Props) {
  const label = name !== undefined ? <span className="text-primary">{JSON.stringify(name)}: </span> : null;

  if (value !== null && typeof value === "object") {
    const isArray = Array.isArray(value);
    const entries = isArray ? value.map((v, i) => [String(i), v] as const) : Object.entries(value);
    return (
      <details open={depth < 2} className="font-mono text-xs">
        <summary className="cursor-pointer select-none hover:text-foreground">
          {label}
          <span className="text-muted-foreground">
            {isArray ? "[" : "{"} <span className="italic">{entries.length} {isArray ? "items" : "keys"}</span>
          </span>
        </summary>
        <div className="ml-4 border-l pl-3">
          {entries.map(([k, v]) => (
            <JsonTree key={k} name={isArray ? undefined : k} value={v} depth={depth + 1} />
          ))}
        </div>
        <span className="text-muted-foreground">{isArray ? "]" : "}"}</span>
      </details>
    );
  }

  return (
    <div className="font-mono text-xs">
      {label}
      <span className={valueClass(value)}>{JSON.stringify(value)}</span>
    </div>
  );
}
```

- [ ] **Step 6: Create `src/components/console/response-viewer.tsx`**

```tsx
import { Send } from "lucide-react";
import { CopyButton } from "@/components/domain/copy-button";
import { EmptyState } from "@/components/domain/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import type { TestResponse } from "@/lib/types";
import { cn } from "@/lib/utils";
import { JsonTree } from "./json-tree";

const STATUS_TEXT: Record<number, { text: string; hint: string }> = {
  200: { text: "OK", hint: "It worked." },
  201: { text: "Created", hint: "The record was saved." },
  204: { text: "No Content", hint: "It worked. The record was deleted, so there's nothing to show." },
  400: { text: "Bad Request", hint: "Something in the data you sent needs fixing. See the details below." },
  404: { text: "Not Found", hint: "There's no record with that id." },
};

export function ResponseViewer({ response, loading }: { response: TestResponse | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="space-y-3 rounded-[10px] border bg-surface p-4" aria-busy="true">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }
  if (!response) {
    return <EmptyState icon={Send} title="No response yet" description="Fill in the request and press Send to see what your API returns." />;
  }
  const meta = STATUS_TEXT[response.status] ?? { text: "", hint: "" };
  const tone = response.status < 300 ? "success" : response.status < 500 ? "warning" : "danger";
  const hasBody = response.body !== null && response.body !== undefined;

  return (
    <div className="space-y-3" aria-live="polite">
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={cn(
            "rounded-full border px-2.5 py-0.5 font-mono text-sm font-semibold",
            tone === "success" && "border-success/30 bg-success/15 text-success",
            tone === "warning" && "border-warning/30 bg-warning/15 text-warning",
            tone === "danger" && "border-destructive/30 bg-destructive/15 text-destructive",
          )}
        >
          {`${response.status} ${meta.text}`.trim()}
        </span>
        <span className="text-sm text-muted-foreground">{response.durationMs} ms</span>
      </div>
      {meta.hint && <p className="text-sm text-muted-foreground">{meta.hint}</p>}
      {hasBody && (
        <div className="relative rounded-[10px] border bg-surface p-4">
          <CopyButton text={JSON.stringify(response.body, null, 2)} className="absolute right-2 top-2" />
          <JsonTree value={response.body} />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Run the tests and confirm they pass**

Run: `npm test -- src/lib/request-body.test.ts src/components/console`
Expected: PASS.

- [ ] **Step 8: Create `src/components/console/route-picker.tsx`**

```tsx
import { MethodBadge } from "@/components/domain/method-badge";
import { groupRoutes } from "@/lib/routes";
import type { Project } from "@/lib/types";
import { cn } from "@/lib/utils";

interface Props {
  project: Project;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function RoutePicker({ project, selectedId, onSelect }: Props) {
  return (
    <nav aria-label="Routes to test" className="space-y-4">
      {groupRoutes(project)
        .filter((g) => g.routes.length > 0)
        .map((g) => (
          <div key={g.key} className="space-y-1">
            <h3 className="px-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{g.title}</h3>
            {g.routes.map((r) => (
              <button
                key={r.id}
                type="button"
                aria-pressed={r.id === selectedId}
                onClick={() => onSelect(r.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors duration-150 hover:bg-accent",
                  r.id === selectedId && "bg-primary/10",
                )}
              >
                <MethodBadge method={r.method} tooltip={false} className="w-16 justify-center" />
                <span className="min-w-0 truncate">{r.description || r.path}</span>
              </button>
            ))}
          </div>
        ))}
    </nav>
  );
}
```

- [ ] **Step 9: Create `src/app/projects/[projectId]/console/page.tsx`**

```tsx
"use client";

import { Play, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { toast } from "sonner";
import { RequestForm } from "@/components/console/request-form";
import { ResponseViewer } from "@/components/console/response-viewer";
import { RoutePicker } from "@/components/console/route-picker";
import { EmptyState } from "@/components/domain/empty-state";
import { PageHeader } from "@/components/domain/page-header";
import { Button } from "@/components/ui/button";
import { consoleService } from "@/lib/services";
import type { TestRequest, TestResponse } from "@/lib/types";
import { useUiStore } from "@/store/ui-store";
import { useCurrentProject } from "@/store/use-project";

function Console() {
  const project = useCurrentProject();
  const params = useSearchParams();
  const markProgress = useUiStore((s) => s.markProgress);
  const requested = params.get("route");
  const [routeId, setRouteId] = useState<string | null>(
    project.routes.some((r) => r.id === requested) ? requested : (project.routes[0]?.id ?? null),
  );
  const [response, setResponse] = useState<TestResponse | null>(null);
  const [sending, setSending] = useState(false);
  const route = project.routes.find((r) => r.id === routeId) ?? null;

  async function send(request: Omit<TestRequest, "routeId">) {
    if (!route) return;
    setSending(true);
    try {
      setResponse(await consoleService.send(project.id, { routeId: route.id, ...request }));
      markProgress(project.id, "tested");
    } finally {
      setSending(false);
    }
  }

  async function reset() {
    await consoleService.reset(project.id);
    setResponse(null);
    toast("Sample data reset");
  }

  if (project.routes.length === 0) {
    return (
      <EmptyState
        icon={Play}
        title="Nothing to test yet"
        description="Create some routes first, then come back to try them."
        action={
          <Button asChild>
            <Link href={`/projects/${project.id}/routes`}>Go to routes</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div>
      <PageHeader
        title="Test console"
        description="Try your routes with sample data. Nothing here affects real users."
        actions={
          <Button variant="outline" onClick={reset}>
            <RotateCcw className="size-4" /> Reset sample data
          </Button>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[240px_1fr] xl:grid-cols-[240px_1fr_1fr]">
        <RoutePicker
          project={project}
          selectedId={routeId}
          onSelect={(id) => {
            setRouteId(id);
            setResponse(null);
          }}
        />
        <section className="rounded-[10px] border bg-surface p-5">
          {route ? (
            <RequestForm key={route.id} project={project} route={route} sending={sending} onSend={send} />
          ) : (
            <p className="text-sm text-muted-foreground">Pick a route on the left.</p>
          )}
        </section>
        <section className="lg:col-start-2 xl:col-start-auto">
          <h2 className="mb-3 text-sm font-medium">Response</h2>
          <ResponseViewer response={response} loading={sending} />
        </section>
      </div>
    </div>
  );
}

export default function ConsolePage() {
  return (
    <Suspense>
      <Console />
    </Suspense>
  );
}
```

- [ ] **Step 10: Check it in the browser**

Run: `npm run dev`. With the Product CRUD from Task 9, open Test.
Expected: sending "Add a product" with the name empty returns an amber "400 Bad Request" and `'name' is required`. Filling name and price returns a green "201 Created". "List all products" then includes the new record. "Delete a product" with id 1 returns 204 with the explanation. Advanced JSON mode round-trips the values.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: add test console with schema-driven request form" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 11: API docs page

**Files:**
- Create: `src/lib/docs.ts`, `src/components/docs/model-fields-doc.tsx`, `src/components/docs/endpoint-doc.tsx`, `src/app/projects/[projectId]/docs/page.tsx`
- Test: `src/lib/docs.test.ts`

**Interfaces:**
- Consumes: `groupRoutes`, `exampleRequest`, `exampleResponse`, `routeParams`, `fieldTypeMeta`, `CodeBlock`, `MethodBadge`, `useUiStore.markProgress`.
- Produces: `DocEndpoint { route, request, response }`, `DocSection { id, title, model, endpoints }`, `buildDocs(project): DocSection[]`.

- [ ] **Step 1: Write the failing test** — `src/lib/docs.test.ts`

```ts
import { buildCrudRoutes } from "./crud";
import { buildDocs } from "./docs";
import { buildTemplateModels } from "./templates";
import type { Project } from "./types";

it("documents each model's routes with examples", () => {
  const models = buildTemplateModels("store");
  const product = models[0];
  const routes = [
    ...buildCrudRoutes(product, ["list", "get", "create", "update", "delete"], []),
    { id: "x", method: "GET" as const, path: "/ping", modelId: null, action: "custom" as const, description: "Ping", filters: [] },
  ];
  const project: Project = { id: "p", name: "Store", slug: "store", description: "", models, routes, createdAt: "", updatedAt: "" };

  const sections = buildDocs(project);
  expect(sections.map((s) => [s.title, s.endpoints.length])).toEqual([["Product", 5], ["Other routes", 1]]);
  const create = sections[0].endpoints.find((e) => e.route.action === "create")!;
  expect(create.request).toHaveProperty("name");
  expect(create.response.status).toBe(201);
  expect(sections[0].endpoints.find((e) => e.route.action === "list")!.request).toBeNull();
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npm test -- src/lib/docs.test.ts`
Expected: FAIL with "Failed to resolve import "./docs"".

- [ ] **Step 3: Create `src/lib/docs.ts`**

```ts
import { exampleRequest, exampleResponse } from "./examples";
import type { EngineResult } from "./mock-engine";
import { groupRoutes } from "./routes";
import type { Model, Project, Route } from "./types";

export interface DocEndpoint {
  route: Route;
  request: Record<string, unknown> | null;
  response: EngineResult;
}

export interface DocSection {
  id: string;
  title: string;
  model: Model | null;
  endpoints: DocEndpoint[];
}

export function buildDocs(project: Project): DocSection[] {
  return groupRoutes(project)
    .filter((g) => g.routes.length > 0)
    .map((g) => ({
      id: g.key,
      title: g.title,
      model: g.model,
      endpoints: g.routes.map((route) => ({
        route,
        request: exampleRequest(route, project),
        response: exampleResponse(route, project),
      })),
    }));
}
```

- [ ] **Step 4: Run it and confirm it passes**

Run: `npm test -- src/lib/docs.test.ts`
Expected: PASS.

- [ ] **Step 5: Create `src/components/docs/model-fields-doc.tsx`**

```tsx
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fieldTypeMeta } from "@/lib/field-types";
import type { Model, Project } from "@/lib/types";

export function ModelFieldsDoc({ model, project }: { model: Model; project: Project }) {
  if (model.fields.length === 0) return null;
  return (
    <div className="overflow-x-auto rounded-[10px] border">
      <Table>
        <TableHeader>
          <TableRow className="bg-surface">
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
                <TableCell className="font-mono text-sm">{f.name}</TableCell>
                <TableCell className="text-sm">
                  {f.type === "link" && target ? `Link to ${target.name}` : fieldTypeMeta(f.type).label}
                  {f.type === "choice" && f.options?.length ? (
                    <span className="text-muted-foreground"> ({f.options.join(", ")})</span>
                  ) : null}
                </TableCell>
                <TableCell className="text-sm">{f.required ? "Yes" : "No"}</TableCell>
                <TableCell className="text-sm">{f.unique ? "Yes" : "No"}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
```

- [ ] **Step 6: Create `src/components/docs/endpoint-doc.tsx`**

```tsx
import { Play } from "lucide-react";
import Link from "next/link";
import { CodeBlock } from "@/components/domain/code-block";
import { MethodBadge } from "@/components/domain/method-badge";
import { Button } from "@/components/ui/button";
import type { DocEndpoint } from "@/lib/docs";
import { routeParams } from "@/lib/paths";

export function EndpointDoc({ endpoint, base, tryHref }: { endpoint: DocEndpoint; base: string; tryHref: string }) {
  const { route, request, response } = endpoint;
  const params = routeParams(route.path);
  return (
    <div className="space-y-4 rounded-[10px] border bg-surface-2 p-5">
      <div className="flex flex-wrap items-center gap-3">
        <MethodBadge method={route.method} showLabel />
        <code className="min-w-0 break-all font-mono text-sm">
          {base}
          {route.path}
        </code>
        <Button variant="outline" size="sm" className="ml-auto" asChild>
          <Link href={tryHref}>
            <Play className="size-4" /> Try it
          </Link>
        </Button>
      </div>
      <p className="font-medium">{route.description || "Untitled route"}</p>
      {params.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Replace {params.map((p) => <code key={p} className="mx-0.5 font-mono text-foreground">:{p}</code>)} with the record&apos;s id.
        </p>
      )}
      {route.filters.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Filter with <code className="font-mono text-foreground">?{route.filters[0]}=value</code>. Available:{" "}
          {route.filters.join(", ")}.
        </p>
      )}
      {request && (
        <div className="space-y-1.5">
          <h4 className="text-sm font-medium">Example request body</h4>
          <CodeBlock code={JSON.stringify(request, null, 2)} />
        </div>
      )}
      <div className="space-y-1.5">
        <h4 className="text-sm font-medium">Example response · {response.status}</h4>
        {response.body === null ? (
          <CodeBlock code="(empty: 204 No Content)" language="text" />
        ) : (
          <CodeBlock code={JSON.stringify(response.body, null, 2)} />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Create `src/app/projects/[projectId]/docs/page.tsx`**

```tsx
"use client";

import { BookOpen } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo } from "react";
import { EndpointDoc } from "@/components/docs/endpoint-doc";
import { ModelFieldsDoc } from "@/components/docs/model-fields-doc";
import { EmptyState } from "@/components/domain/empty-state";
import { Button } from "@/components/ui/button";
import { buildDocs } from "@/lib/docs";
import { baseUrl } from "@/lib/slug";
import { useUiStore } from "@/store/ui-store";
import { useCurrentProject } from "@/store/use-project";

export default function DocsPage() {
  const project = useCurrentProject();
  const markProgress = useUiStore((s) => s.markProgress);
  const sections = useMemo(() => buildDocs(project), [project]);
  const base = baseUrl(project.slug);

  useEffect(() => {
    markProgress(project.id, "viewedDocs");
  }, [project.id, markProgress]);

  if (sections.length === 0) {
    return (
      <EmptyState
        icon={BookOpen}
        title="Your docs will appear here"
        description="Docs are written automatically from your routes. Add a route to get started."
        action={
          <Button asChild>
            <Link href={`/projects/${project.id}/routes`}>Go to routes</Link>
          </Button>
        }
      />
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[200px_1fr]">
      <nav aria-label="Docs sections" className="lg:sticky lg:top-20 lg:self-start">
        <ul className="space-y-1 text-sm">
          {[{ id: "introduction", title: "Introduction" }, ...sections].map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="block rounded-md px-2 py-1 text-muted-foreground hover:bg-accent hover:text-foreground">
                {s.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>
      <article className="min-w-0 space-y-12">
        <section id="introduction" className="scroll-mt-20 space-y-3">
          <h1 className="text-2xl font-semibold">{project.name} API</h1>
          {project.description && <p className="text-muted-foreground">{project.description}</p>}
          <p className="text-sm">
            Every address below starts with <code className="rounded bg-surface-2 px-1.5 py-0.5 font-mono">{base}</code>. Send and
            receive data as JSON.
          </p>
        </section>
        {sections.map((s) => (
          <section key={s.id} id={s.id} className="scroll-mt-20 space-y-6">
            <h2 className="border-b pb-2 text-xl font-semibold">{s.title}</h2>
            {s.model && <ModelFieldsDoc model={s.model} project={project} />}
            {s.endpoints.map((e) => (
              <EndpointDoc key={e.route.id} endpoint={e} base={base} tryHref={`/projects/${project.id}/console?route=${e.route.id}`} />
            ))}
          </section>
        ))}
      </article>
    </div>
  );
}
```

- [ ] **Step 8: Check it in the browser**

Run: `npm run dev` and open Docs.
Expected: the sidebar has Introduction plus one entry per model with routes. Product shows a fields table and 5 endpoint cards with example request and response. "Try it" opens the console with that route selected.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: add auto-generated API docs page" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 12: Project home checklist, settings, ⌘K palette

**Files:**
- Create: `src/lib/onboarding.ts`, `src/components/home/onboarding-checklist.tsx`, `src/components/shell/command-palette.tsx`, `src/app/projects/[projectId]/page.tsx`, `src/app/projects/[projectId]/settings/page.tsx`
- Modify: `src/components/shell/top-bar.tsx` (search button), `src/components/shell/project-shell.tsx` (mount the palette)
- Test: `src/lib/onboarding.test.ts`, `src/components/home/onboarding-checklist.test.tsx`, `src/components/shell/command-palette.test.tsx`

**Interfaces:**
- Consumes: `useUiStore` (`progress`, `commandOpen`, `setCommandOpen`), `PROJECT_NAV`, `navHref`, `validateProjectName`, `validateSlug`, and the store actions `updateProject`, `deleteProject`, `restoreProject`.
- Produces: `ChecklistStep`, `buildChecklist(project, progress?)`, `<OnboardingChecklist steps />`, `<CommandPalette project />`.

- [ ] **Step 1: Write the failing tests**

`src/lib/onboarding.test.ts`:
```ts
import { buildCrudRoutes } from "./crud";
import { buildChecklist } from "./onboarding";
import { buildTemplateModels } from "./templates";
import type { Project } from "./types";

const base: Project = { id: "p1", name: "S", slug: "s", description: "", models: [], routes: [], createdAt: "", updatedAt: "" };

it("starts with nothing done", () => {
  expect(buildChecklist(base).map((s) => s.done)).toEqual([false, false, false, false, false]);
});

it("tracks progress from the project and UI flags", () => {
  const models = buildTemplateModels("todo");
  const project = { ...base, models, routes: buildCrudRoutes(models[0], ["list"], []) };
  const steps = buildChecklist(project, { tested: true });
  expect(steps.map((s) => [s.id, s.done])).toEqual([
    ["model", true], ["fields", true], ["routes", true], ["test", true], ["docs", false],
  ]);
  expect(steps[4].href).toBe("/projects/p1/docs");
});
```

`src/components/home/onboarding-checklist.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { buildChecklist } from "@/lib/onboarding";
import { buildTemplateModels } from "@/lib/templates";
import { OnboardingChecklist } from "./onboarding-checklist";

it("shows progress and a button for the next step", () => {
  const project = {
    id: "p1", name: "S", slug: "s", description: "", models: buildTemplateModels("todo"), routes: [], createdAt: "", updatedAt: "",
  };
  render(<OnboardingChecklist steps={buildChecklist(project)} />);
  expect(screen.getByText("2 of 5 done")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Set up routes" })).toHaveAttribute("href", "/projects/p1/routes");
  expect(screen.getAllByRole("link")).toHaveLength(1);
});
```

`src/components/shell/command-palette.test.tsx`:
```tsx
import { fireEvent, screen } from "@testing-library/react";
import { buildTemplateModels } from "@/lib/templates";
import { useUiStore } from "@/store/ui-store";
import { renderUi } from "@/test/render";
import { CommandPalette } from "./command-palette";

beforeEach(() => useUiStore.setState({ commandOpen: false }));

it("opens with Ctrl+K and lists models", async () => {
  const project = {
    id: "p1", name: "Store", slug: "store", description: "", models: buildTemplateModels("store"), routes: [], createdAt: "", updatedAt: "",
  };
  renderUi(<CommandPalette project={project} />);
  expect(screen.queryByPlaceholderText(/Search pages/)).not.toBeInTheDocument();
  fireEvent.keyDown(window, { key: "k", ctrlKey: true });
  expect(await screen.findByPlaceholderText(/Search pages/)).toBeInTheDocument();
  expect(screen.getByText("Customer")).toBeInTheDocument();
  expect(screen.getByText("Docs")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `npm test -- src/lib/onboarding.test.ts src/components/home src/components/shell/command-palette.test.tsx`
Expected: FAIL with unresolved imports.

- [ ] **Step 3: Create `src/lib/onboarding.ts`**

```ts
import type { Project } from "./types";

export interface ChecklistStep {
  id: "model" | "fields" | "routes" | "test" | "docs";
  label: string;
  description: string;
  done: boolean;
  href: string;
  cta: string;
}

export interface ProjectProgress {
  tested?: boolean;
  viewedDocs?: boolean;
}

export function buildChecklist(project: Project, progress: ProjectProgress = {}): ChecklistStep[] {
  const base = `/projects/${project.id}`;
  return [
    {
      id: "model",
      label: "Create a model",
      description: "Decide what your API stores, like Customers or Orders.",
      done: project.models.length > 0,
      href: `${base}/models`,
      cta: "Create a model",
    },
    {
      id: "fields",
      label: "Add fields",
      description: "Describe each model with fields such as name or price.",
      done: project.models.some((m) => m.fields.length > 0),
      href: `${base}/models`,
      cta: "Add fields",
    },
    {
      id: "routes",
      label: "Generate routes",
      description: "Create the web addresses apps call to use your data.",
      done: project.routes.length > 0,
      href: `${base}/routes`,
      cta: "Set up routes",
    },
    {
      id: "test",
      label: "Test a route",
      description: "Send a request and see the response with sample data.",
      done: !!progress.tested,
      href: `${base}/console`,
      cta: "Open the test console",
    },
    {
      id: "docs",
      label: "View docs",
      description: "See the documentation we wrote for you.",
      done: !!progress.viewedDocs,
      href: `${base}/docs`,
      cta: "View docs",
    },
  ];
}
```

- [ ] **Step 4: Create `src/components/home/onboarding-checklist.tsx`**

```tsx
import { Check } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { ChecklistStep } from "@/lib/onboarding";
import { cn } from "@/lib/utils";

export function OnboardingChecklist({ steps }: { steps: ChecklistStep[] }) {
  const doneCount = steps.filter((s) => s.done).length;
  const nextId = steps.find((s) => !s.done)?.id;
  return (
    <Card>
      <CardHeader>
        <CardTitle>Getting started</CardTitle>
        <CardDescription>
          {doneCount} of {steps.length} done
        </CardDescription>
        <Progress value={(doneCount / steps.length) * 100} aria-label="Getting started progress" className="mt-2" />
      </CardHeader>
      <CardContent>
        <ol className="space-y-2">
          {steps.map((s, i) => (
            <li
              key={s.id}
              className={cn("flex flex-wrap items-start gap-3 rounded-md p-3", s.id === nextId && "bg-primary/5 ring-1 ring-primary/30")}
            >
              <span
                aria-hidden
                className={cn(
                  "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border text-xs",
                  s.done && "border-success bg-success text-white",
                )}
              >
                {s.done ? <Check className="size-3.5" /> : i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p className={cn("text-sm font-medium", s.done && "text-muted-foreground line-through")}>
                  {s.label}
                  {s.done && <span className="sr-only"> (done)</span>}
                </p>
                <p className="text-xs text-muted-foreground">{s.description}</p>
              </div>
              {s.id === nextId && (
                <Button size="sm" asChild>
                  <Link href={s.href}>{s.cta}</Link>
                </Button>
              )}
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 5: Create `src/components/shell/command-palette.tsx`**

```tsx
"use client";

import { Plus, SunMoon } from "lucide-react";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { MethodBadge } from "@/components/domain/method-badge";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import type { Project } from "@/lib/types";
import { useProjectStore } from "@/store/project-store";
import { useUiStore } from "@/store/ui-store";
import { PROJECT_NAV, navHref } from "./nav-items";

export function CommandPalette({ project }: { project: Project }) {
  const open = useUiStore((s) => s.commandOpen);
  const setOpen = useUiStore((s) => s.setCommandOpen);
  const projects = useProjectStore((s) => s.projects);
  const { resolvedTheme, setTheme } = useTheme();
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen(!useUiStore.getState().commandOpen);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);

  const go = (href: string) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen} title="Search" description="Jump to a page, model or route">
      <CommandInput placeholder="Search pages, models and routes…" />
      <CommandList>
        <CommandEmpty>Nothing found.</CommandEmpty>
        <CommandGroup heading="Pages">
          {PROJECT_NAV.map(({ segment, label, icon: Icon }) => (
            <CommandItem key={label} value={`page ${label}`} onSelect={() => go(navHref(project.id, segment))}>
              <Icon className="size-4" /> {label}
            </CommandItem>
          ))}
        </CommandGroup>
        {project.models.length > 0 && (
          <CommandGroup heading="Models">
            {project.models.map((m) => (
              <CommandItem key={m.id} value={`model ${m.name}`} onSelect={() => go(`/projects/${project.id}/models/${m.id}`)}>
                {m.name}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {project.routes.length > 0 && (
          <CommandGroup heading="Routes">
            {project.routes.map((r) => (
              <CommandItem
                key={r.id}
                value={`route ${r.method} ${r.path} ${r.description}`}
                onSelect={() => go(`/projects/${project.id}/routes/${r.id}`)}
              >
                <MethodBadge method={r.method} tooltip={false} />
                <span className="truncate">{r.description}</span>
                <code className="ml-auto font-mono text-xs text-muted-foreground">{r.path}</code>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {projects.length > 1 && (
          <CommandGroup heading="Your APIs">
            {projects
              .filter((p) => p.id !== project.id)
              .map((p) => (
                <CommandItem key={p.id} value={`api ${p.name}`} onSelect={() => go(`/projects/${p.id}`)}>
                  {p.name}
                </CommandItem>
              ))}
          </CommandGroup>
        )}
        <CommandGroup heading="Actions">
          <CommandItem value="action new api" onSelect={() => go("/projects/new")}>
            <Plus className="size-4" /> New API
          </CommandItem>
          <CommandItem
            value="action toggle theme"
            onSelect={() => {
              setTheme(resolvedTheme === "light" ? "dark" : "light");
              setOpen(false);
            }}
          >
            <SunMoon className="size-4" /> Toggle theme
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
```

If the generated `command.tsx` has no `title`/`description` props on `CommandDialog`, drop those two props. Older shadcn versions render their own sr-only title.

- [ ] **Step 6: Run the tests and confirm they pass**

Run: `npm test -- src/lib/onboarding.test.ts src/components/home src/components/shell/command-palette.test.tsx`
Expected: PASS.

- [ ] **Step 7: Mount the palette and add a search button**

In `src/components/shell/project-shell.tsx`, add `import { CommandPalette } from "./command-palette";` and render `<CommandPalette project={project} />` as the last child of the outer `<div className="flex min-h-screen bg-background">`.

In `src/components/shell/top-bar.tsx`, add imports `import { Search } from "lucide-react";` (merge it with the `Menu` import) and `import { useUiStore } from "@/store/ui-store";`. Inside `TopBar`, add `const setCommandOpen = useUiStore((s) => s.setCommandOpen);` and insert this as the first child of `<div className="ml-auto flex items-center gap-1">`:

```tsx
<Button variant="outline" size="sm" className="hidden gap-2 text-muted-foreground sm:flex" onClick={() => setCommandOpen(true)}>
  <Search className="size-4" /> Search
  <kbd className="rounded border bg-surface px-1.5 font-mono text-[10px]">⌘K</kbd>
</Button>
<Button variant="ghost" size="icon" className="sm:hidden" aria-label="Search" onClick={() => setCommandOpen(true)}>
  <Search className="size-4" />
</Button>
```

- [ ] **Step 8: Create `src/app/projects/[projectId]/page.tsx`**

```tsx
"use client";

import { PartyPopper } from "lucide-react";
import Link from "next/link";
import { CopyButton } from "@/components/domain/copy-button";
import { PageHeader } from "@/components/domain/page-header";
import { OnboardingChecklist } from "@/components/home/onboarding-checklist";
import { Card, CardContent } from "@/components/ui/card";
import { buildChecklist } from "@/lib/onboarding";
import { baseUrl } from "@/lib/slug";
import { useUiStore } from "@/store/ui-store";
import { useCurrentProject } from "@/store/use-project";

export default function ProjectHome() {
  const project = useCurrentProject();
  const progress = useUiStore((s) => s.progress[project.id]);
  const steps = buildChecklist(project, progress);
  const fieldCount = project.models.reduce((n, m) => n + m.fields.length, 0);
  const stats = [
    { label: "Models", value: project.models.length, href: `/projects/${project.id}/models` },
    { label: "Routes", value: project.routes.length, href: `/projects/${project.id}/routes` },
    { label: "Fields", value: fieldCount, href: `/projects/${project.id}/models` },
  ];

  return (
    <div className="space-y-8">
      <PageHeader title={project.name} description={project.description || "Your API at a glance."} />
      <div className="flex items-center gap-3 rounded-[10px] border bg-surface px-4 py-3">
        <span className="text-sm text-muted-foreground">Base URL</span>
        <code className="min-w-0 truncate font-mono text-sm">{baseUrl(project.slug)}</code>
        <CopyButton text={baseUrl(project.slug)} className="ml-auto" />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Link key={s.label} href={s.href} className="rounded-[10px] border bg-surface-2 p-5 transition-colors duration-150 hover:border-primary/50">
            <p className="text-sm text-muted-foreground">{s.label}</p>
            <p className="mt-1 text-3xl font-semibold">{s.value}</p>
          </Link>
        ))}
      </div>
      {steps.every((s) => s.done) ? (
        <Card>
          <CardContent className="flex items-center gap-3 py-6">
            <PartyPopper className="size-6 text-primary" />
            <div>
              <p className="font-medium">{"You're all set"}</p>
              <p className="text-sm text-muted-foreground">Your API has models, routes, tests and docs.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <OnboardingChecklist steps={steps} />
      )}
    </div>
  );
}
```

- [ ] **Step 9: Create `src/app/projects/[projectId]/settings/page.tsx`**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/domain/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { validateProjectName, validateSlug } from "@/lib/validation";
import { useProjectStore } from "@/store/project-store";
import { useCurrentProject } from "@/store/use-project";

export default function SettingsPage() {
  const project = useCurrentProject();
  const projects = useProjectStore((s) => s.projects);
  const updateProject = useProjectStore((s) => s.updateProject);
  const deleteProject = useProjectStore((s) => s.deleteProject);
  const restoreProject = useProjectStore((s) => s.restoreProject);
  const router = useRouter();
  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [slug, setSlug] = useState(project.slug);
  const [errors, setErrors] = useState<{ name?: string; slug?: string }>({});
  const [confirmOpen, setConfirmOpen] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const next = {
      name: validateProjectName(name, projects, project.id) ?? undefined,
      slug: validateSlug(slug, projects, project.id) ?? undefined,
    };
    setErrors(next);
    if (next.name || next.slug) return;
    await updateProject(project.id, { name: name.trim(), description: description.trim(), slug });
    toast.success("Settings saved");
  }

  async function remove() {
    setConfirmOpen(false);
    router.push("/projects");
    const snapshot = await deleteProject(project.id);
    toast(`${snapshot.name} deleted`, { action: { label: "Undo", onClick: () => void restoreProject(snapshot) } });
  }

  return (
    <div className="max-w-2xl space-y-8">
      <PageHeader title="Settings" description="Rename your API or change its address." />
      <form onSubmit={save} className="space-y-5 rounded-[10px] border bg-surface p-5">
        <div className="space-y-2">
          <Label htmlFor="settings-name">API name</Label>
          <Input id="settings-name" value={name} aria-invalid={!!errors.name} onChange={(e) => setName(e.target.value)} />
          {errors.name && <p role="alert" className="text-sm text-destructive">{errors.name}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="settings-description">Description</Label>
          <Textarea id="settings-description" value={description} maxLength={200} onChange={(e) => setDescription(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="settings-slug">Address</Label>
          <div className="flex items-center gap-2">
            <code className="font-mono text-sm text-muted-foreground">/api/</code>
            <Input id="settings-slug" className="font-mono" value={slug} aria-invalid={!!errors.slug} onChange={(e) => setSlug(e.target.value)} />
          </div>
          {errors.slug && <p role="alert" className="text-sm text-destructive">{errors.slug}</p>}
        </div>
        <div className="flex justify-end">
          <Button type="submit">Save settings</Button>
        </div>
      </form>

      <Card className="border-destructive/40">
        <CardHeader>
          <CardTitle className="text-destructive">Delete this API</CardTitle>
          <CardDescription>Removes its models, routes and docs. You can undo right after.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button variant="destructive" onClick={() => setConfirmOpen(true)}>
            Delete API
          </Button>
        </CardContent>
      </Card>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete {project.name}?</DialogTitle>
            <DialogDescription>Its models, routes and docs will be removed.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={remove}>
              Delete API
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 10: Run the full suite and lint**

Run: `npm test && npm run lint`
Expected: PASS, no lint errors.

- [ ] **Step 11: Check it in the browser**

Run: `npm run dev`.
Expected: Project Home shows the base URL with copy, 3 stat cards, and the checklist with the next step highlighted. ⌘K or Ctrl+K opens the palette, and typing "cust" jumps to Customer. In Settings, renaming saves; setting the address to another project's slug shows an inline error; deleting redirects to `/projects` with an Undo toast that restores the API.

- [ ] **Step 12: Commit**

```bash
git add -A
git commit -m "feat: add project home checklist, settings and command palette" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```

---

### Task 13: End-to-end journey test and final verification

**Files:**
- Create: `src/test/journey.test.ts`

**Interfaces:**
- Consumes: `useProjectStore`, `consoleService`, `buildCrudRoutes`, `buildDocs`, `setMockLatency`, `resetMockDatasets`.

- [ ] **Step 1: Write the journey test** — `src/test/journey.test.ts`

```ts
import { buildCrudRoutes } from "@/lib/crud";
import { buildDocs } from "@/lib/docs";
import { consoleService } from "@/lib/services";
import { resetMockDatasets } from "@/lib/services/mock/console-service";
import { setMockLatency } from "@/lib/services/mock/latency";
import { useProjectStore } from "@/store/project-store";

beforeEach(() => {
  setMockLatency(0);
  resetMockDatasets();
  useProjectStore.setState({ projects: [], loaded: false });
});

it("store template → add field → CRUD → 400 → 201 → list → docs", async () => {
  const store = useProjectStore.getState();
  const project = await store.createProject({ name: "My Store", description: "", templateId: "store" });
  const product = project.models.find((m) => m.name === "Product")!;

  await store.saveModel(project.id, {
    ...product,
    fields: [...product.fields, { id: "f-color", name: "color", type: "text", required: false, unique: false }],
  });
  const updatedProduct = useProjectStore.getState().projects[0].models.find((m) => m.id === product.id)!;
  expect(updatedProduct.fields.map((f) => f.name)).toContain("color");

  await store.addRoutes(project.id, buildCrudRoutes(updatedProduct, ["list", "get", "create", "update", "delete"], []));
  const current = useProjectStore.getState().projects[0];
  const create = current.routes.find((r) => r.action === "create")!;
  const list = current.routes.find((r) => r.action === "list")!;

  const bad = await consoleService.send(project.id, { routeId: create.id, params: {}, query: {}, body: { price: 10 } });
  expect(bad.status).toBe(400);
  const ok = await consoleService.send(project.id, {
    routeId: create.id, params: {}, query: {}, body: { name: "Lamp", price: 10, color: "red" },
  });
  expect(ok.status).toBe(201);
  const all = await consoleService.send(project.id, { routeId: list.id, params: {}, query: {}, body: undefined });
  expect((all.body as { data: { name: string }[] }).data.some((r) => r.name === "Lamp")).toBe(true);

  const productDocs = buildDocs(current).find((s) => s.title === "Product")!;
  expect(productDocs.endpoints).toHaveLength(5);
});
```

- [ ] **Step 2: Run the full test suite**

Run: `npm test`
Expected: every test file passes.

- [ ] **Step 3: Lint and build**

Run: `npm run lint && npm run build`
Expected: both succeed with no errors.

- [ ] **Step 4: Walk through the journey by hand**

Run: `npm run dev` and follow the spec's verification section:
1. Clear localStorage in DevTools, then open `/`. It redirects to `/projects` and shows the empty state.
2. Pick the Store template, finish the wizard, and land on Project Home, where the checklist reads 2 of 5.
3. Models → Product: add a `color` field and save. The CRUD banner appears. Create all 5 endpoints.
4. Test: `POST /products` without a name returns 400 and `'name' is required`. With name and price it returns 201. `GET /products` shows the new record.
5. Docs lists Product's 5 endpoints. Back on Home the checklist shows "You're all set".
6. Refresh the browser: the project and progress persist.
7. Toggle the theme in both directions. All surfaces switch, and the method badges stay readable in light mode.
8. Keyboard-only: complete the wizard and reorder a field with the arrow keys.
9. Run a Lighthouse accessibility audit on `/projects/<id>/models/<modelId>`. Aim for ≥ 95 and fix any contrast or label issues it lists.
10. Resize to 375px wide: the sidebar becomes the menu drawer and nothing scrolls horizontally except the tables.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "test: add end-to-end journey test" -m "Co-Authored-By: Claude Opus 5 (1M context) <noreply@anthropic.com>"
```
