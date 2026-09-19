# Paper & Ink Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dark sidebar-and-dialog UI with a light "paper & ink" design system and a single-canvas project workbench where models, fields and routes are created and edited inline.

**Architecture:** Tokens change in `globals.css` (Tailwind v4 `@theme inline`); shadcn's semantic variables (`--primary`, `--card`, `--border`, …) are remapped to the paper palette so the generated `src/components/ui/*` keep working. The project shell becomes top bar + breadcrumb + tabs. The Build page (`/projects/[id]`) renders an endpoint card and one `ResourceCard` per model with three inline panels (Fields, Routes, Data) that wrap the existing editors. Domain logic, services, stores and the mock engine are untouched except for one new pure helper (`generateAllCrud`).

**Tech Stack:** Next.js 16 App Router, React 19, Tailwind v4, shadcn/ui (Radix), Zustand, sonner, Vitest + React Testing Library. Fonts via `next/font/google`: JetBrains Mono (UI) and Pacifico (script).

**Spec:** `docs/superpowers/specs/2026-09-20-paper-and-ink-redesign.md` (visual system, screens, components). The original spec `docs/superpowers/specs/2026-09-19-universal-api-ui-design.md` still governs behaviour (validation messages, mock engine, undo).

## Global Constraints

- Light only. `next-themes`, `ThemeProvider`, `ThemeToggle` and every `dark:` class are removed.
- Palette (exact): paper `#F7F7F4`, grid-line `#E9E9E4`, card `#FFFFFF`, ink `#18181B`, ink-muted `#6B6B72`, line `#E4E4DF`, sketch `#C9C9C2`, primary `#3B5BDB`, soft `#EEEEEA`, soft-hover `#E4E4DF`, danger `#E5484D`, success `#2F9E62`, warning `#D97706`. Pastels (fill / text): blue `#DCE6FF`/`#2B4ACB`, violet `#E9DDFF`/`#6B3FD1`, peach `#FFE4D1`/`#B4520E`, mint `#D8F5E3`/`#1F7A48`, lavender `#E6E0FF`/`#5A3EBF`, rose `#FFDCDF`/`#B3262E`, lemon `#FFF3C4`/`#8A6100`.
- Method chips: GET mint, POST blue, PUT peach, PATCH lavender, DELETE rose. URL segments: `/api` blue, `/{slug}` violet, `/:param` peach. Field-type chips lemon.
- Grid paper: `body` background = two 1px `linear-gradient` lines, `background-size: 32px 32px`.
- Type: JetBrains Mono for all UI (`--font-sans` and `--font-mono` both point at it); Pacifico only via the `font-script` utility.
- Radius: buttons/inputs 12px, cards 16px (`rounded-2xl`), chips `rounded-full`. Card shadow token `shadow-card` = `0 1px 2px rgb(24 24 27 / 4%), 0 8px 24px rgb(24 24 27 / 6%)`. Sketch cards: `1.5px dashed` sketch colour, solid + card shadow on hover.
- Motion: 150ms hover/press, 200ms panels; `prefers-reduced-motion` respected (already in globals.css).
- No dialogs for create/edit/delete flows. Dropdown menus and the ⌘K search dialog are allowed. Deletes use Undo toasts (models, routes) or the two-step button (project).
- All data access via `@/lib/services`; components never import `src/lib/services/mock/*`. Every user-triggered awaited store/service call is wrapped in try/catch and surfaces `toast.error(e instanceof Error ? e.message : "<plain-language fallback>.")`.
- URLs kept: `/projects`, `/projects/new` → redirect to `/projects`, `/projects/[id]`, `/projects/[id]/console`, `/projects/[id]/docs`, `/projects/[id]/settings`. `/projects/[id]/models/*` and `/projects/[id]/routes/*` are deleted.
- JSX text containing `'` or `"` is wrapped in `{"..."}`.
- Before every commit: `npm test`, `npm run lint`, `npm run build` all clean; test output pristine.
- Commit trailer: `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>` (or the model actually doing the work).

**Refinements of the spec decided while planning:**
1. `shell/nav-items.ts` is kept (Build/Test/Docs) and shared by the tabs and the ⌘K palette instead of being deleted.
2. The top bar's Docs link appears only inside a project (links to that project's docs). On `/projects` it is hidden.
3. Existing `bg-surface` / `bg-surface-2` classes keep working: they are remapped to soft/card so restyling is mostly a token change plus a sweep of `rounded-[10px]` → `rounded-2xl`.
4. ⌘K "Models" entries open `/projects/[id]?model=<modelId>` (the Build page opens that card's Fields panel); "Routes" entries open the Test console with the route selected.

---

## File Map

```
src/app/globals.css                              tokens rewritten (paper palette, grid, fonts, radii, shadow)
src/app/layout.tsx                               fonts: JetBrains Mono + Pacifico; no ThemeProvider
src/app/projects/page.tsx                        rewritten (NewProjectCard + cards)
src/app/projects/new/page.tsx                    redirect("/projects")
src/app/projects/[projectId]/layout.tsx          simplified loading state
src/app/projects/[projectId]/page.tsx            Build workbench (rewritten)
src/app/projects/[projectId]/{console,docs,settings}/page.tsx   restyled; settings uses TwoStepButton
src/components/domain/{wordmark,url-segments,sketch-card,two-step-button,type-chip}.tsx   new
src/components/domain/method-badge.tsx           restyled
src/components/shell/{breadcrumb,project-tabs,project-menu}.tsx   new
src/components/shell/{top-bar,project-shell,dashboard-header,nav-items,command-palette}.tsx  rewritten
src/components/dashboard/new-project-card.tsx    new (+test)
src/components/build/{getting-started-strip,endpoint-card,resource-card,resource-fields-panel,resource-routes-panel,resource-data-panel,route-list,new-model-card,other-routes-card}.tsx   new
src/lib/crud.ts                                  + generateAllCrud
src/lib/methods.ts                               pastel chip classes
src/store/ui-store.ts                            sidebar state removed
DELETED: theme-provider.tsx, theme-toggle(.test).tsx, shell/app-sidebar(.test).tsx, shell/project-switcher.tsx, shell/logo.tsx,
         dashboard/create-project-wizard(.test).tsx, models/{new-model-dialog,model-list,model-editor}.tsx,
         routes/{crud-generator-dialog(.test),crud-banner,route-row}.tsx, home/onboarding-checklist(.test).tsx,
         app/projects/[projectId]/models/**, app/projects/[projectId]/routes/**
```

---

### Task 1: Paper tokens, fonts, theming removal, shared primitives

**Files:**
- Modify: `src/app/globals.css`, `src/app/layout.tsx`, `src/lib/methods.ts`, `src/components/domain/method-badge.tsx`, `src/store/ui-store.ts`, `package.json` (remove next-themes)
- Delete: `src/components/theme-provider.tsx`, `src/components/theme-toggle.tsx`, `src/components/theme-toggle.test.tsx`
- Create: `src/components/domain/wordmark.tsx`, `src/components/domain/sketch-card.tsx`, `src/components/domain/two-step-button.tsx`, `src/components/domain/url-segments.tsx`, `src/components/domain/type-chip.tsx`
- Test: `src/components/domain/two-step-button.test.tsx`, `src/components/domain/url-segments.test.tsx`

**Interfaces:**
- Produces: Tailwind utilities `bg-paper`, `bg-card`, `bg-soft`, `bg-soft-hover`, `text-ink`, `text-ink-muted`, `border-line`, `border-sketch`, `shadow-card`, `font-script`, and pastel utilities `bg-pastel-{blue|violet|peach|mint|lavender|rose|lemon}` / `text-pastel-{…}-ink`. Legacy `bg-surface` (= soft), `bg-surface-2` (= card), `text-success`, `text-warning` keep working.
- `<Wordmark />`, `<SketchCard className? {...div props} />`, `<TwoStepButton label confirmLabel onConfirm variant?="danger"|"secondary" className? disabled? />`, `<UrlSegments slug tail? />`, `<TypeChip type />`, `<MethodBadge method showLabel? tooltip? className? />` (unchanged API).
- `useUiStore` no longer has `sidebarCollapsed` / `toggleSidebar`.

- [ ] **Step 1: Write the failing tests**

`src/components/domain/two-step-button.test.tsx`:
```tsx
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TwoStepButton } from "./two-step-button";

it("asks for confirmation on the first click and confirms on the second", async () => {
  const user = userEvent.setup();
  const onConfirm = vi.fn();
  render(<TwoStepButton label="Delete API" confirmLabel="Sure? Delete" onConfirm={onConfirm} />);
  await user.click(screen.getByRole("button", { name: "Delete API" }));
  expect(screen.getByRole("button", { name: "Sure? Delete" })).toBeInTheDocument();
  expect(onConfirm).not.toHaveBeenCalled();
  await user.click(screen.getByRole("button", { name: "Sure? Delete" }));
  expect(onConfirm).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("button", { name: "Delete API" })).toBeInTheDocument();
});

it("disarms after three seconds", async () => {
  vi.useFakeTimers();
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  render(<TwoStepButton label="Delete" confirmLabel="Sure?" onConfirm={vi.fn()} />);
  await user.click(screen.getByRole("button", { name: "Delete" }));
  act(() => vi.advanceTimersByTime(3100));
  expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  vi.useRealTimers();
});
```

`src/components/domain/url-segments.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { UrlSegments } from "./url-segments";

it("renders the base URL as coloured segments", () => {
  render(<UrlSegments slug="my-store" tail="/:resource" />);
  expect(screen.getByText("/api")).toHaveClass("bg-pastel-blue");
  expect(screen.getByText("/my-store")).toHaveClass("bg-pastel-violet");
  expect(screen.getByText("/:resource")).toHaveClass("bg-pastel-peach");
  expect(screen.getByRole("group", { name: "API address" })).toHaveTextContent("/api/my-store/:resource");
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `npm test -- src/components/domain/two-step-button.test.tsx src/components/domain/url-segments.test.tsx`
Expected: FAIL with unresolved imports.

- [ ] **Step 3: Replace `src/app/globals.css`**

Keep the first three `@import` lines exactly as they are in the file today. Replace everything after them with:

```css
@theme inline {
  --font-sans: var(--font-jetbrains-mono);
  --font-mono: var(--font-jetbrains-mono);
  --font-script: var(--font-pacifico);

  --color-paper: #f7f7f4;
  --color-grid-line: #e9e9e4;
  --color-ink: #18181b;
  --color-ink-muted: #6b6b72;
  --color-line: #e4e4df;
  --color-sketch: #c9c9c2;
  --color-soft: #eeeeea;
  --color-soft-hover: #e4e4df;

  --color-pastel-blue: #dce6ff;
  --color-pastel-blue-ink: #2b4acb;
  --color-pastel-violet: #e9ddff;
  --color-pastel-violet-ink: #6b3fd1;
  --color-pastel-peach: #ffe4d1;
  --color-pastel-peach-ink: #b4520e;
  --color-pastel-mint: #d8f5e3;
  --color-pastel-mint-ink: #1f7a48;
  --color-pastel-lavender: #e6e0ff;
  --color-pastel-lavender-ink: #5a3ebf;
  --color-pastel-rose: #ffdcdf;
  --color-pastel-rose-ink: #b3262e;
  --color-pastel-lemon: #fff3c4;
  --color-pastel-lemon-ink: #8a6100;

  /* shadcn semantic tokens, mapped to the paper palette */
  --color-background: var(--color-paper);
  --color-foreground: var(--color-ink);
  --color-surface: var(--color-soft);
  --color-surface-2: #ffffff;
  --color-card: #ffffff;
  --color-card-foreground: var(--color-ink);
  --color-popover: #ffffff;
  --color-popover-foreground: var(--color-ink);
  --color-primary: #3b5bdb;
  --color-primary-foreground: #ffffff;
  --color-secondary: var(--color-soft);
  --color-secondary-foreground: var(--color-ink);
  --color-muted: var(--color-soft);
  --color-muted-foreground: var(--color-ink-muted);
  --color-accent: var(--color-soft);
  --color-accent-foreground: var(--color-ink);
  --color-destructive: #e5484d;
  --color-success: #2f9e62;
  --color-warning: #d97706;
  --color-border: var(--color-line);
  --color-input: var(--color-line);
  --color-ring: #3b5bdb;

  --radius-sm: 8px;
  --radius-md: 10px;
  --radius-lg: 12px;
  --radius-xl: 16px;

  --shadow-card: 0 1px 2px rgb(24 24 27 / 4%), 0 8px 24px rgb(24 24 27 / 6%);
}

@layer base {
  * {
    @apply border-border outline-ring/50;
  }
  body {
    @apply bg-paper font-sans text-ink antialiased;
    background-image:
      linear-gradient(to right, var(--color-grid-line) 1px, transparent 1px),
      linear-gradient(to bottom, var(--color-grid-line) 1px, transparent 1px);
    background-size: 32px 32px;
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

Remove the `@custom-variant dark` line and the old `:root` / `.dark` blocks entirely.

- [ ] **Step 4: Replace `src/app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import { JetBrains_Mono, Pacifico } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains-mono" });
const script = Pacifico({ subsets: ["latin"], weight: "400", variable: "--font-pacifico" });

export const metadata: Metadata = {
  title: "Universal API",
  description: "Build an API without writing code",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${mono.variable} ${script.variable}`}>
      <body>
        <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
        <Toaster />
      </body>
    </html>
  );
}
```

- [ ] **Step 5: Remove theming**

```bash
git rm -q src/components/theme-provider.tsx src/components/theme-toggle.tsx src/components/theme-toggle.test.tsx
npm uninstall next-themes
```
`src/components/shell/top-bar.tsx`, `dashboard-header.tsx` and `command-palette.tsx` still import `ThemeToggle`/`next-themes`; Task 2 rewrites them. Until then the build is red — that is expected inside this task only if you commit Tasks 1 and 2 together; otherwise, in this task, apply the minimal edits: delete the `<ThemeToggle />` lines and their imports from `top-bar.tsx` and `dashboard-header.tsx`, and in `command-palette.tsx` delete the `useTheme` import, the `const { resolvedTheme, setTheme } = useTheme();` line, the `SunMoon` import and the whole "Toggle theme" `CommandItem`.

- [ ] **Step 6: Update `src/lib/methods.ts` chip classes**

Replace the `className` values only:
```ts
GET:    className: "bg-pastel-mint text-pastel-mint-ink",
POST:   className: "bg-pastel-blue text-pastel-blue-ink",
PUT:    className: "bg-pastel-peach text-pastel-peach-ink",
PATCH:  className: "bg-pastel-lavender text-pastel-lavender-ink",
DELETE: className: "bg-pastel-rose text-pastel-rose-ink",
```

- [ ] **Step 7: Restyle `src/components/domain/method-badge.tsx`**

Replace the badge's class string with:
```tsx
"inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide"
```
and the label span's class with `"font-medium opacity-80"` (drop `font-sans`).

- [ ] **Step 8: Trim `src/store/ui-store.ts`**

Remove `sidebarCollapsed` and `toggleSidebar` from the interface and the store, and set `partialize: (s) => ({ progress: s.progress })`.

- [ ] **Step 9: Create the primitives**

`src/components/domain/wordmark.tsx`:
```tsx
import Link from "next/link";

export function Wordmark() {
  return (
    <Link href="/projects" className="font-script text-2xl leading-none text-ink" aria-label="Universal API home">
      universal
    </Link>
  );
}
```

`src/components/domain/sketch-card.tsx`:
```tsx
import { cn } from "@/lib/utils";

export function SketchCard({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border-[1.5px] border-dashed border-sketch transition-all duration-150 hover:border-solid hover:border-line hover:bg-card hover:shadow-card",
        className,
      )}
      {...props}
    />
  );
}
```

`src/components/domain/two-step-button.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  label: string;
  confirmLabel: string;
  onConfirm: () => void;
  variant?: "danger" | "secondary";
  className?: string;
  disabled?: boolean;
}

const DISARM_MS = 3000;

export function TwoStepButton({ label, confirmLabel, onConfirm, variant = "danger", className, disabled }: Props) {
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), DISARM_MS);
    return () => clearTimeout(t);
  }, [armed]);

  return (
    <Button
      type="button"
      variant="secondary"
      disabled={disabled}
      aria-live="polite"
      className={cn(
        variant === "danger" && "bg-pastel-rose text-pastel-rose-ink hover:bg-pastel-rose/80",
        armed && variant === "danger" && "bg-destructive text-white hover:bg-destructive/90",
        className,
      )}
      onClick={() => {
        if (!armed) {
          setArmed(true);
          return;
        }
        setArmed(false);
        onConfirm();
      }}
    >
      {armed ? confirmLabel : label}
    </Button>
  );
}
```

`src/components/domain/url-segments.tsx`:
```tsx
import { cn } from "@/lib/utils";

interface Props {
  slug: string;
  tail?: string;
  className?: string;
}

const PILL = "rounded-md px-1.5 py-0.5 font-semibold";

export function UrlSegments({ slug, tail, className }: Props) {
  return (
    <span role="group" aria-label="API address" className={cn("inline-flex flex-wrap items-center gap-1 font-mono text-sm", className)}>
      <span className={cn(PILL, "bg-pastel-blue text-pastel-blue-ink")}>/api</span>
      <span className={cn(PILL, "bg-pastel-violet text-pastel-violet-ink")}>/{slug}</span>
      {tail && <span className={cn(PILL, "bg-pastel-peach text-pastel-peach-ink")}>{tail}</span>}
    </span>
  );
}
```

`src/components/domain/type-chip.tsx`:
```tsx
import { fieldTypeMeta } from "@/lib/field-types";
import type { FieldType } from "@/lib/types";

export function TypeChip({ type }: { type: FieldType }) {
  const meta = fieldTypeMeta(type);
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-pastel-lemon px-2 py-0.5 text-[11px] font-semibold text-pastel-lemon-ink">
      <span aria-hidden>{meta.icon}</span>
      {meta.label}
    </span>
  );
}
```

- [ ] **Step 10: Run the tests, then the full checks**

Run: `npm test -- src/components/domain` → PASS. Then `npm test && npm run lint && npm run build` → all clean (the sidebar test still passes because `app-sidebar.tsx` is untouched until Task 2).

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: paper & ink tokens, fonts and shared primitives; drop dark theme" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Shell — top bar, breadcrumb, tabs, project menu, palette

**Files:**
- Create: `src/components/shell/breadcrumb.tsx`, `src/components/shell/project-tabs.tsx`, `src/components/shell/project-menu.tsx`
- Rewrite: `src/components/shell/nav-items.ts`, `src/components/shell/top-bar.tsx`, `src/components/shell/project-shell.tsx`, `src/components/shell/dashboard-header.tsx`, `src/components/shell/command-palette.tsx`, `src/app/projects/[projectId]/layout.tsx`
- Delete: `src/components/shell/app-sidebar.tsx`, `src/components/shell/app-sidebar.test.tsx`, `src/components/shell/project-switcher.tsx`, `src/components/shell/logo.tsx`
- Test: `src/components/shell/project-tabs.test.tsx`, `src/components/shell/project-menu.test.tsx`; update `src/components/shell/command-palette.test.tsx` (the existing assertions still hold; just ensure it passes)

**Interfaces:**
- Consumes: `Wordmark`, `UrlSegments`, `useUiStore.setCommandOpen`, `useProjectStore.{deleteProject, restoreProject}`, `consoleService.reset`.
- Produces: `PROJECT_NAV` = Build (`""`), Test (`"console"`), Docs (`"docs"`); `navHref`, `isNavActive` unchanged; `<TopBar docsHref? showSearch? />`; `<Breadcrumb project />`; `<ProjectTabs projectId />`; `<ProjectMenu project />`; `<ProjectShell project>{children}</ProjectShell>`; `<DashboardHeader />`.

- [ ] **Step 1: Write the failing tests**

`src/components/shell/project-tabs.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { usePathname } from "next/navigation";
import { ProjectTabs } from "./project-tabs";

it("renders Build, Test and Docs tabs and marks the active one", () => {
  vi.mocked(usePathname).mockReturnValue("/projects/p1/console");
  render(<ProjectTabs projectId="p1" />);
  expect(screen.getByRole("link", { name: "Build" })).toHaveAttribute("href", "/projects/p1");
  expect(screen.getByRole("link", { name: "Test" })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("link", { name: "Docs" })).toHaveAttribute("href", "/projects/p1/docs");
});
```

`src/components/shell/project-menu.test.tsx`:
```tsx
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Project } from "@/lib/types";
import { useProjectStore } from "@/store/project-store";
import { renderUi } from "@/test/render";
import { ProjectMenu } from "./project-menu";

const project: Project = {
  id: "p1", name: "Store", slug: "store", description: "", models: [], routes: [], createdAt: "", updatedAt: "",
};

it("needs two clicks to delete the project", async () => {
  const user = userEvent.setup();
  const deleteProject = vi.fn().mockResolvedValue(project);
  useProjectStore.setState({ deleteProject } as never);
  renderUi(<ProjectMenu project={project} />);
  await user.click(screen.getByRole("button", { name: "Project actions" }));
  expect(await screen.findByRole("menuitem", { name: "Settings" })).toBeInTheDocument();
  await user.click(screen.getByRole("menuitem", { name: "Delete project" }));
  expect(deleteProject).not.toHaveBeenCalled();
  await user.click(screen.getByRole("menuitem", { name: "Sure? Delete" }));
  expect(deleteProject).toHaveBeenCalledWith("p1");
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `npm test -- src/components/shell` → FAIL with unresolved imports.

- [ ] **Step 3: Rewrite `src/components/shell/nav-items.ts`**

```ts
import { BookOpen, Hammer, Play, type LucideIcon } from "lucide-react";

export interface NavItem {
  segment: string;
  label: string;
  icon: LucideIcon;
}

export const PROJECT_NAV: NavItem[] = [
  { segment: "", label: "Build", icon: Hammer },
  { segment: "console", label: "Test", icon: Play },
  { segment: "docs", label: "Docs", icon: BookOpen },
];

export function navHref(projectId: string, segment: string): string {
  return segment ? `/projects/${projectId}/${segment}` : `/projects/${projectId}`;
}

export function isNavActive(pathname: string, projectId: string, segment: string): boolean {
  const href = navHref(projectId, segment);
  return segment ? pathname.startsWith(href) : pathname === href;
}
```

- [ ] **Step 4: Create `src/components/shell/project-tabs.tsx`**

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { PROJECT_NAV, isNavActive, navHref } from "./nav-items";

export function ProjectTabs({ projectId }: { projectId: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Project sections" className="flex flex-wrap gap-1">
      {PROJECT_NAV.map(({ segment, label, icon: Icon }) => {
        const active = isNavActive(pathname, projectId, segment);
        return (
          <Link
            key={label}
            href={navHref(projectId, segment)}
            aria-current={active ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm text-ink-muted transition-colors duration-150 hover:bg-soft hover:text-ink",
              active && "bg-soft font-semibold text-ink",
            )}
          >
            <Icon className="size-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 5: Create `src/components/shell/project-menu.tsx`**

```tsx
"use client";

import { MoreVertical, RotateCcw, Settings, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { consoleService } from "@/lib/services";
import type { Project } from "@/lib/types";
import { useProjectStore } from "@/store/project-store";

export function ProjectMenu({ project }: { project: Project }) {
  const [armed, setArmed] = useState(false);
  const deleteProject = useProjectStore((s) => s.deleteProject);
  const restoreProject = useProjectStore((s) => s.restoreProject);
  const router = useRouter();

  async function resetData() {
    try {
      await consoleService.reset(project.id);
      toast("Sample data reset");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reset the sample data.");
    }
  }

  async function remove() {
    setArmed(false);
    try {
      const snapshot = await deleteProject(project.id);
      router.push("/projects");
      toast(`${snapshot.name} deleted`, {
        action: {
          label: "Undo",
          onClick: () =>
            void restoreProject(snapshot).catch((e) => toast.error(e instanceof Error ? e.message : "Could not undo.")),
        },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete the API.");
    }
  }

  return (
    <DropdownMenu onOpenChange={(open) => !open && setArmed(false)}>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="icon" aria-label="Project actions" className="rounded-xl">
          <MoreVertical className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 rounded-2xl">
        <DropdownMenuItem asChild>
          <Link href={`/projects/${project.id}/settings`}>
            <Settings className="size-4" /> Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={resetData}>
          <RotateCcw className="size-4" /> Reset sample data
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="text-destructive focus:text-destructive"
          onSelect={(e) => {
            if (!armed) {
              e.preventDefault();
              setArmed(true);
              return;
            }
            void remove();
          }}
        >
          <Trash2 className="size-4" /> {armed ? "Sure? Delete" : "Delete project"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

- [ ] **Step 6: Create `src/components/shell/breadcrumb.tsx`**

```tsx
import Link from "next/link";
import type { Project } from "@/lib/types";
import { ProjectMenu } from "./project-menu";

export function Breadcrumb({ project }: { project: Project }) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <Link href="/projects" className="text-primary hover:underline">
        Projects
      </Link>
      <span className="text-ink-muted">/</span>
      <span className="flex size-8 items-center justify-center rounded-lg bg-pastel-violet font-semibold text-pastel-violet-ink">
        {project.name.charAt(0).toUpperCase()}
      </span>
      <h1 className="truncate text-base font-semibold">{project.name}</h1>
      <ProjectMenu project={project} />
    </div>
  );
}
```

- [ ] **Step 7: Rewrite `src/components/shell/top-bar.tsx`**

```tsx
"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { Wordmark } from "@/components/domain/wordmark";
import { Button } from "@/components/ui/button";
import { useUiStore } from "@/store/ui-store";
import { UserAvatar } from "./user-avatar";

interface Props {
  docsHref?: string;
  showSearch?: boolean;
}

export function TopBar({ docsHref, showSearch = false }: Props) {
  const setCommandOpen = useUiStore((s) => s.setCommandOpen);
  return (
    <header className="mx-auto flex h-16 max-w-[1180px] items-center justify-between px-4 md:px-8">
      <Wordmark />
      <div className="flex items-center gap-2">
        {showSearch && (
          <Button variant="secondary" size="sm" className="gap-2 rounded-xl text-ink-muted" onClick={() => setCommandOpen(true)}>
            <Search className="size-4" />
            <span className="hidden sm:inline">Search</span>
            <kbd className="rounded-md bg-card px-1.5 text-[10px]">⌘K</kbd>
          </Button>
        )}
        {docsHref && (
          <Link href={docsHref} className="rounded-xl px-3 py-1.5 text-sm hover:bg-soft">
            Docs
          </Link>
        )}
        <UserAvatar />
      </div>
    </header>
  );
}
```

- [ ] **Step 8: Rewrite `project-shell.tsx` and `dashboard-header.tsx`**

`src/components/shell/project-shell.tsx`:
```tsx
"use client";

import type { Project } from "@/lib/types";
import { Breadcrumb } from "./breadcrumb";
import { CommandPalette } from "./command-palette";
import { ProjectTabs } from "./project-tabs";
import { TopBar } from "./top-bar";

export function ProjectShell({ project, children }: { project: Project; children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <TopBar showSearch docsHref={`/projects/${project.id}/docs`} />
      <div className="mx-auto max-w-[1180px] px-4 md:px-8">
        <div className="flex flex-col gap-4 pb-6 sm:flex-row sm:items-center sm:justify-between">
          <Breadcrumb project={project} />
          <ProjectTabs projectId={project.id} />
        </div>
        <main className="pb-16">{children}</main>
      </div>
      <CommandPalette project={project} />
    </div>
  );
}
```

`src/components/shell/dashboard-header.tsx`:
```tsx
import { TopBar } from "./top-bar";

export function DashboardHeader() {
  return <TopBar />;
}
```

- [ ] **Step 9: Update `src/components/shell/command-palette.tsx`**

Apply these edits:
- Remove the `useTheme` import, the `resolvedTheme/setTheme` line, the `SunMoon` import and the "Toggle theme" item (if not already done in Task 1).
- Add `import { Settings } from "lucide-react";` (merge with the existing lucide import) and, in the "Pages" group after the `PROJECT_NAV` map, add:
  ```tsx
  <CommandItem value="page Settings" onSelect={() => go(`/projects/${project.id}/settings`)}>
    <Settings className="size-4" /> Settings
  </CommandItem>
  ```
- Models: `onSelect={() => go(`/projects/${project.id}?model=${m.id}`)}`.
- Routes: `onSelect={() => go(`/projects/${project.id}/console?route=${r.id}`)}`.
- Add `className="rounded-2xl"` to `CommandDialog` if it accepts `className`; otherwise leave it.

- [ ] **Step 10: Simplify `src/app/projects/[projectId]/layout.tsx`**

Replace the loading branch with:
```tsx
if (!loaded) {
  return (
    <div className="mx-auto max-w-[1180px] space-y-4 p-8">
      <Skeleton className="h-8 w-48 rounded-xl" />
      <Skeleton className="h-40 w-full rounded-2xl" />
    </div>
  );
}
```
Keep the not-found branch and the `ProjectShell` return.

- [ ] **Step 11: Delete the old shell files**

```bash
git rm -q src/components/shell/app-sidebar.tsx src/components/shell/app-sidebar.test.tsx src/components/shell/project-switcher.tsx src/components/shell/logo.tsx
```

- [ ] **Step 12: Run tests and checks**

Run: `npm test -- src/components/shell` → PASS. Then `npm test && npm run lint && npm run build` → clean.

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "feat: paper shell with breadcrumb, tabs and project menu; remove sidebar" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Projects page with inline New project card

**Files:**
- Create: `src/components/dashboard/new-project-card.tsx`
- Rewrite: `src/app/projects/page.tsx`, `src/app/projects/new/page.tsx`, `src/components/domain/project-card.tsx`
- Delete: `src/components/dashboard/create-project-wizard.tsx`, `src/components/dashboard/create-project-wizard.test.tsx`, `src/components/domain/template-card.tsx`
- Test: `src/components/dashboard/new-project-card.test.tsx`; update `src/components/domain/project-card.test.tsx` if its assertions break (they should still pass)

**Interfaces:**
- Consumes: `SketchCard`, `TEMPLATES`, `validateProjectName`, `slugify`, `baseUrl`, `useProjectStore.createProject`, `useProjects`.
- Produces: `<NewProjectCard existingProjects onCreate(input: CreateProjectInput) autoFocus? />`.

- [ ] **Step 1: Write the failing test** — `src/components/dashboard/new-project-card.test.tsx`

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NewProjectCard } from "./new-project-card";

it("creates an API from a template", async () => {
  const user = userEvent.setup();
  const onCreate = vi.fn().mockResolvedValue(undefined);
  render(<NewProjectCard existingProjects={[]} onCreate={onCreate} />);
  await user.type(screen.getByLabelText("New API name"), "My Store");
  expect(screen.getByText("/my-store")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: /Store/ }));
  await user.click(screen.getByRole("button", { name: "Create" }));
  expect(onCreate).toHaveBeenCalledWith({ name: "My Store", description: "", templateId: "store" });
});

it("shows validation inline", async () => {
  const user = userEvent.setup();
  const onCreate = vi.fn();
  render(<NewProjectCard existingProjects={[]} onCreate={onCreate} />);
  await user.click(screen.getByRole("button", { name: "Create" }));
  expect(screen.getByRole("alert")).toHaveTextContent("Give your API a name.");
  expect(onCreate).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `npm test -- src/components/dashboard/new-project-card.test.tsx` → FAIL, unresolved import.

- [ ] **Step 3: Create `src/components/dashboard/new-project-card.tsx`**

```tsx
"use client";

import { useState } from "react";
import { SketchCard } from "@/components/domain/sketch-card";
import { UrlSegments } from "@/components/domain/url-segments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CreateProjectInput } from "@/lib/services";
import { slugify } from "@/lib/slug";
import { TEMPLATES } from "@/lib/templates";
import type { Project, TemplateId } from "@/lib/types";
import { cn } from "@/lib/utils";
import { validateProjectName } from "@/lib/validation";

interface Props {
  existingProjects: Project[];
  onCreate: (input: CreateProjectInput) => Promise<void>;
  autoFocus?: boolean;
}

const CHIP = "rounded-full border px-3 py-1 text-xs transition-colors duration-150 hover:bg-soft";

export function NewProjectCard({ existingProjects, onCreate, autoFocus }: Props) {
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState<TemplateId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const err = validateProjectName(name, existingProjects);
    setError(err);
    if (err) return;
    setSubmitting(true);
    try {
      await onCreate({ name: name.trim(), description: "", templateId });
      setName("");
      setTemplateId(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the API.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SketchCard className="p-5">
      <form onSubmit={submit} className="flex h-full flex-col gap-3">
        <label htmlFor="new-project-name" className="text-sm font-semibold">
          New API
        </label>
        <Input
          id="new-project-name"
          aria-label="New API name"
          autoFocus={autoFocus}
          value={name}
          placeholder="My Store"
          aria-invalid={!!error}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
        />
        <UrlSegments slug={slugify(name) || "your-api"} className="text-xs" />
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Starting point">
          <button type="button" aria-pressed={templateId === null} onClick={() => setTemplateId(null)} className={cn(CHIP, templateId === null && "border-primary bg-pastel-blue text-pastel-blue-ink")}>
            Blank
          </button>
          {TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              aria-pressed={templateId === t.id}
              onClick={() => setTemplateId(t.id)}
              className={cn(CHIP, templateId === t.id && "border-primary bg-pastel-blue text-pastel-blue-ink")}
            >
              <span aria-hidden>{t.emoji} </span>
              {t.name}
            </button>
          ))}
        </div>
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
        <Button type="submit" disabled={submitting} className="mt-auto self-start rounded-xl">
          {submitting ? "Creating…" : "Create"}
        </Button>
      </form>
    </SketchCard>
  );
}
```

- [ ] **Step 4: Run the test** → PASS.

- [ ] **Step 5: Restyle `src/components/domain/project-card.tsx`**

Change the outer `Link` classes to `"flex flex-col rounded-2xl border bg-card p-5 shadow-card transition-transform duration-150 hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-ring"` and the initial tile to `"flex size-9 shrink-0 items-center justify-center rounded-lg bg-pastel-violet font-semibold text-pastel-violet-ink"`. Everything else stays.

- [ ] **Step 6: Rewrite `src/app/projects/page.tsx`**

```tsx
"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { NewProjectCard } from "@/components/dashboard/new-project-card";
import { ProjectCard } from "@/components/domain/project-card";
import { DashboardHeader } from "@/components/shell/dashboard-header";
import { Skeleton } from "@/components/ui/skeleton";
import { countLabel } from "@/lib/format";
import type { CreateProjectInput } from "@/lib/services";
import { useProjectStore } from "@/store/project-store";
import { useProjects } from "@/store/use-project";

export default function ProjectsPage() {
  const { projects, loaded } = useProjects();
  const createProject = useProjectStore((s) => s.createProject);
  const router = useRouter();

  async function create(input: CreateProjectInput) {
    const project = await createProject(input);
    toast.success(`${project.name} is ready`);
    router.push(`/projects/${project.id}`);
  }

  return (
    <div className="min-h-screen">
      <DashboardHeader />
      <main className="mx-auto max-w-[1180px] px-4 py-6 md:px-8">
        {!loaded ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-44 rounded-2xl" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="mx-auto max-w-md space-y-6 pt-10 text-center">
            <h1 className="font-script text-4xl">{"Let's make an API"}</h1>
            <p className="text-sm text-ink-muted">Name it, pick a starting point, and we build the endpoints for you.</p>
            <div className="text-left">
              <NewProjectCard existingProjects={projects} onCreate={create} autoFocus />
            </div>
          </div>
        ) : (
          <>
            <h1 className="mb-4 text-xl font-semibold">
              Your APIs <span className="text-ink-muted">· {countLabel(projects.length, "API")}</span>
            </h1>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <NewProjectCard existingProjects={projects} onCreate={create} />
              {projects.map((p) => (
                <ProjectCard key={p.id} project={p} />
              ))}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
```

- [ ] **Step 7: Make `/projects/new` redirect** — `src/app/projects/new/page.tsx`:

```tsx
import { redirect } from "next/navigation";

export default function NewProjectPage() {
  redirect("/projects");
}
```

- [ ] **Step 8: Delete the wizard and template card**

```bash
git rm -q src/components/dashboard/create-project-wizard.tsx src/components/dashboard/create-project-wizard.test.tsx src/components/domain/template-card.tsx
```

- [ ] **Step 9: Full checks** — `npm test && npm run lint && npm run build` → clean.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: inline new-project card replaces the wizard" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: `generateAllCrud`, endpoint card, getting-started strip, route list

**Files:**
- Modify: `src/lib/crud.ts`; Test: `src/lib/crud.test.ts` (append)
- Create: `src/components/build/endpoint-card.tsx`, `src/components/build/getting-started-strip.tsx`, `src/components/build/route-list.tsx`
- Test: `src/components/build/route-list.test.tsx`

**Interfaces:**
- Consumes: `buildCrudRoutes`, `buildChecklist`/`ChecklistStep`, `UrlSegments`, `CopyButton`, `MethodBadge`, `RouteEditor` (props `{ project, route, onSave }`), `useProjectStore.{saveRoute, deleteRoute, restoreRoute}`, `routeParams`.
- Produces: `generateAllCrud(project): Route[]`; `<EndpointCard project onNewModel onGenerateAll onResetData generateCount />`; `<GettingStartedStrip steps />`; `<RouteList project routes />` (rows with Edit (inline editor), Test link, delete + undo).

- [ ] **Step 1: Write the failing tests**

Append to `src/lib/crud.test.ts`:
```ts
import { generateAllCrud } from "./crud";
import { buildTemplateModels } from "./templates";

it("generates every missing standard endpoint across models, in canonical order", () => {
  const models = buildTemplateModels("store");
  const product = models[0];
  const existing = buildCrudRoutes(product, ["list"], []);
  const project = { models, routes: existing } as Project;
  const routes = generateAllCrud(project);
  expect(routes).toHaveLength(14);
  expect(routes.slice(0, 4).map((r) => r.action)).toEqual(["get", "create", "update", "delete"]);
  expect(routes.every((r) => models.some((m) => m.id === r.modelId))).toBe(true);
  expect(generateAllCrud({ models, routes: [...existing, ...routes] } as Project)).toEqual([]);
});
```
(`buildCrudRoutes`, `Model`, `Project` are already imported at the top of that file; add `generateAllCrud` and `buildTemplateModels` to the imports instead of duplicating import lines.)

`src/components/build/route-list.test.tsx`:
```tsx
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildCrudRoutes } from "@/lib/crud";
import type { Model, Project } from "@/lib/types";
import { useProjectStore } from "@/store/project-store";
import { renderUi } from "@/test/render";
import { RouteList } from "./route-list";

const product: Model = { id: "m1", name: "Product", fields: [] };
const routes = buildCrudRoutes(product, ["list", "create"], []);
const project: Project = {
  id: "p1", name: "Store", slug: "store", description: "", models: [product], routes, createdAt: "", updatedAt: "",
};

it("lists routes with method chips and opens the inline editor", async () => {
  const user = userEvent.setup();
  useProjectStore.setState({ saveRoute: vi.fn(), deleteRoute: vi.fn(), restoreRoute: vi.fn() } as never);
  renderUi(<RouteList project={project} routes={routes} />);
  expect(screen.getByText("List all products")).toBeInTheDocument();
  expect(screen.getAllByText("GET")).toHaveLength(1);
  expect(screen.getByRole("link", { name: /Test List all products/ })).toHaveAttribute("href", "/projects/p1/console?route=" + routes[0].id);
  await user.click(screen.getByRole("button", { name: "Edit List all products" }));
  expect(screen.getByLabelText("Path")).toHaveValue("/products");
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `npm test -- src/lib/crud.test.ts src/components/build` → FAIL.

- [ ] **Step 3: Add `generateAllCrud` to `src/lib/crud.ts`**

```ts
import type { Project } from "./types";   // merge into the existing type import

const ALL_ACTIONS: CrudAction[] = ["list", "get", "create", "update", "delete"];

/** Every standard endpoint that any model in the project is still missing, model by model in canonical order. */
export function generateAllCrud(project: Project): Route[] {
  const existing = [...project.routes];
  const out: Route[] = [];
  for (const model of project.models) {
    const routes = buildCrudRoutes(model, ALL_ACTIONS, existing);
    existing.push(...routes);
    out.push(...routes);
  }
  return out;
}
```

- [ ] **Step 4: Create `src/components/build/route-list.tsx`**

```tsx
"use client";

import { Play, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { MethodBadge } from "@/components/domain/method-badge";
import { PathPreview } from "@/components/routes/path-preview";
import { RouteEditor } from "@/components/routes/route-editor";
import { Button } from "@/components/ui/button";
import type { Project, Route } from "@/lib/types";
import { useProjectStore } from "@/store/project-store";

interface Props {
  project: Project;
  routes: Route[];
}

export function RouteList({ project, routes }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const saveRoute = useProjectStore((s) => s.saveRoute);
  const deleteRoute = useProjectStore((s) => s.deleteRoute);
  const restoreRoute = useProjectStore((s) => s.restoreRoute);

  async function remove(route: Route) {
    try {
      const removed = await deleteRoute(project.id, route.id);
      toast("Route deleted", {
        action: {
          label: "Undo",
          onClick: () =>
            void restoreRoute(project.id, removed).catch((e) => toast.error(e instanceof Error ? e.message : "Could not undo.")),
        },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete the route.");
    }
  }

  if (routes.length === 0) return <p className="text-sm text-ink-muted">No routes yet.</p>;

  return (
    <ul className="space-y-2">
      {routes.map((route) => {
        const name = route.description || route.path;
        const editing = editingId === route.id;
        return (
          <li key={route.id} className="rounded-xl border bg-card">
            <div className="flex flex-wrap items-center gap-3 p-3">
              <MethodBadge method={route.method} className="w-16 justify-center" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{name}</p>
                <p className="truncate text-xs text-ink-muted">
                  <PathPreview base="" path={route.path} />
                </p>
              </div>
              <Button variant="ghost" size="sm" className="rounded-xl" aria-label={`Edit ${name}`} onClick={() => setEditingId(editing ? null : route.id)}>
                {editing ? "Close" : "Edit"}
              </Button>
              <Button variant="ghost" size="sm" className="rounded-xl" asChild>
                <Link href={`/projects/${project.id}/console?route=${route.id}`} aria-label={`Test ${name}`}>
                  <Play className="size-4" /> Test
                </Link>
              </Button>
              <Button variant="ghost" size="icon" className="text-destructive" aria-label={`Delete ${name}`} onClick={() => remove(route)}>
                <Trash2 className="size-4" />
              </Button>
            </div>
            {editing && (
              <div className="border-t p-3">
                <RouteEditor
                  key={JSON.stringify(route)}
                  project={project}
                  route={route}
                  onSave={async (next) => {
                    await saveRoute(project.id, next);
                    toast.success("Route saved");
                    setEditingId(null);
                  }}
                />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
```

- [ ] **Step 5: Create `src/components/build/endpoint-card.tsx`**

```tsx
import { Plus, RotateCcw, Wand2 } from "lucide-react";
import { CopyButton } from "@/components/domain/copy-button";
import { UrlSegments } from "@/components/domain/url-segments";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { baseUrl } from "@/lib/slug";
import type { Project } from "@/lib/types";

interface Props {
  project: Project;
  generateCount: number;
  onNewModel: () => void;
  onGenerateAll: () => void;
  onResetData: () => void;
}

export function EndpointCard({ project, generateCount, onNewModel, onGenerateAll, onResetData }: Props) {
  const generate = (
    <Button variant="secondary" className="rounded-xl" disabled={generateCount === 0} onClick={onGenerateAll}>
      <Wand2 className="size-4" /> Generate all
    </Button>
  );
  return (
    <section className="rounded-2xl border bg-card shadow-card">
      <div className="flex flex-wrap items-center gap-3 p-5">
        <div className="min-w-0 flex-1">
          <h2 className="mb-2 text-lg font-semibold">API endpoint</h2>
          <p className="flex flex-wrap items-center gap-1 text-sm text-ink-muted">
            <span>http://localhost:3000</span>
            <UrlSegments slug={project.slug} tail="/:resource" />
          </p>
        </div>
        <CopyButton text={baseUrl(project.slug)} />
      </div>
      <div className="flex flex-wrap items-center gap-2 rounded-b-2xl border-t bg-soft/60 p-4">
        <Button className="rounded-xl" onClick={onNewModel}>
          <Plus className="size-4" /> New model
        </Button>
        <div className="ml-auto flex flex-wrap gap-2">
          {generateCount === 0 ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <span tabIndex={0}>{generate}</span>
              </TooltipTrigger>
              <TooltipContent>Every model already has its endpoints</TooltipContent>
            </Tooltip>
          ) : (
            generate
          )}
          <Button variant="secondary" className="rounded-xl" onClick={onResetData}>
            <RotateCcw className="size-4" /> Reset data
          </Button>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 6: Create `src/components/build/getting-started-strip.tsx`**

```tsx
import { Check } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { ChecklistStep } from "@/lib/onboarding";
import { cn } from "@/lib/utils";

export function GettingStartedStrip({ steps }: { steps: ChecklistStep[] }) {
  const next = steps.find((s) => !s.done);
  if (!next) return null;
  return (
    <section aria-label="Getting started" className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card px-4 py-3 shadow-card">
      <ol className="flex flex-wrap gap-1.5">
        {steps.map((s, i) => (
          <li
            key={s.id}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs",
              s.done ? "bg-pastel-mint text-pastel-mint-ink" : s.id === next.id ? "bg-pastel-blue text-pastel-blue-ink" : "bg-soft text-ink-muted",
            )}
          >
            {s.done ? <Check className="size-3" aria-label="done" /> : <span>{i + 1}</span>}
            {s.label}
          </li>
        ))}
      </ol>
      <Button size="sm" className="ml-auto rounded-xl" asChild>
        <Link href={next.href}>{next.cta}</Link>
      </Button>
    </section>
  );
}
```

- [ ] **Step 7: Run tests and checks** — `npm test -- src/lib/crud.test.ts src/components/build` → PASS; then `npm test && npm run lint && npm run build` → clean.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: generateAllCrud, endpoint card, getting-started strip and inline route list" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Resource cards, panels, new-model card, Build page; delete old pages

**Files:**
- Create: `src/components/build/resource-card.tsx`, `src/components/build/resource-fields-panel.tsx`, `src/components/build/resource-routes-panel.tsx`, `src/components/build/resource-data-panel.tsx`, `src/components/build/new-model-card.tsx`, `src/components/build/other-routes-card.tsx`
- Rewrite: `src/app/projects/[projectId]/page.tsx`
- Delete: `src/components/models/{new-model-dialog,model-list,model-editor}.tsx`, `src/components/routes/{crud-generator-dialog,crud-generator-dialog.test,crud-banner,route-row}.tsx`, `src/components/home/onboarding-checklist.tsx`, `src/components/home/onboarding-checklist.test.tsx`, `src/app/projects/[projectId]/models/**`, `src/app/projects/[projectId]/routes/**`
- Test: `src/components/build/resource-card.test.tsx`, `src/components/build/resource-routes-panel.test.tsx`, `src/components/build/new-model-card.test.tsx`

**Interfaces:**
- Consumes: `ModelFieldTable` (`{ model, models, onSave }`), `SampleDataTable` (`{ projectId, model }`), `RouteList`, `EndpointCard`, `GettingStartedStrip`, `crudOptions`, `buildCrudRoutes`, `generateAllCrud`, `uniquePath`, `groupRoutes`, `buildChecklist`, `validateModelName`, `createId`, `consoleService.{sampleData, reset}`, store actions `createModel`, `saveModel`, `deleteModel`, `restoreModel`, `addRoutes`.
- Produces: `type Panel = "fields" | "routes" | "data"`; `<ResourceCard project model recordCount maxCount openPanel onToggle(panel) />`; `<ResourceFieldsPanel project model />`; `<ResourceRoutesPanel project model />`; `<ResourceDataPanel project model />`; `<NewModelCard project onCreated(model) onCancel />`; `<OtherRoutesCard project routes />`.

- [ ] **Step 1: Write the failing tests**

`src/components/build/resource-card.test.tsx`:
```tsx
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildCrudRoutes } from "@/lib/crud";
import type { Model, Project } from "@/lib/types";
import { renderUi } from "@/test/render";
import { ResourceCard } from "./resource-card";

vi.mock("@/lib/services", () => ({
  consoleService: { sampleData: vi.fn().mockResolvedValue([]) },
}));

const product: Model = {
  id: "m1", name: "Product",
  fields: [{ id: "f1", name: "name", type: "text", required: true, unique: false }],
};
const project: Project = {
  id: "p1", name: "Store", slug: "store", description: "", models: [product],
  routes: buildCrudRoutes(product, ["list", "create"], []), createdAt: "", updatedAt: "",
};

it("shows the summary and toggles panels", async () => {
  const user = userEvent.setup();
  const onToggle = vi.fn();
  const { rerender } = renderUi(
    <ResourceCard project={project} model={product} recordCount={5} maxCount={10} openPanel={null} onToggle={onToggle} />,
  );
  expect(screen.getByText("1 field")).toBeInTheDocument();
  expect(screen.getByText("GET")).toBeInTheDocument();
  expect(screen.getByText("POST")).toBeInTheDocument();
  expect(screen.getByText("5")).toBeInTheDocument();
  await user.click(screen.getByRole("button", { name: "Fields" }));
  expect(onToggle).toHaveBeenCalledWith("fields");

  rerender(<ResourceCard project={project} model={product} recordCount={5} maxCount={10} openPanel="fields" onToggle={onToggle} />);
  expect(screen.getByRole("button", { name: "Fields" })).toHaveAttribute("aria-expanded", "true");
  expect(screen.getByRole("button", { name: "Save fields" })).toBeInTheDocument();
});
```
(`ResourceCard` renders `ResourceFieldsPanel` → `ModelFieldTable`, which is why "Save fields" appears. `renderUi` wraps the tooltip provider. The `@/lib/services` mock exists so `ResourceDataPanel` never hits localStorage.)

`src/components/build/resource-routes-panel.test.tsx`:
```tsx
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { buildCrudRoutes } from "@/lib/crud";
import type { Model, Project, Route } from "@/lib/types";
import { useProjectStore } from "@/store/project-store";
import { renderUi } from "@/test/render";
import { ResourceRoutesPanel } from "./resource-routes-panel";

const product: Model = { id: "m1", name: "Product", fields: [] };
const project: Project = {
  id: "p1", name: "Store", slug: "store", description: "", models: [product],
  routes: buildCrudRoutes(product, ["list"], []), createdAt: "", updatedAt: "",
};

it("adds only the missing standard endpoints that are still ticked", async () => {
  const user = userEvent.setup();
  const addRoutes = vi.fn().mockResolvedValue(undefined);
  useProjectStore.setState({ addRoutes, saveRoute: vi.fn(), deleteRoute: vi.fn(), restoreRoute: vi.fn() } as never);
  renderUi(<ResourceRoutesPanel project={project} model={product} />);
  expect(screen.getByRole("checkbox", { name: /List all products/ })).toBeDisabled();
  await user.click(screen.getByRole("checkbox", { name: /Delete a product/ }));
  await user.click(screen.getByRole("button", { name: "Add 3 endpoints" }));
  const routes = addRoutes.mock.calls[0][1] as Route[];
  expect(routes.map((r) => r.action)).toEqual(["get", "create", "update"]);
});

it("creates a custom route and opens its editor", async () => {
  const user = userEvent.setup();
  const addRoutes = vi.fn().mockResolvedValue(undefined);
  useProjectStore.setState({ addRoutes, saveRoute: vi.fn(), deleteRoute: vi.fn(), restoreRoute: vi.fn() } as never);
  renderUi(<ResourceRoutesPanel project={project} model={product} />);
  await user.click(screen.getByRole("button", { name: "Custom route" }));
  const [, routes] = addRoutes.mock.calls[0] as [string, Route[]];
  expect(routes[0]).toMatchObject({ method: "GET", path: "/new-route", modelId: "m1", action: "custom" });
});
```

`src/components/build/new-model-card.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Model, Project } from "@/lib/types";
import { useProjectStore } from "@/store/project-store";
import { NewModelCard } from "./new-model-card";

const project: Project = {
  id: "p1", name: "Store", slug: "store", description: "", models: [{ id: "m1", name: "Product", fields: [] }],
  routes: [], createdAt: "", updatedAt: "",
};

it("creates on Enter, validates duplicates, cancels on Escape", async () => {
  const user = userEvent.setup();
  const created: Model = { id: "m2", name: "Customer", fields: [] };
  const createModel = vi.fn().mockResolvedValue(created);
  useProjectStore.setState({ createModel } as never);
  const onCreated = vi.fn();
  const onCancel = vi.fn();
  render(<NewModelCard project={project} onCreated={onCreated} onCancel={onCancel} />);
  const input = screen.getByLabelText("New model name");
  await user.type(input, "product{Enter}");
  expect(screen.getByRole("alert")).toHaveTextContent("A model with this name already exists.");
  await user.clear(input);
  await user.type(input, "Customer{Enter}");
  expect(createModel).toHaveBeenCalledWith("p1", "Customer");
  expect(onCreated).toHaveBeenCalledWith(created);
  await user.keyboard("{Escape}");
  expect(onCancel).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run them and confirm they fail**

Run: `npm test -- src/components/build` → FAIL with unresolved imports.

- [ ] **Step 3: Create the panels**

`src/components/build/resource-fields-panel.tsx`:
```tsx
"use client";

import { toast } from "sonner";
import { ModelFieldTable } from "@/components/models/model-field-table";
import type { Model, Project } from "@/lib/types";
import { useProjectStore } from "@/store/project-store";

export function ResourceFieldsPanel({ project, model }: { project: Project; model: Model }) {
  const saveModel = useProjectStore((s) => s.saveModel);
  return (
    <ModelFieldTable
      key={JSON.stringify(model.fields)}
      model={model}
      models={project.models}
      onSave={async (next) => {
        try {
          await saveModel(project.id, next);
          toast.success(`${next.name} saved`);
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Could not save the model.");
        }
      }}
    />
  );
}
```

`src/components/build/resource-data-panel.tsx`:
```tsx
"use client";

import { SampleDataTable } from "@/components/models/sample-data-table";
import type { Model, Project } from "@/lib/types";

export function ResourceDataPanel({ project, model }: { project: Project; model: Model }) {
  return <SampleDataTable projectId={project.id} model={model} />;
}
```

`src/components/build/resource-routes-panel.tsx`:
```tsx
"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { MethodBadge } from "@/components/domain/method-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { buildCrudRoutes, crudOptions, type CrudAction } from "@/lib/crud";
import { countLabel } from "@/lib/format";
import { createId } from "@/lib/ids";
import { uniquePath } from "@/lib/routes";
import type { Model, Project, Route } from "@/lib/types";
import { useProjectStore } from "@/store/project-store";
import { RouteList } from "./route-list";

export function ResourceRoutesPanel({ project, model }: { project: Project; model: Model }) {
  const addRoutes = useProjectStore((s) => s.addRoutes);
  const routes = project.routes.filter((r) => r.modelId === model.id);
  const options = crudOptions(model);
  const exists = (o: (typeof options)[number]) => project.routes.some((r) => r.method === o.method && r.path === o.path);
  const missing = options.filter((o) => !exists(o));
  const [selected, setSelected] = useState<CrudAction[]>(() => missing.map((o) => o.action));
  const [busy, setBusy] = useState(false);

  async function addStandard() {
    setBusy(true);
    try {
      const next = buildCrudRoutes(model, selected, project.routes);
      await addRoutes(project.id, next);
      toast.success(`${countLabel(next.length, "endpoint")} created`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create the endpoints.");
    } finally {
      setBusy(false);
    }
  }

  async function addCustom() {
    const route: Route = {
      id: createId("rt"),
      method: "GET",
      path: uniquePath(project.routes),
      modelId: model.id,
      action: "custom",
      description: "New route",
      filters: [],
    };
    try {
      await addRoutes(project.id, [route]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create the route.");
    }
  }

  return (
    <div className="space-y-4">
      <RouteList project={project} routes={routes} />
      {missing.length > 0 && (
        <div className="rounded-xl border border-dashed border-sketch p-3">
          <p className="mb-2 text-sm font-medium">Add standard endpoints</p>
          <ul className="flex flex-wrap gap-2">
            {options.map((o) => {
              const already = exists(o);
              const id = `std-${model.id}-${o.action}`;
              return (
                <li key={o.action}>
                  <label htmlFor={id} className="inline-flex cursor-pointer items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs has-[:checked]:border-primary">
                    <Checkbox
                      id={id}
                      aria-label={o.label}
                      checked={already || selected.includes(o.action)}
                      disabled={already}
                      onCheckedChange={(v) =>
                        setSelected((s) => (v === true ? [...s, o.action] : s.filter((a) => a !== o.action)))
                      }
                    />
                    <MethodBadge method={o.method} tooltip={false} />
                    {o.label}
                  </label>
                </li>
              );
            })}
          </ul>
          <Button size="sm" className="mt-3 rounded-xl" disabled={selected.length === 0 || busy} onClick={addStandard}>
            Add {countLabel(selected.length, "endpoint")}
          </Button>
        </div>
      )}
      <Button variant="secondary" size="sm" className="rounded-xl" onClick={addCustom}>
        <Plus className="size-4" /> Custom route
      </Button>
    </div>
  );
}
```
Note: the checkbox's accessible name comes from `aria-label={o.label}`, which the test relies on. After a custom route is created it appears in `RouteList` (the store refreshes the project); the user clicks its Edit to open the editor.

- [ ] **Step 4: Create `src/components/build/resource-card.tsx`**

```tsx
"use client";

import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { MethodBadge } from "@/components/domain/method-badge";
import { SketchCard } from "@/components/domain/sketch-card";
import { Button } from "@/components/ui/button";
import { countLabel } from "@/lib/format";
import type { Model, Project } from "@/lib/types";
import { cn } from "@/lib/utils";
import { useProjectStore } from "@/store/project-store";
import { ResourceDataPanel } from "./resource-data-panel";
import { ResourceFieldsPanel } from "./resource-fields-panel";
import { ResourceRoutesPanel } from "./resource-routes-panel";

export type Panel = "fields" | "routes" | "data";
const PANELS: { id: Panel; label: string }[] = [
  { id: "fields", label: "Fields" },
  { id: "routes", label: "Routes" },
  { id: "data", label: "Data" },
];

interface Props {
  project: Project;
  model: Model;
  recordCount: number;
  maxCount: number;
  openPanel: Panel | null;
  onToggle: (panel: Panel) => void;
}

export function ResourceCard({ project, model, recordCount, maxCount, openPanel, onToggle }: Props) {
  const deleteModel = useProjectStore((s) => s.deleteModel);
  const restoreModel = useProjectStore((s) => s.restoreModel);
  const routes = project.routes.filter((r) => r.modelId === model.id);
  const fill = maxCount > 0 ? Math.max(4, Math.round((recordCount / maxCount) * 100)) : 0;

  async function remove() {
    try {
      const removed = await deleteModel(project.id, model.id);
      toast(`${model.name} deleted`, {
        action: {
          label: "Undo",
          onClick: () =>
            void restoreModel(project.id, removed).catch((e) => toast.error(e instanceof Error ? e.message : "Could not undo.")),
        },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not delete the model.");
    }
  }

  return (
    <SketchCard id={`model-${model.id}`} className={cn("animate-in fade-in slide-in-from-bottom-1 duration-200", openPanel && "border-solid border-line bg-card shadow-card")}>
      <div className="flex flex-wrap items-center gap-3 p-4">
        <div className="flex min-w-0 items-center gap-3">
          <h3 className="truncate text-sm font-semibold">{model.name}</h3>
          <div className="flex items-center gap-2" aria-label={`${recordCount} sample records`}>
            <div className="h-2 w-24 overflow-hidden rounded-full bg-soft">
              <div className="h-full rounded-full bg-pastel-violet-ink/70" style={{ width: `${fill}%` }} />
            </div>
            <span className="text-xs text-ink-muted">{recordCount}</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-soft px-2 py-0.5 text-[11px] text-ink-muted">{countLabel(model.fields.length, "field")}</span>
          {routes.map((r) => (
            <MethodBadge key={r.id} method={r.method} tooltip={false} />
          ))}
        </div>
        <div className="ml-auto flex items-center gap-1">
          {PANELS.map((p) => (
            <Button
              key={p.id}
              variant="secondary"
              size="sm"
              aria-expanded={openPanel === p.id}
              className={cn("rounded-xl", openPanel === p.id ? "bg-ink text-paper hover:bg-ink/90" : "bg-soft")}
              onClick={() => onToggle(p.id)}
            >
              {p.label}
            </Button>
          ))}
          <Button variant="ghost" size="icon" className="text-destructive" aria-label={`Delete ${model.name}`} onClick={remove}>
            <Trash2 className="size-4" />
          </Button>
        </div>
      </div>
      {openPanel && (
        <div className="border-t p-4">
          {openPanel === "fields" && <ResourceFieldsPanel project={project} model={model} />}
          {openPanel === "routes" && <ResourceRoutesPanel project={project} model={model} />}
          {openPanel === "data" && <ResourceDataPanel project={project} model={model} />}
        </div>
      )}
    </SketchCard>
  );
}
```

- [ ] **Step 5: Create `src/components/build/new-model-card.tsx`**

```tsx
"use client";

import { useState } from "react";
import { SketchCard } from "@/components/domain/sketch-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Model, Project } from "@/lib/types";
import { validateModelName } from "@/lib/validation";
import { useProjectStore } from "@/store/project-store";

interface Props {
  project: Project;
  onCreated: (model: Model) => void;
  onCancel: () => void;
}

export function NewModelCard({ project, onCreated, onCancel }: Props) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const createModel = useProjectStore((s) => s.createModel);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const err = validateModelName(name, project.models);
    setError(err);
    if (err) return;
    setSaving(true);
    try {
      onCreated(await createModel(project.id, name.trim()));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not create the model.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SketchCard className="p-4">
      <form onSubmit={submit} className="flex flex-wrap items-center gap-3" onKeyDown={(e) => e.key === "Escape" && onCancel()}>
        <Input
          autoFocus
          aria-label="New model name"
          value={name}
          placeholder="Customer"
          className="w-56"
          aria-invalid={!!error}
          onChange={(e) => {
            setName(e.target.value);
            setError(null);
          }}
        />
        <span className="text-xs text-ink-muted">Singular, like Customer. Enter to create, Esc to cancel.</span>
        <Button type="submit" size="sm" className="rounded-xl" disabled={saving}>
          {saving ? "Creating…" : "Create model"}
        </Button>
        <Button type="button" size="sm" variant="ghost" className="rounded-xl" onClick={onCancel}>
          Cancel
        </Button>
        {error && (
          <p role="alert" className="w-full text-xs text-destructive">
            {error}
          </p>
        )}
      </form>
    </SketchCard>
  );
}
```

- [ ] **Step 6: Create `src/components/build/other-routes-card.tsx`**

```tsx
"use client";

import { Plus } from "lucide-react";
import { toast } from "sonner";
import { SketchCard } from "@/components/domain/sketch-card";
import { Button } from "@/components/ui/button";
import { createId } from "@/lib/ids";
import { uniquePath } from "@/lib/routes";
import type { Project, Route } from "@/lib/types";
import { useProjectStore } from "@/store/project-store";
import { RouteList } from "./route-list";

export function OtherRoutesCard({ project, routes }: { project: Project; routes: Route[] }) {
  const addRoutes = useProjectStore((s) => s.addRoutes);
  async function addCustom() {
    const route: Route = {
      id: createId("rt"), method: "GET", path: uniquePath(project.routes), modelId: null, action: "custom", description: "New route", filters: [],
    };
    try {
      await addRoutes(project.id, [route]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create the route.");
    }
  }
  return (
    <SketchCard className="space-y-3 p-4">
      <h3 className="text-sm font-semibold">Other routes</h3>
      <RouteList project={project} routes={routes} />
      <Button variant="secondary" size="sm" className="rounded-xl" onClick={addCustom}>
        <Plus className="size-4" /> Custom route
      </Button>
    </SketchCard>
  );
}
```

- [ ] **Step 7: Rewrite `src/app/projects/[projectId]/page.tsx` (Build)**

```tsx
"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { EndpointCard } from "@/components/build/endpoint-card";
import { GettingStartedStrip } from "@/components/build/getting-started-strip";
import { NewModelCard } from "@/components/build/new-model-card";
import { OtherRoutesCard } from "@/components/build/other-routes-card";
import { ResourceCard, type Panel } from "@/components/build/resource-card";
import { generateAllCrud } from "@/lib/crud";
import { countLabel } from "@/lib/format";
import { buildChecklist } from "@/lib/onboarding";
import { groupRoutes } from "@/lib/routes";
import { consoleService } from "@/lib/services";
import { useProjectStore } from "@/store/project-store";
import { useUiStore } from "@/store/ui-store";
import { useCurrentProject } from "@/store/use-project";

function Build() {
  const project = useCurrentProject();
  const params = useSearchParams();
  const addRoutes = useProjectStore((s) => s.addRoutes);
  const progress = useUiStore((s) => s.progress[project.id]);
  const [open, setOpen] = useState<Record<string, Panel | null>>(() => {
    const requested = params.get("model");
    return requested ? { [requested]: "fields" } : {};
  });
  const [adding, setAdding] = useState(false);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const modelIds = project.models.map((m) => m.id).join(",");

  const loadCounts = useCallback(async () => {
    const entries = await Promise.all(
      project.models.map(async (m) => [m.id, (await consoleService.sampleData(project.id, m.id)).length] as const),
    );
    setCounts(Object.fromEntries(entries));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project.id, modelIds]);

  useEffect(() => {
    void loadCounts();
  }, [loadCounts]);

  const pending = generateAllCrud(project);
  const other = groupRoutes(project).find((g) => g.key === "other")?.routes ?? [];
  const maxCount = Math.max(0, ...Object.values(counts));
  const steps = buildChecklist(project, progress);

  async function generateAll() {
    try {
      await addRoutes(project.id, pending);
      toast.success(`${countLabel(pending.length, "endpoint")} created`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not create the endpoints.");
    }
  }

  async function resetData() {
    try {
      await consoleService.reset(project.id);
      await loadCounts();
      toast("Sample data reset");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not reset the sample data.");
    }
  }

  return (
    <div className="space-y-5">
      <GettingStartedStrip steps={steps} />
      <EndpointCard
        project={project}
        generateCount={pending.length}
        onNewModel={() => setAdding(true)}
        onGenerateAll={generateAll}
        onResetData={resetData}
      />
      <div className="space-y-3">
        {project.models.map((m) => (
          <ResourceCard
            key={m.id}
            project={project}
            model={m}
            recordCount={counts[m.id] ?? 0}
            maxCount={maxCount}
            openPanel={open[m.id] ?? null}
            onToggle={(panel) => setOpen((o) => ({ ...o, [m.id]: o[m.id] === panel ? null : panel }))}
          />
        ))}
        {adding && (
          <NewModelCard
            project={project}
            onCreated={(model) => {
              setAdding(false);
              setOpen((o) => ({ ...o, [model.id]: "fields" }));
              toast.success(`${model.name} created. Add its fields below.`);
            }}
            onCancel={() => setAdding(false)}
          />
        )}
        {project.models.length === 0 && !adding && (
          <p className="px-1 text-sm text-ink-muted">{"No models yet. Press “New model” to describe the first thing your API stores."}</p>
        )}
        {other.length > 0 && <OtherRoutesCard project={project} routes={other} />}
      </div>
    </div>
  );
}

export default function BuildPage() {
  return (
    <Suspense>
      <Build />
    </Suspense>
  );
}
```

- [ ] **Step 8: Delete the old pages and components**

```bash
git rm -q -r "src/app/projects/[projectId]/models" "src/app/projects/[projectId]/routes"
git rm -q src/components/models/new-model-dialog.tsx src/components/models/model-list.tsx src/components/models/model-editor.tsx \
  src/components/routes/crud-generator-dialog.tsx src/components/routes/crud-generator-dialog.test.tsx \
  src/components/routes/crud-banner.tsx src/components/routes/route-row.tsx \
  src/components/home/onboarding-checklist.tsx src/components/home/onboarding-checklist.test.tsx
```
Then grep for dangling imports: `grep -rn "crud-banner\|onboarding-checklist\|model-editor\|route-row\|new-model-dialog\|model-list\|app-sidebar\|project-switcher" src` must return nothing.

- [ ] **Step 9: Run tests and checks** — `npm test -- src/components/build` → PASS; `npm test && npm run lint && npm run build` → clean.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: single-canvas Build page with inline resource cards; remove model and route pages" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Restyle the remaining screens (console, docs, settings, editors, shared)

**Files:**
- Modify: `src/app/projects/[projectId]/settings/page.tsx`, `src/app/projects/[projectId]/console/page.tsx`, `src/app/projects/[projectId]/docs/page.tsx`, `src/components/console/{route-picker,response-viewer,request-form}.tsx`, `src/components/docs/{endpoint-doc,model-fields-doc}.tsx`, `src/components/models/{model-field-table,field-row,field-type-picker,sample-data-table}.tsx`, `src/components/routes/route-editor.tsx`, `src/components/domain/{empty-state,code-block,page-header,help-hint}.tsx`
- Test: existing tests must keep passing; `src/app/projects/[projectId]/settings` has no test — add `src/components/domain/two-step-button.test.tsx` already covers the control.

**Interfaces:** none change.

- [ ] **Step 1: Settings — replace the dialog with `TwoStepButton`**

In `src/app/projects/[projectId]/settings/page.tsx`:
- Remove the `Dialog*` imports and the `confirmOpen` state and the whole `<Dialog …>` block.
- Import `TwoStepButton` from `@/components/domain/two-step-button`.
- Replace the `<Button variant="destructive" onClick={() => setConfirmOpen(true)}>Delete API</Button>` with `<TwoStepButton label="Delete API" confirmLabel="Sure? Delete" onConfirm={() => void remove()} />`.
- In `remove()`, delete the `setConfirmOpen(false);` line.
- Replace `rounded-[10px]` with `rounded-2xl` and add `shadow-card` to the form container; `Card` gets `className="rounded-2xl border-pastel-rose-ink/30 shadow-card"`.

- [ ] **Step 2: Sweep the shape classes**

Across every file listed in this task, apply:
- `rounded-[10px]` → `rounded-2xl`
- White containers (`bg-surface-2` and `bg-card` boxes that are cards) get `shadow-card`.
- `rounded-md` on buttons/inputs that are ours (not shadcn internals) → `rounded-xl`.
- `text-muted-foreground` may stay (it maps to ink-muted).
Verify with `grep -rn "rounded-\[10px\]\|dark:" src` → no results.

- [ ] **Step 3: Console**

- `route-picker.tsx`: wrap the nav in `className="space-y-4 rounded-2xl border bg-card p-3 shadow-card"`; selected row → `bg-pastel-blue text-pastel-blue-ink`.
- `response-viewer.tsx`: status pill classes → 2xx `bg-pastel-mint text-pastel-mint-ink`, 4xx `bg-pastel-peach text-pastel-peach-ink`, 5xx `bg-pastel-rose text-pastel-rose-ink` (replace the `border-success/30 …` trio; keep the `tone` logic). Body container → `rounded-2xl border bg-card p-4 shadow-card`.
- `request-form.tsx`: the URL bar → `rounded-xl border bg-soft p-2`; render the address with `UrlSegments`: replace the `<code>` showing `url` with `<span className="font-mono text-sm">{url}</span>` (keep behaviour; test asserts on the text).
- `console/page.tsx`: request section → `rounded-2xl border bg-card p-5 shadow-card`.

- [ ] **Step 4: Docs**

- `docs/page.tsx`: nav links → `rounded-xl px-3 py-1.5 hover:bg-soft`; the base URL `<code>` → `<UrlSegments slug={project.slug} />`.
- `endpoint-doc.tsx`: card → `rounded-2xl border bg-card p-5 shadow-card`; the `<code>{base}{route.path}</code>` → `<UrlSegments slug={project.slug} tail={route.path} />` — `EndpointDoc` needs the slug: change its props to `{ endpoint, slug, tryHref }` and update the caller in `docs/page.tsx` (pass `slug={project.slug}` instead of `base`).
- `code-block.tsx`: container → `rounded-2xl border bg-soft`.

- [ ] **Step 5: Editors**

- `model-field-table.tsx`: table wrapper → `overflow-x-auto rounded-2xl border bg-card`; header row `bg-soft`; the "Add field" row gets `border-t border-dashed border-sketch`.
- `field-row.tsx` / `field-type-picker.tsx`: the picker trigger shows `<TypeChip type={value} />` instead of the mono icon + label (keep `aria-label={`Field type: ${current.label}`}` so the test passes); option tiles → `rounded-xl`.
- `route-editor.tsx`: form container → `rounded-2xl border bg-soft/50 p-5`; preview aside unchanged.
- `sample-data-table.tsx`: wrapper → `rounded-2xl border bg-card`.

- [ ] **Step 6: Shared**

- `empty-state.tsx`: → `rounded-2xl border-[1.5px] border-dashed border-sketch px-6 py-16`; icon bubble `bg-pastel-blue text-pastel-blue-ink`; title `font-script text-2xl`.
- `page-header.tsx`: title `text-xl font-semibold`.
- `help-hint.tsx`: unchanged.

- [ ] **Step 7: Run everything** — `npm test && npm run lint && npm run build` → clean; `grep -rn "rounded-\[10px\]\|dark:\|next-themes\|bg-surface" src` → only `bg-surface`/`bg-surface-2` hits are acceptable (they are mapped), nothing else.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "style: paper & ink treatment for console, docs, settings and editors" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: Journey check and verification

**Files:**
- Modify: `src/test/journey.test.ts` (no change expected; confirm it passes), `docs/superpowers/specs/2026-09-19-universal-api-ui-design.md` (add a one-line note at the top: "Visual system and shell superseded by `2026-09-20-paper-and-ink-redesign.md`.")

- [ ] **Step 1: Full suite, lint, build**

Run: `npm test && npm run lint && npm run build` → all clean, no warnings in test output.

- [ ] **Step 2: Smoke the routes**

Start `npm run dev` in the background; `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/projects` → 200; `curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/projects/new` → 307 or 200 (redirect followed); stop the server. If `next dev` re-added its block to `AGENTS.md`, commit that change too.

- [ ] **Step 3: Manual walkthrough (human)**

Record in the report that these remain for the human: create a Store API from the new-project card → land on Build → open Product → Fields → add `color` → Save → Routes → tick standard endpoints → Add → Test tab → `POST /products` without name → 400 → with name and price → 201 → Docs shows 5 endpoints → ⋮ → Delete project (two clicks) → Undo. Phone width: cards stack, no horizontal scroll except tables. Lighthouse a11y ≥ 95.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "docs: mark original visual spec as superseded" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```
