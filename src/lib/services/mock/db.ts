import type { Project } from "@/lib/types";

// Exported so `src/lib/migrate-local.ts` reads the *real* key rather than a guess that could
// silently drift from this one and leave the one-time import looking at nothing.
export const KEY = "universal-api:db:v1";

interface DbShape {
  projects: Project[];
}

export function readDb(): DbShape {
  if (typeof window === "undefined") return { projects: [] };
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as DbShape) : { projects: [] };
  } catch {
    return { projects: [] };
  }
}

export function writeDb(db: DbShape) {
  localStorage.setItem(KEY, JSON.stringify(db));
}

export function findProject(id: string): Project | undefined {
  return readDb().projects.find((p) => p.id === id);
}

export function updateProject(id: string, change: (project: Project) => Project): Project {
  const db = readDb();
  const index = db.projects.findIndex((p) => p.id === id);
  if (index < 0) throw new Error("This API no longer exists.");
  const next = { ...change(db.projects[index]), updatedAt: new Date().toISOString() };
  db.projects[index] = next;
  writeDb(db);
  return next;
}
