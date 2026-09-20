# Right-click Context Menus — Design

**Status:** proposed
**Date:** 2026-09-20

## 1. The problem

Right-clicking anything in the app today gives Chrome's own link menu — "Open Link in New Tab", "Save Link As…", "Inspect". Useful for a link, useless for a mock API: the things a developer actually wants on a project row (copy the base URL, rename it, delete it) aren't there, and on the Projects page there is currently no delete, rename or duplicate anywhere in the UI at all.

Every desktop-grade tool — VS Code, Figma, Linear — answers a right-click with its own menu, scoped to whatever was clicked. This adds that, and in doing so delivers the Projects-page controls that were missing.

## 2. Scope

Four surfaces get a menu:

| Surface | Target |
|---|---|
| Project rows | Each row on `/projects` |
| Rail tree items | Resource and endpoint rows in the left rail |
| Console | The response body and the request area |
| Page background | Empty space in the workspace editor pane and on `/projects` |

Everywhere else (prose, code blocks, inputs) keeps the browser's menu untouched — selecting and copying text must keep working normally.

## 3. Menu contents

Each item is a plain-language label, with the technical detail as a shortcut hint on the right where one exists. Destructive items sit last, after a separator, in the danger colour.

**Project row**

| Item | Behaviour |
|---|---|
| Open | Navigate to the workspace |
| Open in new tab | `window.open(href, "_blank", "noopener")` |
| Open reference | Navigate to `/projects/<id>/reference` |
| Copy base URL | Copies `<origin>/api/<slug>` to the clipboard, toast "Base URL copied" |
| Rename | Starts inline rename on the row (the row's name becomes an input, Enter commits, Esc cancels) |
| Duplicate | Creates a full copy named `<name> copy` and selects it |
| — | separator |
| Delete | Deletes with an undo toast (no dialog) |

**Rail resource**

Open · Copy path (`/books`) · Generate CRUD endpoints (only when some are missing, labelled with the count, e.g. "Generate 3 missing endpoints") · Rename · separator · Delete (undo toast)

**Rail endpoint**

Open · Send in console · Copy path · Copy as cURL · separator · Delete (undo toast)

**Console response**

Copy response · Copy as cURL · Clear log. "Copy response" copies the pretty-printed JSON body of the response under the cursor.

**Page background**

New resource · New endpoint · separator · Generate with AI · Edit with AI. On `/projects` the background menu is New project (focuses the name input) · Paste project (only when the clipboard holds a project JSON export — omitted from v1, see Non-goals).

Items that cannot apply are **disabled with a reason**, never hidden — a menu that changes shape between rows is harder to learn than one with a greyed item. "Generate CRUD endpoints" is disabled as "All endpoints already exist" when nothing is missing.

## 4. The browser menu stays reachable

**Shift + right-click** anywhere in the app yields Chrome's native menu, unmodified. This is the VS Code / Figma convention and it is what keeps "Inspect", "Open in new tab" and "Save as…" available on our own targets.

Mechanism: a shared wrapper puts an `onContextMenuCapture` handler on the trigger element. When `event.shiftKey` is true it calls `stopPropagation()`, so Radix's own `onContextMenu` never runs, never calls `preventDefault()`, and the browser shows its menu. Capture phase on the trigger element runs before Radix's bubble-phase handler on that same element, so the stop is effective.

A one-line hint — "Shift + right-click for the browser menu" — appears once at the foot of the first custom menu a user opens, and never again (a flag in the UI store's persisted state).

## 5. Architecture

```
src/components/ui/context-menu.tsx        shadcn/Radix primitive (npx shadcn@latest add context-menu)
src/components/domain/context-menu-target.tsx
    <ContextMenuTarget items={…} asChild>  one wrapper: Shift escape hatch, the shared
                                           hint footer, and item rendering from a data array
src/lib/context-menu-items.ts             pure builders: projectItems(project, handlers),
                                           resourceItems(...), endpointItems(...),
                                           consoleItems(...), backgroundItems(...)
```

Menus are **declared as data, not JSX**: each builder returns `ContextMenuItemSpec[]`
(`{ id, label, hint?, disabled?, disabledReason?, danger?, separatorBefore?, onSelect }`).
This keeps the four call sites free of menu markup, makes every menu unit-testable without
rendering, and means an item's availability logic is a pure function over the project state.

`ContextMenuTarget` is the only component that knows about Radix. The call sites wrap their
existing row markup in it and pass a spec array — no other change to those components.

## 6. New behaviour behind the menus

Everything except two items already exists in the service layer (`projectService.remove`/`restore`/`update`, `modelService`, `routeService`, `buildSnippets`, `buildCrudRoutes`).

**`projectService.duplicate(id): Promise<Project>`** — new. Deep-copies the project with fresh
ids for the project, every model, every field and every route, remapping `field.linkTo` and
`route.modelId` through the old→new id map, naming the copy `<name> copy` (`copy 2`, `copy 3`…
when taken) with a slug derived from the new name. The console dataset is copied too, rekeyed
from old model id to new, so the duplicate answers requests with the same sample records as the
original rather than an empty store.

**Inline rename on a project row** — the row's name swaps to an input in place, reusing the
existing `InlineEdit` component from the workspace editor. No dialog.

## 7. Error handling

Every menu action is an awaited service call wrapped in try/catch, reporting failure through a
`toast.error` with a plain-language message ("Could not duplicate this API."). Destructive
actions show a success toast carrying an **Undo** action wired to the existing `restore*` store
methods — the same pattern the app already uses for deleting a resource. Clipboard writes fall
back to a toast explaining the copy failed when `navigator.clipboard` is unavailable or denied.

## 8. Accessibility

Radix's ContextMenu gives keyboard invocation (Shift+F10 or the Menu key on a focused row),
roving focus, type-ahead, Esc to dismiss and correct `role="menu"` semantics for free. Each
target row must therefore be focusable — the project rows and rail items are already links or
buttons, so this holds. Disabled items keep their reason in `aria-description` so a screen
reader hears why.

## 9. Testing

- Unit: each builder in `context-menu-items.ts` — right items, right order, right disabled
  states for a project with and without missing endpoints.
- Unit: `projectService.duplicate` — new ids everywhere, `linkTo`/`modelId` remapped, dataset
  rekeyed, name collision handling.
- Component: `ContextMenuTarget` — a plain right-click opens the menu and calls
  `preventDefault`; a Shift+right-click does neither.
- Component: one call site per surface — right-click a project row, click Delete, assert the
  undo toast and that the project is gone; right-click with Shift, assert no menu.

## 10. Non-goals for v1

- Multi-select and bulk actions on the Projects page.
- Copy/paste of a whole project as JSON between browser tabs.
- A custom menu on text and code blocks — native selection and copy stay untouched there.
- Nested submenus. Every menu is one flat list; "Open Link as →" style nesting is not needed at
  this size.
