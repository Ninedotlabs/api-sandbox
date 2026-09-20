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

function SignInContent() {
  const authError = useSearchParams().get("error");

  return (
    <main className="relative flex min-h-screen items-center justify-center bg-page px-4 py-4">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm rounded-2xl border border-line bg-surface p-8 shadow-pop">
        <div className="flex flex-col items-center text-center">
          <Wordmark />
          <h1 className="mt-6 text-2xl font-semibold tracking-tight text-ink">Universal API</h1>
          <p className="mt-2 text-sm leading-relaxed text-ink-2">
            Build an API without writing code, then manage the whole workflow from your MCP client.
          </p>
        </div>

        {authError && (
          <div role="alert" className="mt-6 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
            Google couldn&apos;t complete that sign-in. Please try again with a fresh account prompt.
          </div>
        )}

        <Button size="lg" className="mt-6 w-full" onClick={() => signIn("google", { redirectTo: redirectTarget() })}>
          Continue with Google <ArrowRight aria-hidden />
        </Button>
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
