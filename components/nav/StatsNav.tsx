/**
 * Top navigation across the dashboard and the three stats views.
 * Server Component — the active item is passed in via `current` rather than
 * read from the router, so no client JS is needed.
 */

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LINKS = [
  { key: "dashboard", href: "/", label: "Dashboard" },
  { key: "rounds", href: "/rounds", label: "Rounds" },
  { key: "holes", href: "/stats/holes", label: "Holes" },
  { key: "clubs", href: "/stats/clubs", label: "Clubs" },
  { key: "distance", href: "/stats/distance", label: "Distance" },
  { key: "sg", href: "/stats/sg", label: "SG" },
  { key: "courses", href: "/courses", label: "Setup" },
] as const;

export type NavKey = (typeof LINKS)[number]["key"];

export function StatsNav({ current, owner = true }: { current: NavKey; owner?: boolean }) {
  // "Setup" (courses/clubs) is owner-only — it's all editing. Hide for visitors.
  const links = owner ? LINKS : LINKS.filter((l) => l.key !== "courses");
  return (
    <nav className="mb-4 flex gap-1 overflow-x-auto">
      {links.map((l) => (
        <Link
          key={l.key}
          href={l.href}
          className={cn(
            buttonVariants({
              variant: l.key === current ? "secondary" : "ghost",
              size: "sm",
            }),
          )}
          aria-current={l.key === current ? "page" : undefined}
        >
          {l.label}
        </Link>
      ))}
    </nav>
  );
}
