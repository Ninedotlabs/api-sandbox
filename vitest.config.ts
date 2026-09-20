import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts", "./vitest.setup.pg.ts"],
    css: false,
    // Node 22+ ships an experimental global `localStorage` that shadows
    // jsdom's implementation and lacks methods like `.clear()`. Disable it
    // so vitest-environment-jsdom's own localStorage is used instead.
    execArgv: ["--no-experimental-webstorage"],
  },
});
