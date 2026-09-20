"use client";

import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-page px-4">
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-line bg-surface p-8 text-center">
        <div className="space-y-2">
          <h1 className="text-xl font-semibold text-ink">Universal API</h1>
          <p className="text-sm text-ink-3">Build an API without writing code.</p>
        </div>
        <Button className="w-full" onClick={() => signIn("google")}>
          Continue with Google
        </Button>
      </div>
    </main>
  );
}
