/**
 * In-page chip sub-nav for the Stats section. The four stats pages
 * (Holes/Clubs/Distance/SG) live under one "Stats" tab in the bottom bar and
 * re-expose each other here as chips (Apple News / eBay pattern). Server
 * Component — the active chip is passed in via `current`, no client JS needed.
 */

import Link from "next/link";
import { cn } from "@/lib/utils";

const CHIPS = [
  { key: "holes", href: "/stats/holes", label: "Holes" },
  { key: "clubs", href: "/stats/clubs", label: "Clubs" },
  { key: "shape", href: "/stats/shape", label: "Shape" },
  { key: "distance", href: "/stats/distance", label: "Distance" },
  { key: "sg", href: "/stats/sg", label: "SG" },
] as const;

export type StatsChipKey = (typeof CHIPS)[number]["key"];

export function StatsChips({ current }: { current: StatsChipKey }) {
  return (
    <nav
      aria-label="Stats sections"
      className="mb-4 flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {CHIPS.map((c) => {
        const on = c.key === current;
        return (
          <Link
            key={c.key}
            href={c.href}
            aria-current={on ? "page" : undefined}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-[13.5px] font-semibold transition-colors",
              on
                ? "border-foreground bg-foreground text-background"
                : "border-border bg-card text-muted-foreground hover:text-foreground",
            )}
          >
            {c.label}
          </Link>
        );
      })}
    </nav>
  );
}
