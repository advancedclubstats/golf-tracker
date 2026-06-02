import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getAllShots } from "@/lib/db/shots";
import { getAllRounds } from "@/lib/db/rounds";
import { computeDashboard } from "@/lib/analytics/dashboard";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { StatsNav } from "@/components/nav/StatsNav";

export default async function Home() {
  // Reads go through lib/db in Server Components; analytics are pure.
  const [shots, rounds] = await Promise.all([getAllShots(), getAllRounds()]);
  const data = computeDashboard(shots, rounds);

  // Empty state — no complete holes logged yet.
  if (data.snapshot.holesLogged === 0) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Golf Tracker</h1>
        <p className="text-sm text-muted-foreground">
          Log your rounds, track your game.
        </p>
        <Link
          href="/rounds/new"
          className={cn(buttonVariants(), "mt-2 h-14 px-8 text-base font-semibold")}
        >
          New Round →
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-xl flex-1 p-4">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
        <Link href="/rounds/new" className={cn(buttonVariants({ size: "sm" }))}>
          New Round →
        </Link>
      </header>
      <StatsNav current="dashboard" />
      <Dashboard data={data} />
    </main>
  );
}
