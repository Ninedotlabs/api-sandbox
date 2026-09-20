// @vitest-environment node
//
// Runs with no `window` global at all, mirroring server-side rendering, so it can exercise
// rules 3 and 4 of the precedence order in `src/lib/app-origin.ts` (`window.location.origin`
// is unreachable there). Kept in its own file because a vitest environment directive applies
// to the whole file, not to an individual describe block.
import { afterEach, describe, expect, it, vi } from "vitest";
import { getAppOrigin } from "./app-origin";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getAppOrigin - server-side fallbacks (no window)", () => {
  it("has no window global in this environment", () => {
    expect(typeof window).toBe("undefined");
  });

  it("falls back to https://$NEXT_PUBLIC_VERCEL_URL when there is no override and no window", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("NEXT_PUBLIC_VERCEL_URL", "my-app-git-branch.vercel.app");
    expect(getAppOrigin()).toBe("https://my-app-git-branch.vercel.app");
  });

  it("falls back to http://localhost:3000 when nothing else is set and there is no window", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("NEXT_PUBLIC_VERCEL_URL", "");
    expect(getAppOrigin()).toBe("http://localhost:3000");
  });
});
