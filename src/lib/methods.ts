import type { HttpMethod } from "./types";

export const METHODS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];

export const METHOD_META: Record<HttpMethod, { label: string; hint: string; className: string }> = {
  GET: { label: "Read", hint: "Fetch data without changing anything", className: "text-method-get bg-method-get-tint" },
  POST: { label: "Create", hint: "Add something new", className: "text-method-post bg-method-post-tint" },
  PUT: { label: "Update", hint: "Change an existing record", className: "text-method-put bg-method-put-tint" },
  PATCH: { label: "Edit", hint: "Change part of an existing record", className: "text-method-patch bg-method-patch-tint" },
  DELETE: { label: "Delete", hint: "Remove a record", className: "text-method-delete bg-method-delete-tint" },
};
