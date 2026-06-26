import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getAllShots } from "@/lib/db/shots";
import { getAllRounds } from "@/lib/db/rounds";
import { computeDashboard } from "@/lib/analytics/dashboard";
import { computeStreaks } from "@/lib/analytics/streaks";
import { getDashboardSG } from "@/lib/sg-server";
import { Dashboard } from "@/components/dashboard/Dashboard";
import { PageHeader } from "@/components/nav/PageHeader";
import { TAGLINE } from "@/lib/constants";

// Render on every request so direct DB changes (e.g. the sheet import) and
// app writes are always reflected. Single-user app — dynamic cost is negligible.
export const dynamic = "force-dynamic";

export default async function Home() {
  // Reads go through lib/db in Server Components; analytics are pure.
  const [shots, rounds] = await Promise.all([getAllShots(), getAllRounds()]);
  const data = computeDashboard(shots, rounds);
  const { sg, leaks, momentum } = await getDashboardSG({ shots, rounds });
  const streaks = computeStreaks(shots, rounds);

  // Empty state — no complete holes logged yet.
  if (data.snapshot.holesLogged === 0) {
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Round Recall</h1>
        <p className="text-sm text-muted-foreground">{TAGLINE}</p>
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
    // Calm Brief is a single editorial column, designed mobile-first at 390px
    // (outer padding 24 / 22 / 30) — kept narrow on desktop too.
    <main className="mx-auto w-full max-w-md flex-1 px-[22px] pb-[30px] pt-6">
      <PageHeader title="Dashboard" />
      <Dashboard data={data} sg={sg} leaks={leaks} momentum={momentum} streaks={streaks} />
    </main>
  );
}
