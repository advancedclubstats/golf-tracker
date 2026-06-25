/**
 * Branded 404. Mirrors app/error.tsx's full-height centered shell, but as a
 * server component (no reset handler) with recall-voice copy and links back into
 * the app. BottomNav renders from the root layout, so navigation persists here.
 */

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="space-y-2">
        <h1 className="font-heading text-2xl font-bold">No round here</h1>
        <p className="text-muted-foreground max-w-xs text-balance">
          This page didn’t make the card. The link may be stale or the round was
          never logged.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Link href="/" className={cn(buttonVariants({ size: "lg" }))}>
          Back to the dashboard
        </Link>
        <Link
          href="/rounds"
          className={cn(buttonVariants({ variant: "outline", size: "lg" }))}
        >
          Browse rounds
        </Link>
      </div>
    </main>
  );
}
