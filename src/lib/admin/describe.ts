import type { ActivityEvent } from "./queries";

/** One-line, human description of an activity event for the admin log. */
export function describeEvent(event: Pick<ActivityEvent, "action" | "metadata" | "projectName">): string {
  const meta = event.metadata;
  const text = (key: string): string | null => (typeof meta[key] === "string" ? (meta[key] as string) : null);
  const project = event.projectName ?? text("name");
  const inProject = event.projectName ? ` in ${event.projectName}` : "";

  switch (event.action) {
    case "auth.sign_in":
      return meta.newUser ? "Signed up and signed in" : "Signed in";
    case "project.create":
      return `Created project ${project ?? ""}`.trim();
    case "project.update":
      return `Updated project ${project ?? ""}`.trim();
    case "project.delete":
      return `Deleted project ${text("name") ?? ""}`.trim();
    case "project.restore":
      return `Restored project ${project ?? ""}`.trim();
    case "project.duplicate":
      return `Duplicated a project into ${project ?? "a copy"}`;
    case "model.create":
      return `Added resource ${text("name") ?? ""}${inProject}`;
    case "model.update":
      return `Edited resource ${text("name") ?? ""}${inProject}`;
    case "model.delete":
      return `Deleted resource ${text("name") ?? ""}${inProject}`;
    case "model.restore":
      return `Restored a resource${inProject}`;
    case "route.create": {
      const routes = Array.isArray(meta.routes) ? (meta.routes as string[]) : [];
      return routes.length === 1 ? `Added endpoint ${routes[0]}${inProject}` : `Added ${routes.length} endpoints${inProject}`;
    }
    case "route.update":
      return `Edited endpoint ${text("route") ?? ""}${inProject}`;
    case "route.delete":
      return `Deleted endpoint ${text("route") ?? ""}${inProject}`;
    case "route.restore":
      return `Restored an endpoint${inProject}`;
    case "record.create":
      return `Added a record${inProject}`;
    case "record.delete":
      return `Deleted a record${inProject}`;
    case "records.replace":
      return `Replaced sample data with ${typeof meta.count === "number" ? meta.count : "new"} records${inProject}`;
    case "ai.generate":
      return `Generated an API with AI${inProject}`;
    case "ai.edit":
      return `Edited the API with AI${inProject}`;
    case "token.create":
      return `Created API token ${text("name") ?? ""}`.trim();
    case "token.revoke":
      return "Revoked an API token";
    case "user.role_change":
      return `Changed a user's role to ${text("role") ?? "?"}`;
    default:
      return event.action;
  }
}
