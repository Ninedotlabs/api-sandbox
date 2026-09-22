import { AdminPage, AdminPanel } from "@/components/admin/admin-page";
import { UsersTable } from "@/components/admin/tables";
import { requireAdminPage } from "@/lib/admin/guard";
import { listUsers } from "@/lib/admin/queries";
import { countLabel } from "@/lib/format";

export const metadata = { title: "Users - Admin - Universal API" };

export default async function AdminUsersPage() {
  await requireAdminPage();
  const users = await listUsers();

  return (
    <AdminPage heading="Users" description={`${countLabel(users.length, "account")}. Open one to see its projects, tokens, sessions and activity.`}>
      <AdminPanel>
        <UsersTable users={users} />
      </AdminPanel>
    </AdminPage>
  );
}
