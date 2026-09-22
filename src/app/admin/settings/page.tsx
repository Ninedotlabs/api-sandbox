import { AdminPage, AdminPanel } from "@/components/admin/admin-page";
import { requireAdminPage } from "@/lib/admin/guard";
import { settingsStatus, signInGateEnabled } from "@/lib/admin/settings";

export const metadata = { title: "Settings - Admin - Universal API" };

export default async function AdminSettingsPage() {
  await requireAdminPage();
  const settings = settingsStatus();
  const groups = [...new Set(settings.map((s) => s.group))];

  return (
    <AdminPage
      heading="Settings"
      description="Which environment settings this deployment has. Secret values never leave the server - change them in your hosting provider."
    >
      <div className="rounded-lg border border-line bg-surface p-4 text-sm text-ink-2">
        Sign-in gate is <strong className="text-ink">{signInGateEnabled() ? "on" : "off"}</strong>
        {signInGateEnabled() ? " - every app page requires a Google sign-in." : " - app pages are open without signing in."}
      </div>
      {groups.map((group) => (
        <AdminPanel key={group} title={group}>
          <ul className="divide-y divide-line">
            {settings
              .filter((s) => s.group === group)
              .map((setting) => (
                <li key={setting.key} className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-sm text-ink">{setting.key}</p>
                    <p className="text-xs text-ink-3">{setting.label}</p>
                  </div>
                  <div className="min-w-0 text-sm sm:text-right">
                    {setting.value !== null ? (
                      <span className="break-all font-mono text-ink-2">{setting.value}</span>
                    ) : setting.configured ? (
                      <span className="text-success">Configured</span>
                    ) : (
                      <span className="text-warning">Not set</span>
                    )}
                  </div>
                </li>
              ))}
          </ul>
        </AdminPanel>
      ))}
    </AdminPage>
  );
}
