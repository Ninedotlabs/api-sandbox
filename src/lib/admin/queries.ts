import { query } from "@/lib/db/client";
import type { ActivityChannel } from "@/lib/activity/record";
import type { UserRole } from "@/lib/auth/roles";

/**
 * Read-only queries behind `/admin` (see
 * `docs/superpowers/specs/2026-09-22-admin-dashboard-design.md` §4). Every function here
 * reads across all accounts, so callers must have passed `requireAdminPage` first.
 */

export const ACTIVITY_PAGE_SIZE = 50;

export interface ActivityEvent {
  id: string;
  actorUserId: string | null;
  actorEmail: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  projectId: string | null;
  projectName: string | null;
  channel: ActivityChannel;
  metadata: Record<string, unknown>;
  createdAt: string;
}

interface ActivityRow {
  id: string;
  actor_user_id: string | null;
  actor_email: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  project_id: string | null;
  project_name: string | null;
  channel: ActivityChannel;
  metadata: Record<string, unknown> | null;
  created_at: Date;
}

function eventFromRow(row: ActivityRow): ActivityEvent {
  return {
    id: row.id,
    actorUserId: row.actor_user_id,
    actorEmail: row.actor_email,
    action: row.action,
    targetType: row.target_type,
    targetId: row.target_id,
    projectId: row.project_id,
    projectName: row.project_name,
    channel: row.channel,
    metadata: row.metadata ?? {},
    createdAt: row.created_at.toISOString(),
  };
}

const EVENT_COLUMNS = `e.id, e.actor_user_id, e.actor_email, e.action, e.target_type, e.target_id,
  e.project_id, p.name as project_name, e.channel, e.metadata, e.created_at`;

export interface ActivityFilter {
  userId?: string;
  action?: string;
  channel?: ActivityChannel;
  page?: number;
}

export async function listActivity(filter: ActivityFilter = {}): Promise<{ events: ActivityEvent[]; total: number }> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter.userId) {
    params.push(filter.userId);
    where.push(`e.actor_user_id = $${params.length}`);
  }
  if (filter.action) {
    params.push(filter.action);
    where.push(`e.action = $${params.length}`);
  }
  if (filter.channel) {
    params.push(filter.channel);
    where.push(`e.channel = $${params.length}`);
  }
  const whereSql = where.length ? `where ${where.join(" and ")}` : "";
  const page = Math.max(1, Math.floor(filter.page ?? 1));

  const [{ rows }, count] = await Promise.all([
    query<ActivityRow>(
      `select ${EVENT_COLUMNS}
       from activity_events e
       left join projects p on p.id = e.project_id
       ${whereSql}
       order by e.created_at desc, e.id desc
       limit ${ACTIVITY_PAGE_SIZE} offset ${(page - 1) * ACTIVITY_PAGE_SIZE}`,
      params,
    ),
    query<{ count: string }>(`select count(*) from activity_events e ${whereSql}`, params),
  ]);
  return { events: rows.map(eventFromRow), total: Number(count.rows[0].count) };
}

export async function listActivityActions(): Promise<string[]> {
  const { rows } = await query<{ action: string }>("select distinct action from activity_events order by action");
  return rows.map((row) => row.action);
}

export interface AdminOverview {
  users: number;
  admins: number;
  projects: number;
  routes: number;
  records: number;
  eventsLastDay: number;
  recent: ActivityEvent[];
}

export async function getOverview(): Promise<AdminOverview> {
  const [{ rows }, recent] = await Promise.all([
    query<Record<"users" | "admins" | "projects" | "routes" | "records" | "events_last_day", string>>(
      `select
         (select count(*) from users) as users,
         (select count(*) from users where role = 'admin') as admins,
         (select count(*) from projects) as projects,
         (select count(*) from routes) as routes,
         (select count(*) from records) as records,
         (select count(*) from activity_events where created_at > now() - interval '1 day') as events_last_day`,
    ),
    query<ActivityRow>(
      `select ${EVENT_COLUMNS}
       from activity_events e
       left join projects p on p.id = e.project_id
       order by e.created_at desc, e.id desc
       limit 10`,
    ),
  ]);
  const row = rows[0];
  return {
    users: Number(row.users),
    admins: Number(row.admins),
    projects: Number(row.projects),
    routes: Number(row.routes),
    records: Number(row.records),
    eventsLastDay: Number(row.events_last_day),
    recent: recent.rows.map(eventFromRow),
  };
}

export interface AdminUser {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: UserRole;
  createdAt: string;
  /** The latest logged event or API-token use - null if neither has happened. */
  lastActiveAt: string | null;
  projectCount: number;
  tokenCount: number;
}

interface UserRow {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: string;
  created_at: Date;
  last_active_at: Date | null;
  project_count: string;
  token_count: string;
}

function userFromRow(row: UserRow): AdminUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    image: row.image,
    role: row.role === "admin" ? "admin" : "user",
    createdAt: row.created_at.toISOString(),
    lastActiveAt: row.last_active_at?.toISOString() ?? null,
    projectCount: Number(row.project_count),
    tokenCount: Number(row.token_count),
  };
}

const USER_SELECT = `
  select u.id, u.name, u.email, u.image, u.role, u.created_at,
         greatest(
           (select max(created_at) from activity_events where actor_user_id = u.id),
           (select max(last_used_at) from api_tokens where user_id = u.id)
         ) as last_active_at,
         (select count(*) from projects where owner_id = u.id) as project_count,
         (select count(*) from api_tokens where user_id = u.id) as token_count
  from users u`;

export async function listUsers(): Promise<AdminUser[]> {
  const { rows } = await query<UserRow>(`${USER_SELECT} order by u.created_at desc, u.id`);
  return rows.map(userFromRow);
}

export interface AdminProject {
  id: string;
  name: string;
  slug: string;
  ownerId: string | null;
  ownerEmail: string | null;
  routeCount: number;
  recordCount: number;
  updatedAt: string;
}

interface ProjectRow {
  id: string;
  name: string;
  slug: string;
  owner_id: string | null;
  owner_email: string | null;
  route_count: string;
  record_count: string;
  updated_at: Date;
}

function projectFromRow(row: ProjectRow): AdminProject {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    ownerId: row.owner_id,
    ownerEmail: row.owner_email,
    routeCount: Number(row.route_count),
    recordCount: Number(row.record_count),
    updatedAt: row.updated_at.toISOString(),
  };
}

const PROJECT_SELECT = `
  select p.id, p.name, p.slug, p.owner_id, u.email as owner_email, p.updated_at,
         (select count(*) from routes where project_id = p.id) as route_count,
         (select count(*) from records r join models m on m.id = r.model_id where m.project_id = p.id) as record_count
  from projects p
  left join users u on u.id = p.owner_id`;

export async function listAllProjects(): Promise<AdminProject[]> {
  const { rows } = await query<ProjectRow>(`${PROJECT_SELECT} order by p.updated_at desc, p.id`);
  return rows.map(projectFromRow);
}

export interface AdminUserDetail {
  user: AdminUser;
  projects: AdminProject[];
  tokens: { id: string; name: string; createdAt: string; lastUsedAt: string | null }[];
  /** Expiry only - the session token itself never leaves the server. */
  sessions: { expires: string }[];
  activity: ActivityEvent[];
}

export async function getUserDetail(userId: string): Promise<AdminUserDetail | null> {
  const { rows } = await query<UserRow>(`${USER_SELECT} where u.id = $1`, [userId]);
  if (!rows[0]) return null;

  const [projects, tokens, sessions, activity] = await Promise.all([
    query<ProjectRow>(`${PROJECT_SELECT} where p.owner_id = $1 order by p.updated_at desc, p.id`, [userId]),
    query<{ id: string; name: string; created_at: Date; last_used_at: Date | null }>(
      "select id, name, created_at, last_used_at from api_tokens where user_id = $1 order by created_at desc",
      [userId],
    ),
    query<{ expires: Date }>("select expires from sessions where user_id = $1 and expires > now() order by expires desc", [userId]),
    listActivity({ userId }),
  ]);

  return {
    user: userFromRow(rows[0]),
    projects: projects.rows.map(projectFromRow),
    tokens: tokens.rows.map((t) => ({
      id: t.id,
      name: t.name,
      createdAt: t.created_at.toISOString(),
      lastUsedAt: t.last_used_at?.toISOString() ?? null,
    })),
    sessions: sessions.rows.map((s) => ({ expires: s.expires.toISOString() })),
    activity: activity.events,
  };
}
