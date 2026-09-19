# Universal API Builder: UI Design Plan (frontend only, mock data)

## Context
The goal is a "universal API" builder where **no-code users** can create data models, pick HTTP methods, set up routes, test them, and read auto-generated docs, all from a UI. This phase covers only the **design system, user journey and UI features**. It runs in **Next.js with mock data**. A Node/Express backend comes later, so the frontend talks to data through a service layer that can later point to real HTTP calls without changes to the UI.

Decisions so far:
- Audience: no-code builders. Use plain language and hide HTTP jargon behind friendly labels.
- v1 features: projects, models, routes, **auto CRUD generation**, **test console**, **API docs view**.
- Visual style: dev-tool look, dark first (Vercel/Supabase feel), light mode supported.
- Multiple projects per user.
- Model editor: spreadsheet style, like Airtable.
- Not in v1: auth/API keys, a real backend, team collaboration, the ERD canvas.

---

## 1. User Journey

```
Projects Dashboard (no sign-in in v1) → Create Project (wizard)
   → Project Home (checklist) → Models → Routes → Test Console → Docs
```

1. **Projects Dashboard**: grid of project cards (name, number of models and routes, last edited). The empty state has a large "Create your first API" button and 3 starter templates (Blog, Store, To-do list).
2. **Create Project wizard** (3 steps, with a progress bar):
   1. Name and description. The base URL is generated automatically (`/api/my-store`).
   2. Start blank or from a template.
   3. Review, then create.
3. **Project Home**: a "Getting started" checklist (Create a model → Add fields → Generate routes → Test a route → View docs) plus quick stats. This teaches the whole flow to no-code users.
4. **Models**: model list on the left, spreadsheet-style field editor on the right. After a model is saved, a banner asks: *"Create ready-made endpoints for Customer?"* and leads to Auto CRUD.
5. **Auto CRUD**: a modal with checkboxes for the 5 standard actions, written in plain language:
   - "List all customers" `GET /customers`
   - "Get one customer" `GET /customers/:id`
   - "Add a customer" `POST /customers`
   - "Update a customer" `PUT /customers/:id`
   - "Delete a customer" `DELETE /customers/:id`
6. **Routes**: a list grouped by model (method badge, path, friendly name). The route editor lets users pick a method, write the path, link a model, choose the action type, set query filters, and see the response shape.
7. **Test Console**: pick a route, fill in a form built from the schema (no raw JSON needed; an "Advanced: JSON" toggle is available), click Send, and see the status, time, and a pretty-printed response from the mock engine.
8. **Docs**: a read-only page generated from models and routes, with a sidebar per model, each endpoint's description, example request and response, and a "Try it" link to the Test Console.

## 2. Information Architecture / Routes (Next.js App Router)

```
/                               → redirect to /projects
/projects                       Dashboard
/projects/new                   Create wizard
/projects/[projectId]           Project Home (checklist)
/projects/[projectId]/models            Models list + editor
/projects/[projectId]/models/[modelId]  Field editor + sample data tab
/projects/[projectId]/routes            Routes list
/projects/[projectId]/routes/[routeId]  Route editor
/projects/[projectId]/console           Test Console
/projects/[projectId]/docs              API Docs
/projects/[projectId]/settings          Name, base URL, delete project
```

**App shell** (inside a project): a collapsible left sidebar (Home, Models, Routes, Test, Docs, Settings), a top bar (project switcher, a ⌘K command palette, theme toggle, avatar), and the content area. On mobile, the sidebar becomes a drawer.

## 3. Design System

### Approach (recommended)
**Tailwind CSS + shadcn/ui (Radix primitives)** with our own design tokens.
- Accessible primitives, and the component code lives in the repo so it can be themed freely. This fits the dev-tool look.
- Alternatives I considered: MUI (heavier and harder to make look custom) and a fully custom build (too slow for v1).

### Tokens (CSS variables in `app/globals.css`, mapped in `tailwind.config.ts`)
| Token | Dark (default) | Light |
|---|---|---|
| `--bg` | `#0A0A0B` | `#FFFFFF` |
| `--surface` | `#111113` | `#F7F7F8` |
| `--surface-2` (cards, inputs) | `#18181B` | `#FFFFFF` |
| `--border` | `#27272A` | `#E4E4E7` |
| `--text` | `#FAFAFA` | `#09090B` |
| `--text-muted` | `#A1A1AA` | `#71717A` |
| `--primary` (brand) | `#7C5CFF` violet | `#6D4AFF` |
| `--success` / `--warning` / `--danger` | `#22C55E` / `#F59E0B` / `#EF4444` | same, darkened for contrast |

**HTTP method colors** (used for every method badge):
GET `#22C55E` green · POST `#3B82F6` blue · PUT `#F59E0B` amber · PATCH `#A855F7` purple · DELETE `#EF4444` red.
Each badge also shows a **friendly label** on hover or next to it (GET = "Read", POST = "Create", PUT = "Update", DELETE = "Delete") for no-code users.

**Field type icons and colors**: Text `Aa`, Number `#`, Yes/No `◐`, Date `📅`, Email `@`, URL `🔗`, Choice list `☰`, Link to model `↗`, JSON `{}` (advanced).

- **Type**: Inter for UI, JetBrains Mono for paths, JSON and code. Scale: 12/14/16/20/24/32.
- **Spacing**: 4px base (4, 8, 12, 16, 24, 32, 48). **Corner radius**: 6px for inputs, 10px for cards, 9999px for badges.
- **Motion**: 150ms ease-out for hover and focus, 200ms for panels. Respects `prefers-reduced-motion`.
- **Accessibility**: WCAG AA contrast, visible focus rings (2px primary), and everything is keyboard-operable (Radix provides this).

### Component inventory
- **Base** (from shadcn): Button, Input, Textarea, Select, Checkbox, Switch, Tabs, Dialog, Sheet, DropdownMenu, Tooltip, Toast, Badge, Card, Table, Command (⌘K), Skeleton.
- **Domain components** (`components/domain/`):
  - `MethodBadge`: method plus friendly label, in the method color
  - `FieldTypePicker`: popover grid of type icons with a one-line description of each
  - `FieldRow`, `ModelFieldTable`: the spreadsheet-style editor with inline editing, drag to reorder, and a "+ Add field" row
  - `RouteRow`, `RouteEditor`: method selector, path input with `:param` highlighting, model link, action type
  - `CrudGeneratorDialog`
  - `RequestForm`: builds form inputs from a model schema (type → input control)
  - `ResponseViewer`: status pill, timing, collapsible JSON tree, copy button
  - `CodeBlock`: monospace with syntax highlighting and copy
  - `EmptyState`: illustration, headline, main button
  - `OnboardingChecklist`, `ProjectCard`, `TemplateCard`
  - `HelpHint`: an ⓘ tooltip that explains a jargon term in plain English

## 4. Mock Data & Architecture (ready for a backend later)

```
src/
  app/                    # routes above
  components/ui/          # shadcn primitives
  components/domain/      # domain components above
  lib/types.ts            # Project, Model, Field, Route, TestRequest/Response
  lib/services/           # api interface: projectService, modelService, routeService, consoleService
  lib/services/mock/      # mock implementations (in-memory + localStorage)
  lib/mock-engine.ts      # runs a Route against mock data → response
  lib/templates.ts        # Blog / Store / Todo seed projects
  store/                  # Zustand stores (UI state + cached entities)
```

- **Types** (`lib/types.ts`): `Project {id,name,slug,models,routes}`, `Model {id,name,fields}`, `Field {id,name,type,required,unique,options?,linkTo?}`, `Route {id,method,path,modelId,action:'list'|'get'|'create'|'update'|'delete'|'custom',description}`.
- **Service layer**: every UI data call goes through `lib/services/*` and returns a Promise, with fake latency of about 200ms so loading states look real. Later, `mock/` is replaced by `http/` (fetch calls to Express) behind the same interface, and the UI does not change.
- **Mock engine**: generates fake records from each model's fields (seeded, using `@faker-js/faker`), keeps them in memory, and supports list/get/create/update/delete, including 404s and validation errors (a missing required field returns 400). This makes the Test Console feel real.
- **Persistence**: localStorage through Zustand `persist`, so projects survive a page refresh.
- **Validation**: zod schemas for forms (field names, paths, duplicate routes).

## 5. Key UX Details for No-Code Users
- Plain-language labels first, technical detail second (e.g. "Add a customer" with `POST /customers` in small monospace underneath).
- Inline validation with explanations: *"Two routes can't share the same method and path."*
- Undo toasts for deletes, since there's no confirmation dialog for simple actions.
- Every page has an empty state with one clear next step.
- The ⌘K palette jumps to any model, route or page.

## 6. Build Order (once this plan is approved)
1. Scaffold Next.js (App Router, TS), Tailwind, shadcn/ui, tokens, theme toggle, app shell
2. Types, mock services, templates, Zustand store
3. Dashboard and Create wizard
4. Models: spreadsheet field editor and type picker
5. Auto CRUD generator, Routes list and editor
6. Mock engine and Test Console
7. Docs page
8. Project Home checklist, ⌘K palette, polish (empty states, skeletons, a11y pass)

## Verification
- `npm run dev`, then walk the full journey: create a project from the "Store" template → add a field to `Product` → generate CRUD → send `POST /products` in the console with a required field left out (expect 400), then a valid one (expect 201) → `GET /products` shows the new record → Docs lists all 5 endpoints.
- Refresh the browser: the project persists.
- Toggle dark and light: all tokens switch, and the method badges stay readable.
- Keyboard-only pass through the wizard and field editor. Run a Lighthouse accessibility check (aim for ≥ 95).
- `npm run build` and `npm run lint` pass.
