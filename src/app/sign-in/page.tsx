"use client";

import { ArrowRight, CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";
import Image from "next/image";
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
    <main className="relative min-h-screen overflow-hidden bg-page px-4 py-4 sm:px-6 lg:p-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_15%_15%,color-mix(in_srgb,var(--color-accent)_14%,transparent),transparent_32%),radial-gradient(circle_at_90%_85%,color-mix(in_srgb,var(--color-success)_10%,transparent),transparent_30%)]" />
      <div className="relative mx-auto flex min-h-[calc(100vh-2rem)] max-w-7xl flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-pop lg:grid lg:grid-cols-[0.92fr_1.08fr]">
        <section className="flex flex-col p-5 sm:p-8 lg:p-12">
          <div className="flex items-center justify-between">
            <Wordmark />
            <ThemeToggle />
          </div>

          <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10 lg:py-16">
            <div className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-accent/20 bg-accent-soft px-3 py-1 text-xs font-medium text-accent-ink">
              <Sparkles className="size-3.5" aria-hidden /> No-code API workspace
            </div>
            <h1 className="text-3xl font-semibold tracking-tight text-ink sm:text-4xl">Universal API</h1>
            <p className="mt-3 text-base leading-relaxed text-ink-2">
              Build an API without writing code. Design resources, publish mock endpoints, and manage the full workflow from your MCP client.
            </p>

            <div className="relative my-7 h-48 overflow-hidden rounded-2xl border border-line bg-slate lg:hidden">
              <Image src="/api-workflow-3d.png" alt="3D API, database and AI workflow" fill priority sizes="(max-width: 1024px) 90vw, 0px" className="object-cover" />
            </div>

            <ul className="mb-8 space-y-3 text-sm text-ink-2">
              {[
                "Create a mock API and get a public test URL",
                "Use the dashboard or the complete MCP toolset",
                "Generate private, revocable tokens for each client",
              ].map((feature) => (
                <li key={feature} className="flex items-center gap-2.5">
                  <CheckCircle2 className="size-4 shrink-0 text-success" aria-hidden />
                  {feature}
                </li>
              ))}
            </ul>

            {authError && (
              <div role="alert" className="mb-4 rounded-xl border border-danger/30 bg-danger/5 px-4 py-3 text-sm text-danger">
                Google couldn&apos;t complete that sign-in. Please try again with a fresh account prompt.
              </div>
            )}
            <Button size="lg" className="w-full" onClick={() => signIn("google", { redirectTo: redirectTarget() })}>
              Continue with Google <ArrowRight aria-hidden />
            </Button>
            <p className="mt-4 flex items-center justify-center gap-1.5 text-center text-xs text-ink-3">
              <ShieldCheck className="size-3.5" aria-hidden /> Your projects and MCP credentials stay scoped to your account.
            </p>
          </div>
        </section>

        <section className="relative hidden min-h-[640px] overflow-hidden bg-slate lg:block">
          <Image
            src="/api-workflow-3d.png"
            alt="3D API blocks connected to a database and AI automation"
            fill
            priority
            sizes="55vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-slate via-transparent to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-10 text-slate-ink">
            <p className="font-mono text-xs uppercase tracking-[0.12em] text-method-put-on-slate">One shared source of truth</p>
            <h2 className="mt-3 max-w-lg text-2xl font-semibold">Build visually. Automate with MCP. Test the same live endpoint.</h2>
          </div>
        </section>
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
