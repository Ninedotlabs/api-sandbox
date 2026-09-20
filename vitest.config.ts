import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    globals: true,
    // `@/lib/services` (see `src/lib/services/index.ts`) otherwise resolves to the `http`
    // implementation - real `fetch` calls against `/api/v1` - which the component/store test
    // suite has no server to answer. This is exactly the escape hatch that flag exists for:
    // every existing test keeps exercising the in-memory `mock` services. A test that wants
    // the `http` (or `pg`) implementation instead imports it directly - see
    // `src/lib/services/http/services.test.ts` and `src/lib/services/index.test.ts`.
    env: { NEXT_PUBLIC_USE_MOCK_SERVICES: "1" },
    // `.claude/worktrees/` holds isolated checkouts for background agents. Their tests
    // belong to that checkout, not this one, and sweeping them up makes a green run look
    // red for reasons that have nothing to do with the code under test.
    exclude: ["**/node_modules/**", "**/dist/**", "**/.claude/**"],
    setupFiles: ["./vitest.setup.ts", "./vitest.setup.pg.ts"],
    css: false,
    // `next-auth`'s own internals import bare `next/server` (no extension) from inside
    // node_modules; Vitest's default SSR externalization hands that straight to Node's
    // resolver instead of Vite's, and Node can't find it without the `.js`. Routing these
    // two packages through Vite's own resolution (which does add the extension) fixes it -
    // see `src/app/api/auth/[...nextauth]/route.test.ts`.
    server: { deps: { inline: ["next-auth", "@auth/core"] } },
    // Node 22+ ships an experimental global `localStorage` that shadows
    // jsdom's implementation and lacks methods like `.clear()`. Disable it
    // so vitest-environment-jsdom's own localStorage is used instead.
    execArgv: ["--no-experimental-webstorage"],
  },
});
