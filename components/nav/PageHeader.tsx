/**
 * Shared page header for the main views: title on the left, persistent
 * "New Round" action on the right, with the StatsNav below. Server Component.
 */

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { StatsNav, type NavKey } from "@/components/nav/StatsNav";

export function PageHeader({ title, current }: { title: string; current: NavKey }) {
  return (
    <>
      <header className="mb-4 flex items-center justify-between gap-4">
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <Link
          href="/rounds/new"
          className={cn(buttonVariants({ size: "sm" }), "shrink-0")}
        >
          New Round →
        </Link>
      </header>
      <StatsNav current={current} />
    </>
  );
}
