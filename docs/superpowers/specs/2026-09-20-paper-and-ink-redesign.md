# Paper & Ink redesign — UI design spec

Supersedes the visual system and shell/flow sections of `2026-09-19-universal-api-ui-design.md`. Domain logic, the service layer, the stores and the mock engine are unchanged.

## Why
The first version has a dark, sidebar-and-dialog "dev tool" look. The product is for people who don't write code, and it should feel light, crafted and playful, with everything happening on one page instead of in popups. The reference is mockapi.io's project page: grid paper, monospace type, a script logo, coloured URL segments, tactile buttons and dashed resource cards.

## Decisions
- Light only. No theme toggle, no dark tokens, `next-themes` removed.
- Personality: "Paper & ink" (below).
- Flows: one canvas per project; no dialogs for creating or editing. ⌘K search stays.
- URLs kept: `/projects`, `/projects/new` (redirects to `/projects`), `/projects/[id]` (Build), `/projects/[id]/console` (Test), `/projects/[id]/docs`, `/projects/[id]/settings`. `/projects/[id]/models/*` and `/projects/[id]/routes/*` are removed.

## 1. Visual system

### Tokens (`src/app/globals.css`, Tailwind v4 `@theme inline`)
| Token | Value | Use |
|---|---|---|
| `--paper` | `#F7F7F4` | page background |
| `--grid-line` | `#E9E9E4` | graph-paper lines |
| `--card` | `#FFFFFF` | cards |
| `--ink` | `#18181B` | text |
| `--ink-muted` | `#6B6B72` | secondary text |
| `--line` | `#E4E4DF` | hairline borders |
| `--primary` | `#3B5BDB` | links, primary button, focus ring |
| `--primary-ink` | `#FFFFFF` | text on primary |
| `--soft` | `#EEEEEA` | secondary button fill, chips |
| `--soft-hover` | `#E4E4DF` | |
| `--danger` | `#E5484D` | destructive |
| `--success` | `#2F9E62` | |
| `--warning` | `#D97706` | |
| Highlighter pastels (fill / text) | blue `#DCE6FF`/`#2B4ACB`, violet `#E9DDFF`/`#6B3FD1`, peach `#FFE4D1`/`#9A4508`, mint `#D8F5E3`/`#1F7A48`, lavender `#E6E0FF`/`#5A3EBF`, rose `#FFDCDF`/`#B3262E`, lemon `#FFF3C4`/`#8A6100` | URL segments, method chips, field-type chips |

Method chips: GET mint, POST blue, PUT peach, PATCH lavender, DELETE rose. URL segments: `/api` blue, `/{slug}` violet, `/:param` peach. Field-type chips: lemon.

Grid: `background-image` of two `linear-gradient`s (horizontal + vertical 1px `--grid-line`), `background-size: 32px 32px`, on `body`.

### Type
- UI: JetBrains Mono (already loaded), 13px base for controls, 14px for body, 20/28px headings. Letter-spacing normal.
- Script: Pacifico (Google Fonts, `next/font`) for the logo wordmark "universal" and for two flourishes: the "you're all set" line and the empty-state headline on `/projects`.

### Shape and depth
- Radius: 12px for buttons and inputs, 16px for cards, 999px for chips.
- Cards: `--card` fill, 1px `--line` border, shadow `0 1px 2px rgb(24 24 27 / 4%), 0 8px 24px rgb(24 24 27 / 6%)`.
- Sketch cards (resources, new-item cards): 1.5px dashed `#C9C9C2` border, transparent fill, 16px radius; on hover the border turns solid `--line` and the card gets the card shadow.
- Buttons: soft pills. Secondary = `--soft` fill, `--ink` text; primary = `--primary` fill, white text; danger = rose pastel fill, rose text; ghost = transparent. All: `active:translate-y-px`, 150ms.
- Inputs: white, 1px `--line`, 12px radius, focus ring 2px `--primary`.
- Focus: visible 2px `--primary` ring everywhere. WCAG AA contrast on all pastel text pairs above.

### Motion
150ms ease-out for hover/press, 200ms for panels expanding, new cards fade + 4px slide-in. `prefers-reduced-motion` respected.

## 2. Screens and flows

### Shell
- Top bar (transparent over the grid): script wordmark "universal" (link to `/projects`), right side: **Docs** text link (to the current project's docs when inside a project, otherwise the first project's, otherwise hidden), avatar circle "You".
- Inside a project, a breadcrumb row below: `Projects / [initial tile] project-name  ⋮`. The initial tile is a violet pastel square with the first letter. The `⋮` menu (dropdown; menus are fine, dialogs aren't): Settings, Reset sample data, Delete project (Delete project here is a two-step item: first click turns it into "Sure? Delete" for 3s).
- Tabs under the breadcrumb: **Build · Test · Docs** as pill tabs; the active one is `--soft` filled.
- Max width 1180px, centred; on phones everything stacks and cards are full-width.

### `/projects` (Your APIs)
- Heading "Your APIs" with the count. Grid of project cards (white cards): initial tile, name, `/api/slug` in mono muted, "3 models · 5 routes", "edited 2 hours ago".
- First card in the grid is the **New project card** (sketch card): a name input, a row of template chips (Blank · 📝 Blog · 🛒 Store · ✅ To-do; Blank selected by default), and a **Create** primary button. Enter submits. Validation uses `validateProjectName`; errors show inline under the input.
- Empty state: the script headline "Let's make an API" above the new-project card, with the three template chips doing the same job. No wizard.
- `/projects/new` redirects to `/projects` (keeps old links working).

### `/projects/[id]` — Build (the workbench)
Top to bottom:
1. **Getting-started strip** (only while incomplete): a slim white card, five steps as chips with a check when done, and the next step's button. Uses `buildChecklist`. Hidden once all done, replaced by nothing.
2. **API endpoint card** (white card):
   - Title "API endpoint".
   - The URL as segments: `http://localhost:3000` muted, `/api` blue pill, `/{slug}` violet pill, `/:resource` peach pill. Copy button on the right copies `baseUrl(slug)`.
   - Action row (soft grey band inside the card): **New model** (primary), and on the right **Generate all** (secondary; creates the five standard endpoints for every model that lacks any of them; disabled with tooltip "Every model already has its endpoints" when nothing to do) and **Reset data** (secondary; `consoleService.reset`).
3. **Resource cards**, one per model, sketch style, in a vertical list. Each card header row:
   - Left: the model's name in mono (14px) and a small record bar: a 96px track with a violet fill proportional to sample-record count (max = the largest count among models) and the number next to it (from `consoleService.sampleData(...).length`).
   - Middle: field count chip ("4 fields") and one method chip per route (in canonical order).
   - Right: pill buttons **Fields · Routes · Data** (toggle; the open one is `--soft` filled) and a rose trash icon button.
   - Below the header, the open panel (accordion; only one panel open per card, any number of cards open):
     - **Fields** = existing `ModelFieldTable` restyled (paper inputs, lemon type chips, dashed "+ Add field" row). Save/Discard buttons at the bottom of the panel.
     - **Routes** = list of the model's routes (method chip, path with peach `:id`, friendly name, a **Test** link to `/console?route=…`, trash). Below it, if any standard endpoint is missing, an inline row "Add standard endpoints:" with the five options as toggle chips (existing ones shown checked and disabled) and an **Add** button. Below that, a "+ Custom route" button that appends an inline route editor (the existing `RouteEditor` restyled) for a new route, and each route row can expand into the same editor via an "Edit" link.
     - **Data** = `SampleDataTable` restyled.
   - Trash: deletes the model immediately with the Undo toast (existing behaviour).
4. **New model**: pressing the button appends a sketch card at the end with a focused name input and a hint "Singular, like Customer". Enter creates it (existing `createModel`), Escape removes the card. Validation inline. A newly created model's card opens on **Fields** automatically.
5. "Other routes" (routes with no model): if any exist, a final sketch card titled "Other routes" listing them like the Routes panel, with the "+ Custom route" button.

### `/projects/[id]/console` — Test
Same three-column layout as today (route picker · request · response), restyled: picker as a white card with method chips, request form in a white card, response card with the status chip in a pastel (mint 2xx, peach 4xx, rose 5xx). Copy stays.

### `/projects/[id]/docs`
Same structure, restyled: section nav on the left as pill links, endpoint cards white with the URL as coloured segments, examples in a paper code block (`--soft` background).

### `/projects/[id]/settings`
Same form, restyled; the delete card uses the two-step button instead of a dialog. Reached from the `⋮` menu.

### ⌘K search
Kept; restyled as a white card over a paper scrim. The Search button in the top bar shows `⌘K`.

## 3. Components

New (`src/components/`):
- `shell/top-bar.tsx` (rewritten), `shell/breadcrumb.tsx`, `shell/project-tabs.tsx`, `shell/project-menu.tsx`, `shell/project-shell.tsx` (rewritten: top bar + breadcrumb + tabs + content), `shell/dashboard-header.tsx` (rewritten: top bar only).
- `domain/wordmark.tsx` (script logo), `domain/url-segments.tsx` (coloured URL pills), `domain/sketch-card.tsx`, `domain/two-step-button.tsx`, `domain/method-badge.tsx` (restyled chip), `domain/type-chip.tsx`.
- `dashboard/new-project-card.tsx`.
- `build/getting-started-strip.tsx`, `build/endpoint-card.tsx`, `build/resource-card.tsx`, `build/resource-fields-panel.tsx`, `build/resource-routes-panel.tsx` (includes the standard-endpoints row and inline route editors), `build/resource-data-panel.tsx`, `build/new-model-card.tsx`, `build/other-routes-card.tsx`.

Removed: `theme-provider.tsx`, `theme-toggle.tsx` (+test), `shell/app-sidebar.tsx` (+test), `shell/nav-items.ts`, `shell/project-switcher.tsx`, `dashboard/create-project-wizard.tsx` (+test), `models/new-model-dialog.tsx`, `models/model-list.tsx`, `models/model-editor.tsx`, `routes/crud-generator-dialog.tsx` (+test), `routes/crud-banner.tsx`, `routes/route-row.tsx`, `home/onboarding-checklist.tsx` (+test), the `models/*` and `routes/*` app pages, `projects/new/page.tsx` becomes a redirect. `next-themes` uninstalled.

Kept and restyled: `models/model-field-table.tsx` + `field-row.tsx` + `field-type-picker.tsx`, `models/sample-data-table.tsx`, `routes/route-editor.tsx`, `routes/path-preview.tsx`, `console/*`, `docs/*`, `domain/{empty-state,page-header,copy-button,code-block,help-hint,project-card,template-card→ used as template chips}`, `shell/command-palette.tsx`, `shell/logo.tsx` → replaced by wordmark.

Pure logic additions (`src/lib`): `generateAllCrud(project): Route[]` (routes to add for every model missing standard endpoints, canonical order) and `recordCounts(project, consoleService)` helper inside the build page (not a lib).

## 4. Testing
- Lib tests untouched except a new `generateAllCrud` test.
- Component tests (React Testing Library): `new-project-card` (create with template, validation), `resource-card` (opens/closes panels, shows method chips and field count), `resource-routes-panel` (standard-endpoints row adds only missing routes; custom route editor appears inline), `new-model-card` (Enter creates, Escape cancels, validation), `two-step-button`, `url-segments`, `project-tabs` (active state), `project-menu` (two-step delete).
- Journey test unchanged (it's store-level).
- Manual: walk Store template → open Product → Fields → add field → Routes → add standard endpoints → Test 400/201 → Docs. Phone width. Keyboard through the new-project card and resource card buttons. Lighthouse a11y ≥ 95.
