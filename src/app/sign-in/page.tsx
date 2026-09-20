"use client";

import { ArrowRight } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { Suspense } from "react";
import { Wordmark } from "@/components/brand/wordmark";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";

function redirectTarget(): string {
  const requested = new URLSearchParams(window.location.search).get("callbackUrl");
  if (!requested || !requested.startsWith("/") || requested.startsWith("//")) return "/projects";
  return requested;
}

/**
 * One line of the product, rather than a sentence about it. A developer signing in learns more
 * from a real request and its status than from any amount of prose, and it is the app's own
 * visual language (method, path, status) instead of decoration borrowed from somewhere else.
 */
function EndpointPreview() {
  return (
    <div className="rounded-xl border border-line bg-panel px-3.5 py-3 font-mono text-[12px] leading-relaxed">
      <div className="flex items-center gap-2.5">
        <span className="font-medium text-method-get">GET</span>
        <span className="truncate text-ink-2">/api/bookshop/books</span>
        <span className="ml-auto text-ink-3">200</span>
      </div>
      <div className="mt-1.5 truncate text-ink-3">{"{ \"data\": [ … ], \"count\": 12 }"}</div>
    </div>
  );
}

function SignInContent() {
  const authError = useSearchParams().get("error");

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-page px-4 py-10">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-line bg-surface p-8 shadow-pop sm:p-10">
          <Wordmark />

          <h1 className="mt-7 text-[26px] font-semibold leading-tight tracking-tight text-ink">
            Design a mock API.
            <br />
            Get a real endpoint.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-2">
            Model your resources, seed realistic data, and call the result over HTTP — from your own code, or from
            Claude through MCP.
          </p>

          <div className="mt-6">
            <EndpointPreview />
          </div>

          {authError && (
            <div role="alert" className="mt-6 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
              Google couldn&apos;t complete that sign-in. Please try again with a fresh account prompt.
            </div>
          )}

          <Button size="lg" className="mt-7 w-full" onClick={() => signIn("google", { redirectTo: redirectTarget() })}>
            Continue with Google <ArrowRight aria-hidden />
          </Button>
        </div>

        <p className="mt-4 text-center text-xs text-ink-3">
          Your projects and API tokens stay scoped to your account.
        </p>
      </div>
    </main>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<main className="min-h-screen bg-page" aria-label="Loading sign in" />}>
      <SignInContent />
    </Suspense>
  );
}
