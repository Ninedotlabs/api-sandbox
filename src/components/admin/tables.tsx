import Link from "next/link";
import type { AdminProject, AdminUser } from "@/lib/admin/queries";
import { timeAgo } from "@/lib/format";
import { EmptyRow } from "./admin-page";
import { RoleToggle } from "./role-toggle";

const TH = "px-4 py-2 text-left text-xs font-medium text-ink-3 whitespace-nowrap";
const TD = "px-4 py-3 text-sm text-ink-2 whitespace-nowrap";

export function RoleBadge({ role }: { role: AdminUser["role"] }) {
  return role === "admin" ? (
    <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-ink">Admin</span>
  ) : (
    <span className="rounded-full border border-line px-2 py-0.5 text-xs text-ink-3">User</span>
  );
}

export function UsersTable({ users }: { users: AdminUser[] }) {
  if (users.length === 0) return <EmptyRow>No one has signed in yet.</EmptyRow>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px]">
        <thead className="border-b border-line bg-panel/50">
          <tr>
            <th className={TH}>User</th>
            <th className={TH}>Role</th>
            <th className={TH}>Joined</th>
            <th className={TH}>Last active</th>
            <th className={TH}>Projects</th>
            <th className={TH}>Tokens</th>
            <th className={TH}>
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {users.map((user) => (
            <tr key={user.id}>
              <td className={`${TD} max-w-[280px]`}>
                <Link href={`/admin/users/${user.id}`} className="block truncate font-medium text-ink hover:underline">
                  {user.email ?? user.id}
                </Link>
                {user.name && <span className="block truncate text-xs text-ink-3">{user.name}</span>}
              </td>
              <td className={TD}>
                <RoleBadge role={user.role} />
              </td>
              <td className={TD}>{timeAgo(user.createdAt)}</td>
              <td className={TD}>{user.lastActiveAt ? timeAgo(user.lastActiveAt) : "—"}</td>
              <td className={TD}>{user.projectCount}</td>
              <td className={TD}>{user.tokenCount}</td>
              <td className={`${TD} text-right`}>
                <RoleToggle userId={user.id} role={user.role} email={user.email} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ProjectsTable({ projects, showOwner = true }: { projects: AdminProject[]; showOwner?: boolean }) {
  if (projects.length === 0) return <EmptyRow>No projects.</EmptyRow>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px]">
        <thead className="border-b border-line bg-panel/50">
          <tr>
            <th className={TH}>Project</th>
            {showOwner && <th className={TH}>Owner</th>}
            <th className={TH}>Endpoints</th>
            <th className={TH}>Records</th>
            <th className={TH}>Updated</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {projects.map((project) => (
            <tr key={project.id}>
              <td className={`${TD} max-w-[280px]`}>
                <Link href={`/projects/${project.id}`} className="block truncate font-medium text-ink hover:underline">
                  {project.name}
                </Link>
                <span className="block truncate font-mono text-xs text-ink-3">/api/{project.slug}</span>
              </td>
              {showOwner && (
                <td className={`${TD} max-w-[240px] truncate`}>
                  {project.ownerId ? (
                    <Link href={`/admin/users/${project.ownerId}`} className="hover:text-ink hover:underline">
                      {project.ownerEmail ?? project.ownerId}
                    </Link>
                  ) : (
                    "No owner"
                  )}
                </td>
              )}
              <td className={TD}>{project.routeCount}</td>
              <td className={TD}>{project.recordCount}</td>
              <td className={TD}>{timeAgo(project.updatedAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
