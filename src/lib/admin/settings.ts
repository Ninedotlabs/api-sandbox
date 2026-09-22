import { isAuthRequired } from "@/proxy";

/**
 * The admin Settings view (see `docs/superpowers/specs/2026-09-22-admin-dashboard-design.md`
 * §4). This runs on the server and returns only whether each setting is present. A secret's
 * value never enters the returned object, so it can't reach the browser by accident.
 * `value` is filled in only for settings marked `public`, which hold no secret.
 */
interface SettingDefinition {
  key: string;
  label: string;
  group: "Database" | "Sign-in" | "Access" | "AI" | "App";
  public?: boolean;
}

export const SETTING_DEFINITIONS: readonly SettingDefinition[] = [
  { key: "DATABASE_URL", label: "Postgres connection string", group: "Database" },
  { key: "AUTH_SECRET", label: "Session signing secret", group: "Sign-in" },
  { key: "AUTH_GOOGLE_ID", label: "Google OAuth client id", group: "Sign-in" },
  { key: "AUTH_GOOGLE_SECRET", label: "Google OAuth client secret", group: "Sign-in" },
  { key: "AUTH_REQUIRED", label: "Sign-in gate override", group: "Sign-in", public: true },
  { key: "ADMIN_EMAILS", label: "Accounts promoted to admin on sign-in", group: "Access", public: true },
  { key: "AZURE_AI_ENDPOINT", label: "Azure AI endpoint", group: "AI" },
  { key: "AZURE_AI_API_KEY", label: "Azure AI API key", group: "AI" },
  { key: "AZURE_AI_MODEL", label: "Azure AI model", group: "AI", public: true },
  { key: "NEXT_PUBLIC_APP_URL", label: "Public app URL", group: "App", public: true },
];

export interface SettingStatus {
  key: string;
  label: string;
  group: SettingDefinition["group"];
  configured: boolean;
  value: string | null;
}

export function settingsStatus(env: NodeJS.ProcessEnv = process.env): SettingStatus[] {
  return SETTING_DEFINITIONS.map((def) => {
    const raw = env[def.key]?.trim();
    return {
      key: def.key,
      label: def.label,
      group: def.group,
      configured: Boolean(raw),
      value: def.public && raw ? raw : null,
    };
  });
}

export function signInGateEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return isAuthRequired(env);
}
