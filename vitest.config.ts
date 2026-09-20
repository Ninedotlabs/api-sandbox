import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    globals: true,
    // `.claude/worktrees/` holds isolated checkouts for background agents. Their tests
    // belong to that checkout, not this one, and sweeping them up makes a green run look
    // red for reasons that have nothing to do with the code under test.
    exclude: ["**/node_modules/**", "**/dist/**", "**/.claude/**"],
    setupFiles: ["./vitest.setup.ts"],
    css: false,
    // Node 22+ ships an experimental global `localStorage` that shadows
    // jsdom's implementation and lacks methods like `.clear()`. Disable it
    // so vitest-environment-jsdom's own localStorage is used instead.
    execArgv: ["--no-experimental-webstorage"],
  },
});
