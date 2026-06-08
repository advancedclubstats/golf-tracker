"use client";

/**
 * Error boundary for the shot-entry log route.
 *
 * The log page is `force-dynamic`, so it re-fetches from Supabase on every save
 * (a server action re-renders the current route). A transient blip during that
 * refetch throws mid-render; without this boundary it surfaced as the raw
 * "An error occurred in the Server Components render" overlay and trapped the
 * user on the hole. `lib/supabase/retry` absorbs most blips; this is the safety
 * net for the rest.
 *
 * Recovery is lossless: every shot is persisted the moment it's logged, and the
 * page rebuilds the wizard's progress from saved shots on mount — so `reset()`
 * drops the user back into the same hole with their logged shots intact.
 */

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function LogError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Shot-entry render error:", error);
  }, [error]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="space-y-2">
        <h1 className="font-heading text-2xl font-bold">Hang on a sec</h1>
        <p className="text-muted-foreground max-w-xs text-balance">
          The connection hiccuped while loading this hole. Your logged shots are
          saved — tap to pick up where you left off.
        </p>
      </div>
      <Button size="lg" onClick={reset}>
        Try again
      </Button>
    </main>
  );
}
