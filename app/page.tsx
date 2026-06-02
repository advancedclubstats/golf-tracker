import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// TODO(P2-T4): Replace with real Dashboard once analytics are wired up.
export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">Golf Tracker</h1>
      <p className="text-sm text-muted-foreground">
        Log your rounds, track your game.
      </p>
      <Link
        href="/rounds/new"
        className={cn(buttonVariants(), "h-14 px-8 text-base font-semibold mt-2")}
      >
        New Round →
      </Link>
    </main>
  );
}
