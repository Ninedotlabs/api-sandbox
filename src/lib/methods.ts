import type { HttpMethod } from "./types";

export const METHODS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];

export const METHOD_META: Record<HttpMethod, { label: string; hint: string; className: string }> = {
  GET: { label: "Read", hint: "Fetch data without changing anything", className: "text-method-get bg-method-get/15 border-method-get/30" },
  POST: { label: "Create", hint: "Add something new", className: "text-method-post bg-method-post/15 border-method-post/30" },
  PUT: { label: "Update", hint: "Change an existing record", className: "text-method-put bg-method-put/15 border-method-put/30" },
  PATCH: { label: "Edit", hint: "Change part of an existing record", className: "text-method-patch bg-method-patch/15 border-method-patch/30" },
  DELETE: { label: "Delete", hint: "Remove a record", className: "text-method-delete bg-method-delete/15 border-method-delete/30" },
};
