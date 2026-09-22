// @vitest-environment node
import { describe, expect, it } from "vitest";
import { SETTING_DEFINITIONS, settingsStatus } from "./settings";

const env = {
  DATABASE_URL: "postgres://user:hunter2@db.example.com/app",
  AUTH_SECRET: "super-secret-signing-key",
  AUTH_GOOGLE_ID: "google-client-id",
  AUTH_GOOGLE_SECRET: "google-client-secret",
  AZURE_AI_API_KEY: "azure-key-123",
  AZURE_AI_MODEL: "gpt-5",
  ADMIN_EMAILS: "owner@example.com",
  AUTH_REQUIRED: "   ",
} as unknown as NodeJS.ProcessEnv;

describe("settingsStatus", () => {
  it("never includes a secret value anywhere in its output", () => {
    const serialized = JSON.stringify(settingsStatus(env));
    for (const secret of ["hunter2", "super-secret-signing-key", "google-client-id", "google-client-secret", "azure-key-123"]) {
      expect(serialized).not.toContain(secret);
    }
  });

  it("reports which settings are configured", () => {
    const byKey = Object.fromEntries(settingsStatus(env).map((s) => [s.key, s]));
    expect(byKey.DATABASE_URL).toMatchObject({ configured: true, value: null });
    expect(byKey.AZURE_AI_ENDPOINT).toMatchObject({ configured: false, value: null });
    // whitespace-only counts as unset
    expect(byKey.AUTH_REQUIRED).toMatchObject({ configured: false, value: null });
  });

  it("shows values only for settings marked public", () => {
    const byKey = Object.fromEntries(settingsStatus(env).map((s) => [s.key, s]));
    expect(byKey.ADMIN_EMAILS.value).toBe("owner@example.com");
    expect(byKey.AZURE_AI_MODEL.value).toBe("gpt-5");
    const exposed = SETTING_DEFINITIONS.filter((d) => d.public).map((d) => d.key);
    expect(exposed).not.toEqual(expect.arrayContaining(["DATABASE_URL", "AUTH_SECRET", "AUTH_GOOGLE_SECRET", "AZURE_AI_API_KEY"]));
  });
});
