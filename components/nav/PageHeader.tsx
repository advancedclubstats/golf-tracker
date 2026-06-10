/**
 * Shared page header for the main views: title on the left, persistent
 * "New Round" action on the right, with the StatsNav below. Server Component.
 */

import Link from "next/link";
import { StatsNav, type NavKey } from "@/components/nav/StatsNav";
import { isOwner } from "@/lib/auth/owner";

export async function PageHeader({ title, current }: { title: string; current: NavKey }) {
  // Write actions are owner-only (read-only portfolio demo for visitors).
  const owner = await isOwner();
  return (
    <>
      <header className="mb-4 flex items-center justify-between gap-4">
        <h1 className="font-heading text-[22px] font-bold tracking-[-0.02em]">{title}</h1>
        {owner && (
          // The primary action — one of the two lime moments per screen
          // (Calm Brief: hero surface + this pill).
          <Link
            href="/rounds/new"
            className="shrink-0 rounded-full bg-highlight px-[15px] py-[7px] text-[13px] font-semibold text-highlight-foreground"
          >
            New Round →
          </Link>
        )}
      </header>
      <StatsNav current={current} owner={owner} />
    </>
  );
}
