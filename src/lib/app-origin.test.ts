import { afterEach, describe, expect, it, vi } from "vitest";
import { getAppOrigin, getAppOriginDisplay } from "./app-origin";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("getAppOrigin - precedence", () => {
  it("uses NEXT_PUBLIC_APP_URL when set, even though a browser origin is also available", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://configured.example.com");
    expect(getAppOrigin()).toBe("https://configured.example.com");
  });

  it("falls back to window.location.origin in the browser when no override is set", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("NEXT_PUBLIC_VERCEL_URL", "");
    expect(getAppOrigin()).toBe(window.location.origin);
  });
});

describe("getAppOrigin - normalisation", () => {
  it("strips a trailing slash from an explicit override", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://configured.example.com/");
    expect(getAppOrigin()).toBe("https://configured.example.com");
  });

  it("defaults a bare host to https://", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "configured.example.com");
    expect(getAppOrigin()).toBe("https://configured.example.com");
  });

  it("defaults a bare localhost host to http://", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "localhost:3000");
    expect(getAppOrigin()).toBe("http://localhost:3000");
  });

  it("passes an already-complete URL through unchanged", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "http://example.com:8080");
    expect(getAppOrigin()).toBe("http://example.com:8080");
  });
});

describe("getAppOriginDisplay", () => {
  it("returns the origin without its scheme", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://configured.example.com");
    expect(getAppOriginDisplay()).toBe("configured.example.com");
  });

  it("has no scheme even for the localhost default", () => {
    vi.stubEnv("NEXT_PUBLIC_APP_URL", "");
    vi.stubEnv("NEXT_PUBLIC_VERCEL_URL", "");
    expect(getAppOriginDisplay()).toBe(window.location.origin.replace(/^https?:\/\//, ""));
  });
});

// Rules 3 and 4 of the precedence order (no window, so no browser origin available) are
// covered in `app-origin.node.test.ts`, which runs under the `node` vitest environment - a
// vitest environment directive applies to the whole file, not to an individual describe block.
