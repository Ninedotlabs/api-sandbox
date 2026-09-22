import { AdminPage, AdminPanel } from "@/components/admin/admin-page";
import { ProjectsTable } from "@/components/admin/tables";
import { requireAdminPage } from "@/lib/admin/guard";
import { listAllProjects } from "@/lib/admin/queries";
import { countLabel } from "@/lib/format";

export const metadata = { title: "Projects - Admin - Universal API" };

export default async function AdminProjectsPage() {
  await requireAdminPage();
  const projects = await listAllProjects();

  return (
    <AdminPage
      heading="Projects"
      description={`${countLabel(projects.length, "project")} across every account. Open one to view or edit it as an admin.`}
    >
      <AdminPanel>
        <ProjectsTable projects={projects} />
      </AdminPanel>
    </AdminPage>
  );
}
