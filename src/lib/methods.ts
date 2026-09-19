import type { HttpMethod } from "./types";

export const METHODS: HttpMethod[] = ["GET", "POST", "PUT", "PATCH", "DELETE"];

export const METHOD_META: Record<HttpMethod, { label: string; hint: string; className: string }> = {
  GET: { label: "Read", hint: "Fetch data without changing anything", className: "bg-pastel-mint text-pastel-mint-ink" },
  POST: { label: "Create", hint: "Add something new", className: "bg-pastel-blue text-pastel-blue-ink" },
  PUT: { label: "Update", hint: "Change an existing record", className: "bg-pastel-peach text-pastel-peach-ink" },
  PATCH: { label: "Edit", hint: "Change part of an existing record", className: "bg-pastel-lavender text-pastel-lavender-ink" },
  DELETE: { label: "Delete", hint: "Remove a record", className: "bg-pastel-rose text-pastel-rose-ink" },
};
