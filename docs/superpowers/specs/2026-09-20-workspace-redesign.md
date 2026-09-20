# Workspace redesign — "Slate & indigo" design spec

Supersedes the visual system and screens of `2026-09-20-paper-and-ink-redesign.md`. Domain logic, the service layer, the stores and the mock engine stay; three small features are added (request log, code snippets, endpoint hover preview).

## Why
The product is a mock-API builder. It should read, within seconds, as a serious developer tool: the API request → mock → response lifecycle is the visual language, code is a first-class element, and the interface is a calm, tonal light theme rather than white cards on paper.

## Decisions
- Audience: developers. Technical terms first (resource, schema, endpoint, console, reference); plain-language descriptions stay as secondary text.
- Layout: three-pane workspace (rail · editor · console). The separate Test tab goes away; the console is always present inside a project.
- Accent: indigo. One dark element per screen: the response panel.
- No landing page in this scope. `/` still redirects to `/projects`.
- URLs: `/projects`, `/projects/[id]` (workspace; `?resource=<modelId>` or `?endpoint=<routeId>` selects a node), `/projects/[id]/reference` (docs; `/docs` redirects to it), `/projects/[id]/settings`. `/projects/[id]/console` redirects to the workspace.

## 1. Visual system

### Tokens (`src/app/globals.css`, `@theme inline`)
| Token | Value | Use |
|---|---|---|
| `--color-page` | `#F4F4F2` | page background (warm) |
| `--color-rail` | `#ECEDEF` | left rail and top bar (cool) |
| `--color-surface` | `#FAFAF8` | editor surface, list rows |
| `--color-panel` | `#EEF0F3` | code panels, request form, log |
| `--color-panel-strong` | `#E4E7EC` | table headers, hover rows |
| `--color-line` | `#DDDFE3` | borders |
| `--color-line-strong` | `#C9CDD4` | focused borders, tree guides |
| `--color-ink` | `#1F2328` | text |
| `--color-ink-2` | `#4B5563` | secondary text |
| `--color-ink-3` | `#676D7B` | muted / labels |
| `--color-accent` | `#4F46E5` | primary action, selection, packet |
| `--color-accent-soft` | `#E0E7FF` | selected row tint |
| `--color-accent-ink` | `#3730A3` | text on accent-soft |
| `--color-slate` | `#1B1F27` | response panel background |
| `--color-slate-2` | `#242935` | response panel header |
| `--color-slate-ink` | `#E6E8EC` | text on slate |
| `--color-slate-muted` | `#8B93A1` | muted on slate |
| success / warning / danger | `#15803D` / `#B45309` / `#B91C1C` | status text |

Contrast fix (Task 8): `ink-3` (and `--color-syntax-muted`, same value) moved from `#6B7280` to `#676D7B`. The original failed WCAG 4.5:1 against `--color-page` (4.39:1) and `--color-panel` (4.23:1); the darker value clears both (4.71:1 / 4.54:1). Every other checked pair (the four slate status colours on `#1B1F27`, and each method's text-on-tint) passed as specified.

Method colours (text / tint): GET `#15803D`/`#DCFCE7`, POST `#1D4ED8`/`#DBEAFE`, PUT `#B45309`/`#FEF3C7`, PATCH `#6D28D9`/`#EDE9FE`, DELETE `#B91C1C`/`#FEE2E2`. Rendered as `MethodLabel`: mono 11px semibold, fixed width (56px), tint background, 4px radius.

Syntax colours, light panels: key `#3730A3`, string `#0F766E`, number `#B45309`, boolean `#6D28D9`, null `#676D7B`, punctuation `#676D7B`. On slate: key `#A5B4FC`, string `#6EE7B7`, number `#FCD34D`, boolean `#C4B5FD`, null/punct `#8B93A1`.

Background: `--color-page` with a dot grid (`radial-gradient(var(--color-line) 1px, transparent 1px)`, 24px, opacity via the colour) on the page only; panels are flat.

### Type
- Sans: Instrument Sans (Google Fonts via `next/font`), UI text 14px, secondary 13px, headings 16/20/24px semibold, letter-spacing −0.01em on headings.
- Mono: JetBrains Mono, endpoints/JSON/status/labels; 13px in editors, 12px in the tree and log; uppercase mono labels 11px with 0.08em tracking for section kickers (`RESOURCE`, `ENDPOINT`, `RESPONSE`).
- Radius: 6px controls, 8px panels, 10px floating popovers. Chips are 4px, not pills.
- Shadows: only on popovers and the command palette (`0 8px 24px rgb(31 35 40 / 12%)`). Panels use tone + 1px line.
- Focus: 2px accent ring, offset 2px.
- Motion: 150ms hover/press, 200ms panel/tree, the packet animation 600ms; `prefers-reduced-motion` respected.

### Wordmark
"universal" in Instrument Sans semibold, 18px, preceded by a 20px SVG mark: two chevrons `⟨ ⟩` with a horizontal bar between them (request/response), drawn in ink, the bar in accent.

## 2. Screens

### Top bar (inside a project)
Rail-coloured, 48px: wordmark · project switcher (name with caret, dropdown listing projects + "All projects" + "New project") · centre: nothing · right: Search `⌘K`, Reference link, `⋮` project menu (Settings, Reset sample data, two-step Delete), avatar. No tabs.

### `/projects`
Page title "Projects" and a dense list on a surface panel: each row = name (sans, semibold) · base URL (mono) · `3 resources · 15 endpoints` · last activity (`Edited 2h ago`). Row click opens the workspace. Above the list, a "New project" row: name input, template segmented control (Blank / Blog / Store / To-do), Create. Empty state: same row plus one sentence "Define a resource, mock its endpoints, send a request." No cards.

### `/projects/[id]` — Workspace
Three panes, full height under the top bar; the rail and console scroll independently; the editor scrolls.

**Rail (280px, `--color-rail`)**
- Header line: `localhost:3000` (mono, muted) then the base URL `/api/my-store` (mono, ink) with a copy icon.
- Tree: one node per resource (folder icon, name, count of endpoints), expanded by default, children = endpoints as `GET   /products` lines (method label + path in mono, `:id` in accent-ink). Selection = accent-soft background + accent left bar. Hover on an endpoint shows a popover (right of the rail) with the example request (`POST /products` + example body or `GET /products/:id`) — 300ms delay, closes on leave.
- A final node "Other endpoints" if any exist.
- Footer: `+ Resource`, `+ Endpoint` (secondary buttons). `+ Resource` inserts an inline name input at the end of the tree (Enter creates, Esc cancels; the new resource is selected). `+ Endpoint` creates a custom endpoint (`GET /new-route`) under the selected resource (or unattached) and selects it.
- Keyboard: ↑/↓ move, →/← expand/collapse, Enter select, Delete asks with a two-step inline confirm in the editor header (not in the tree).

**Editor (flexible, `--color-surface`)**
- Nothing selected → the **lifecycle guide**: four steps in a row connected by a line, `DEFINE → MOCK → REQUEST → RESPOND`, each with one sentence and a button (Add a resource · Create endpoints · Send a request · Open reference). Steps that are done show a check. Uses `buildChecklist` mapping: model→Define, fields+routes→Mock, test→Request, docs→Respond.
- Resource selected → kicker `RESOURCE`, title (editable inline: click the name, Enter saves via `saveModel`), description line "`/products` · 4 fields · 5 endpoints", header actions: `Delete` (two-step). Tabs:
  - **Schema**: the fields table restyled dense: columns Field (mono) · Type (badge: `string` `number` `boolean` `date` `email` `url` `enum` `ref` `json`, a small popover to change) · Options/Ref · Required · Unique · reorder handle · delete. "+ Field" row. Save / Discard bar appears only when dirty (sticky at the panel bottom).
  - **Endpoints**: the five standard endpoints listed with a checkbox each (checked = exists, disabled), method label, path, description; "Create selected" button; custom endpoints listed below with "Open". Existing behaviour from `crudOptions`/`buildCrudRoutes`.
  - **Data**: sample records table (mono cells), with a "Reset this resource" secondary action (calls `consoleService.reset` — whole project, labelled "Reset sample data").
- Endpoint selected → kicker `ENDPOINT`, title as `MethodLabel` + full path (`/api/my-store/products/:id`), description editable inline. Tabs:
  - **Request**: method select, path input (`:param` highlighted), action select, resource select, filters (for list), and below a read-only "Example request" code panel (`POST /api/my-store/products` + headers `Content-Type: application/json` + example body when applicable). Save appears when dirty.
  - **Response**: status line (`201 Created` from `exampleResponse`), "Example response" code panel with the JSON, light `CodePanel` tone (the console's response panel is the app's one dark surface; the editor stays light).
  - **Use it**: tabs cURL · JavaScript (fetch) · Python (requests). Each is a code panel with a copy button and the language mark (Simple Icons SVG for JavaScript and Python; a terminal glyph for cURL). Snippets are generated by `lib/snippets.ts` from the endpoint and example body.
  - Header actions: `Send in console` (primary; loads this endpoint into the console with the example body), `Delete` (two-step).

**Console (380px, `--color-page` with `--color-panel` blocks; sticky)**
- Kicker `CONSOLE`. Endpoint picker (compact select, grouped by resource, mono).
- **Request** block: the schema-driven form (or raw JSON toggle), path params, filters. `Send` primary button; `⌘↵` hint.
- **Mock server** strip: `localhost:3000 · /api/my-store` with a thin track; on send a 6px accent packet travels left→right over 600ms, then the response appears.
- **Response** block (slate): header `201 Created · 38ms · application/json` (status coloured: 2xx success-on-slate `#6EE7B7`, 4xx `#FCD34D`, 5xx `#FCA5A5`), body as a JSON tree with slate syntax colours, copy button. Explanation line in muted slate text ("Something in the data you sent needs fixing.").
- **Log** block: kicker `LOG`, rows `POST /products · 201 · 38ms · 12:04:31`, newest first, max 50, session-only (in memory in the console service). Click a row → reloads that request into the form and shows its response. "Clear" link.
- Below 1100px the console collapses to a bottom drawer toggled by a `Console` button in the top bar (badge with the last status). Below 768px the rail becomes a drawer too and the editor takes the width.

### `/projects/[id]/reference`
Same content as today's docs, restyled: left index (resources → endpoints), body with a title, base URL line, per-resource schema table and per-endpoint blocks: `MethodLabel` + path, description, example request panel, example response panel (also light `CodePanel` tone — the reference page has no dark element), "Open in console" link (`/projects/[id]?endpoint=<id>`).

### `/projects/[id]/settings`
Same form on a surface panel; two-step delete.

### ⌘K
Same palette; items styled mono; endpoints listed with method labels; selecting a resource/endpoint opens it in the workspace (`?resource=` / `?endpoint=`).

## 3. New behaviour
- **Request log**: `consoleService.log(projectId): Promise<LogEntry[]>` and `clearLog(projectId)`; `send` appends `{ id, at, routeId, method, path, request, response }`. In-memory only.
- **Snippets**: `buildSnippets(project, route, body?): { curl: string; javascript: string; python: string }` in `src/lib/snippets.ts`, base `http://localhost:3000/api/<slug>`.
- **Endpoint hover preview**: `exampleRequest`/`exampleResponse` reused.
- **Inline rename** for resources and endpoint descriptions.

## 4. Removed
Paper grid, script font, sketch cards, pastel chips, `Build/Test/Docs` tabs, breadcrumb, getting-started strip, resource cards, endpoint card, `/console` page (redirect), `/docs` (redirect to `/reference`).

## 5. Components (src/components)
- `shell/`: `top-bar` (rewritten), `project-switcher`, `project-menu` (kept), `command-palette` (kept, links updated), `workspace-shell` (three panes + responsive drawers).
- `brand/`: `wordmark` (SVG mark + text).
- `domain/`: `method-label`, `type-badge`, `kicker`, `code-panel` (light or slate variant, optional title row, copy), `inline-edit`, `two-step-button` (kept), `status-line`.
- `rail/`: `api-tree`, `tree-node`, `endpoint-preview-popover`, `new-resource-row`.
- `editor/`: `lifecycle-guide`, `resource-editor` (+ `schema-tab`, `endpoints-tab`, `data-tab`), `endpoint-editor` (+ `request-tab`, `response-tab`, `use-it-tab`), `editor-header`.
- `console/`: `console-panel`, `request-form` (kept, restyled), `mock-strip`, `response-panel` (slate), `json-tree` (kept, colour variants), `request-log`.
- `projects/`: `project-list`, `project-row`, `new-project-row`.
- `reference/`: `reference-page` pieces (kept from docs, restyled).

## 6. Testing
- Lib: `snippets.test.ts` (three languages, body included for POST/PUT, params filled with `1`), console-service log tests (append, cap at 50, clear, replay data shape).
- Components: `api-tree` (renders resources and endpoints, selection, keyboard ↑/↓/Enter), `lifecycle-guide` (done states), `resource-editor` schema tab save flow (reuses existing table tests), `endpoints-tab` (creates only selected missing), `endpoint-editor` use-it tab (snippet text present, copy), `console-panel` (send → response shown, log row appended, click log row reloads), `project-list` (rows, new-project row create + validation), `method-label`, `code-panel`.
- Journey test unchanged.
- Manual: 5-second test (is it a mock-API tool?), keyboard tree navigation, 1100px and 768px layouts, contrast of status colours on slate (≥ 4.5:1), Lighthouse a11y ≥ 95.
