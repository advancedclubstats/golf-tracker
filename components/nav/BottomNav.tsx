"use client";

/**
 * Icon-only bottom navigation — the app's primary chrome. Four destinations
 * plus a central FAB that starts a round, in a deep fairway-charcoal "ink" bar
 * floating in the thumb zone over the warm-paper background.
 *
 * Active state reads through a lime glyph + slight scale + a small lime dot
 * rendered *inside* the active tab (centered by flexbox, so it can never drift
 * or misalign — no JS measurement). Lime stays the single accent moment: the
 * FAB is fairway-green with a lime ring.
 *
 * The bar hides during the focused shot-entry flow (`/rounds/[id]/log`) so
 * logging stays distraction-free. An in-flow spacer reserves scroll clearance
 * so page content is never tucked behind the bar.
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  FlagTriangleRight,
  Plus,
  ChartNoAxesColumn,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

type TabKey = "home" | "rounds" | "stats" | "setup";

interface Tab {
  key: TabKey;
  href: string;
  icon: LucideIcon;
  label: string;
}

const TABS: Tab[] = [
  { key: "home", href: "/", icon: Home, label: "Home" },
  { key: "rounds", href: "/rounds", icon: FlagTriangleRight, label: "Rounds" },
  { key: "stats", href: "/stats/holes", icon: ChartNoAxesColumn, label: "Stats" },
  { key: "setup", href: "/courses", icon: Settings, label: "Setup" },
];

function activeKey(pathname: string): TabKey | null {
  if (pathname === "/") return "home";
  // /rounds/new is the FAB's create flow, not the Rounds tab.
  if (pathname.startsWith("/rounds") && pathname !== "/rounds/new") return "rounds";
  if (pathname.startsWith("/stats")) return "stats";
  if (pathname.startsWith("/courses")) return "setup";
  return null;
}

// The shot-entry flow is `/rounds/<id>/log` — hide the bar there.
function isFocusedFlow(pathname: string): boolean {
  return /^\/rounds\/[^/]+\/log\/?$/.test(pathname);
}

export function BottomNav() {
  const pathname = usePathname() ?? "/";
  const active = activeKey(pathname);

  // Everyone gets the full bar: the owner on real data, visitors on their
  // sandbox (Setup included — it's a per-visitor staging copy).
  const tabs = TABS;

  // On the New Round page the FAB would just reload the same route, so drop it.
  const showFab = pathname !== "/rounds/new";

  if (isFocusedFlow(pathname)) return null;

  return (
    <>
      {/* In-flow spacer so the fixed bar never covers page content. */}
      <div aria-hidden className="h-[calc(96px+env(safe-area-inset-bottom))]" />

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center pb-[calc(18px+env(safe-area-inset-bottom))]">
        <nav
          aria-label="Primary"
          className="pointer-events-auto relative mx-4 flex w-[calc(100%-32px)] max-w-[420px] items-center justify-around overflow-visible rounded-full px-3 py-1"
          style={{
            background: "#0B2E1E",
            border: "1px solid rgba(255,255,255,.08)",
            boxShadow:
              "0 18px 38px -14px rgba(11,46,30,.6), 0 2px 8px rgba(11,46,30,.3), inset 0 1px 0 rgba(255,255,255,.07)",
          }}
        >
          {/* Left half: Home, Rounds */}
          {tabs
            .filter((t) => t.key === "home" || t.key === "rounds")
            .map((t) => (
              <NavTab key={t.key} tab={t} active={active === t.key} />
            ))}

          {/* Center FAB — start a round (hidden on /rounds/new) */}
          {showFab && (
            <Link
              href="/rounds/new"
              aria-label="Log a round"
              className="relative z-[3] mx-1.5 flex h-14 w-14 shrink-0 -translate-y-3.5 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform duration-150 active:translate-y-[-14px] active:scale-95 motion-reduce:transition-none"
              style={{
                boxShadow:
                  "0 12px 26px -6px rgba(11,46,30,.55), 0 0 0 5px rgba(205,242,62,.28), inset 0 1px 1px rgba(255,255,255,.35)",
              }}
            >
              <Plus className="h-[26px] w-[26px]" strokeWidth={2.25} />
            </Link>
          )}

          {/* Right half: Stats, Setup */}
          {tabs
            .filter((t) => t.key === "stats" || t.key === "setup")
            .map((t) => (
              <NavTab key={t.key} tab={t} active={active === t.key} />
            ))}
        </nav>
      </div>
    </>
  );
}

function NavTab({ tab, active }: { tab: Tab; active: boolean }) {
  const Icon = tab.icon;
  return (
    <Link
      href={tab.href}
      aria-label={tab.label}
      aria-current={active ? "page" : undefined}
      className={cn(
        // min-h-14 matches the FAB height so the bar keeps the same height when
        // the FAB is hidden (signed-out view, /rounds/new); self-stretch then
        // fills it so the thumb insets evenly as a segmented-control toggle.
        "relative z-[2] flex min-h-14 flex-1 items-center justify-center self-stretch px-1 transition-colors duration-200",
        active ? "text-highlight" : "text-[#7E978A]",
      )}
    >
      {/* Selector "thumb": a lighter rounded container behind the active icon,
          inset from the cell edges. Rendered inside the tab (not floating), so
          it stays aligned; opacity-toggled for a soft fade between tabs. */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-1 inset-x-1.5 rounded-2xl bg-white/[0.12] transition-opacity duration-200",
          active ? "opacity-100" : "opacity-0",
        )}
      />
      <Icon
        className="relative z-[1] h-[25px] w-[25px] transition-transform duration-200 active:scale-90 motion-reduce:transition-none"
        strokeWidth={2}
      />
    </Link>
  );
}
