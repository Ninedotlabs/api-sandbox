import type { HttpMethod, RouteAction } from "./types";

export const ACTION_META: Record<RouteAction, { label: string; description: string; method: HttpMethod }> = {
  list: { label: "List records", description: "Returns every record, with optional filters", method: "GET" },
  get: { label: "Get one record", description: "Returns a single record by its id", method: "GET" },
  create: { label: "Add a record", description: "Saves a new record from the data you send", method: "POST" },
  update: { label: "Update a record", description: "Changes the fields you send on an existing record", method: "PUT" },
  delete: { label: "Delete a record", description: "Removes a record by its id", method: "DELETE" },
  custom: { label: "Custom", description: "Returns a simple message. Link a model to return data", method: "GET" },
};

export const ACTIONS = Object.keys(ACTION_META) as RouteAction[];
