"use client";

/**
 * Root error boundary. Catches uncaught render errors anywhere under the root
 * layout (dashboard, round detail, stats) — most often a transient Supabase
 * read failing mid server-component render. Shows a recoverable retry instead of
 * the raw Next.js error overlay. The log route has its own boundary with
 * copy tuned to in-round entry.
 */

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Render error:", error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="space-y-2">
        <h1 className="font-heading text-2xl font-bold">Something went wrong</h1>
        <p className="text-muted-foreground max-w-xs text-balance">
          That was likely a brief connection hiccup. Your data is safe — try
          again.
        </p>
      </div>
      <Button size="lg" onClick={reset}>
        Try again
      </Button>
    </main>
  );
}
