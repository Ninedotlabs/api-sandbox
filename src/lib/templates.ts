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
