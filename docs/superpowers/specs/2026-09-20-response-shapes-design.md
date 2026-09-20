# Custom Response Shapes — Design

**Status:** proposed
**Date:** 2026-09-20

## 1. The problem

Today an endpoint's response shape is hardcoded in the engine. A list returns `{data, count}`, a get returns the bare record, a create returns the record, a delete returns 204. There is no way to say "wrap it in `{success: true, result: {...}}`", to choose a status code, or to return a hand-written body.

Worse, an endpoint whose action is `custom` returns a literal placeholder:

> "This route has no model action yet. Link it to a model to return data."

That is a dead end, and it is reachable: the AI edit feature *generates* custom endpoints. A proposed `GET /books/best-selling` is created and then answers with that sentence forever.

The goal is that a person — or Claude, through MCP — can make an endpoint return whatever JSON they want, in whatever shape, with whatever status, connected to real stored data or not.

## 2. The model

`Route` gains an optional `response`. Absent means today's behaviour, so every existing route keeps working untouched.

```ts
type ResponseMode = "auto" | "template" | "static";

interface RouteResponse {
  mode: ResponseMode;
  /** Overrides the engine's status. Auto mode keeps the engine's status when absent. */
  status?: number;
  /** Extra response headers, e.g. X-RateLimit-Remaining. */
  headers?: Record<string, string>;
  /** template mode: JSON containing {{placeholders}}. */
  template?: unknown;
  /** static mode: returned verbatim. */
  body?: unknown;
  /** Lets a custom endpoint read real data. Ignored in the CRUD actions. */
  query?: ResponseQuery;
}

interface ResponseQuery {
  modelId: string;
  filter?: { field: string; op: "eq" | "neq" | "gt" | "lt" | "contains"; value: string }[];
  sort?: { field: string; dir: "asc" | "desc" };
  limit?: number;
}
```

### auto

Exactly what happens today. This stays the default so nothing changes for anyone who does not ask for more.

### template

The engine runs as normal, then its result is poured into the user's shape:

```json
{
  "success": true,
  "result": { "items": "{{records}}", "total": "{{count}}" },
  "requestId": "{{uuid}}",
  "servedAt": "{{now}}"
}
```

Placeholders: `{{records}}`, `{{record}}`, `{{count}}`, `{{params.<name>}}`, `{{query.<name>}}`, `{{body.<name>}}`, `{{now}}`, `{{uuid}}`.

**The substitution rule that matters:** a string whose entire value is a single placeholder is replaced by the *typed* value — `"items": "{{records}}"` yields a real JSON array, not a string containing one. A placeholder inside a longer string interpolates as text: `"message": "Found {{count}} books"` yields `"Found 3 books"`. Without this distinction, every templated array would arrive at the client as a quoted blob, which would make the feature useless in practice.

An unknown placeholder resolves to `null` and adds a warning visible in the editor, rather than failing the request. A mock that 500s because of a typo in a template is worse than one that returns a null.

### static

`body` is returned verbatim with `status` (default 200). No engine involvement. This is what makes a custom endpoint work at all, and it is the mode for mocking a third-party API you are integrating against.

### query, for custom endpoints

A custom endpoint with a `query` reads real records rather than inventing them, so `GET /books/best-selling` can return the actual top books, filtered and sorted, and keeps working as the data changes. Combined with `template`, the result can be shaped however the caller likes.

## 3. Templates are data, never code

Substitution is literal placeholder replacement. There is no expression language, no arithmetic, no property-path traversal beyond the fixed `params`/`query`/`body` lookups, and nothing is ever `eval`'d.

This is a deliberate constraint, not an omission. These templates will be written by an AI acting on a user's instruction and served from a public endpoint; a template language with evaluation would be a remote code execution hole reachable by prompt injection. If richer logic is ever genuinely needed, it gets designed separately, sandboxed, and on purpose.

Both `template` and `body` are capped at 100KB and must be valid JSON. The cap is enforced server-side at write time, not only in the editor.

## 4. Where it takes effect

`executeRoute` in `src/lib/mock-engine.ts` stays the authority on CRUD behaviour and keeps its current signature and return type. Shaping happens in a new pure function applied to the engine's result:

```
src/lib/response-shape.ts
  applyResponseShape(route, engineResult, context) -> { status, headers, body }
  runResponseQuery(model, records, query) -> DataRecord[]
```

`context` carries `params`, `query`, `body` and the resolved records. Being pure and separate keeps it trivially testable and keeps the engine from growing a second responsibility.

The `custom` action's placeholder message disappears: a custom route with a `response` uses it, and one without returns a 501 with a plain-language body saying the endpoint has no response defined yet and how to set one — a bug report, not a lie.

## 5. UI

The endpoint editor gains a Response section: a three-way mode toggle, a JSON editor for template/static with the placeholder list beside it, a status field, and a headers table. A live preview panel renders the shaped response against the project's real records so the user sees exactly what a caller will get, including a warning line for any unknown placeholder.

## 6. MCP

One tool, `set_endpoint_response`, taking the endpoint id and a `RouteResponse`. With it, "make `/orders/:id` return a 503 with a `Retry-After` header" or "wrap every list response in `{status, data, meta}`" become one-sentence requests.

This is also why conditional/scripted responses are deliberately **not** in scope. The usual reason to build a rules engine is that changing a mock mid-test is slow; when Claude can rewrite the endpoint in a second, the scenario is reachable without anyone shipping an interpreter. If real demand appears later, it will be for specific cases we can then design against evidence.

## 7. Testing

- `applyResponseShape`: typed whole-string substitution versus in-string interpolation; every placeholder; unknown placeholder yields null plus a warning; static returns verbatim; auto is byte-identical to today's output for every CRUD action.
- `runResponseQuery`: each operator, sort both directions, limit, and a filter naming a field that does not exist.
- Through `/api/:slug/*`: a templated list, a static custom endpoint, a queried custom endpoint, a custom status, and a custom header all arriving at a real HTTP client.
- Size cap and invalid JSON rejected at write time with a plain-language error.
- Every existing route with no `response` continues to return exactly what it returns today — this is the regression that matters most.

## 8. Non-goals

- Conditional or scripted responses (see §6).
- Per-request state, counters or sequences.
- Response delays and fault injection — worth doing, but separate.
- XML or non-JSON bodies.
