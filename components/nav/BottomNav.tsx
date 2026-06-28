"use client";

/**
 * Icon-only bottom navigation — the app's primary chrome. Four destinations
 * plus a central FAB, in a deep fairway-charcoal "ink" bar floating in the thumb
 * zone over the warm-paper background.
 *
 * The FAB is a "start" menu: tapping it opens two choices — log a round, or
 * start a practice game (DL-022). Practice has no top-level tab of its own; it's
 * reached as the second tap off the +, and its leaderboard lives at `/practice`.
 *
 * Active state reads through a lime glyph + slight scale + a small lime dot
 * rendered *inside* the active tab (centered by flexbox, so it can never drift
 * or misalign — no JS measurement). Lime stays the single accent moment: the
 * FAB is fairway-green with a lime ring.
 *
 * The bar hides during focused flows — the shot-entry flow (`/rounds/[id]/log`)
 * and the New Round create form (`/rounds/new`) — which carry their own top
 * escape instead, so those stay distraction-free. An in-flow spacer reserves
 * scroll clearance so page content is never tucked behind the bar.
 */

import { useState } from "react";
import Link from "next/link";
import { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { Popover } from "@base-ui/react/popover";
import {
  Home,
  FlagTriangleRight,
  Plus,
  ChartNoAxesColumn,
  Settings,
  Target,
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
  if (pathname.startsWith("/rounds")) return "rounds";
  if (pathname.startsWith("/stats")) return "stats";
  if (pathname.startsWith("/courses")) return "setup";
  return null;
}

// Focused flows hide the bar (they carry their own top escape, no tab rail):
// the shot-entry flow `/rounds/<id>/log` and the New Round create form.
function isFocusedFlow(pathname: string): boolean {
  return (
    /^\/rounds\/[^/]+\/log\/?$/.test(pathname) ||
    pathname === "/rounds/new" ||
    /^\/practice\/[^/]+\/new\/?$/.test(pathname)
  );
}

export function BottomNav() {
  const pathname = usePathname() ?? "/";
  const active = activeKey(pathname);

  // Everyone gets the full bar: the owner on real data, visitors on their
  // sandbox (Setup included — it's a per-visitor staging copy).
  const tabs = TABS;

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

          {/* Center FAB — opens the start menu (log a round / practice game) */}
          <StartMenu />

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

/**
 * The center FAB as a "start" menu. Tapping the + opens a small popup with the
 * two ways to log: a real round, or a practice game (DL-022). The + rotates into
 * an × while open. Choosing an option navigates (and the popup unmounts).
 */
function StartMenu() {
  const [open, setOpen] = useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        aria-label="Start logging"
        className="relative z-[3] mx-1.5 flex h-14 w-14 shrink-0 -translate-y-3.5 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform duration-150 active:scale-95 motion-reduce:transition-none"
        style={{
          boxShadow:
            "0 12px 26px -6px rgba(11,46,30,.55), 0 0 0 5px rgba(205,242,62,.28), inset 0 1px 1px rgba(255,255,255,.35)",
        }}
      >
        <Plus
          className={cn(
            "h-[26px] w-[26px] transition-transform duration-200 motion-reduce:transition-none",
            open && "rotate-45",
          )}
          strokeWidth={2.25}
        />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="top" sideOffset={16} className="z-[60]">
          <Popover.Popup className="origin-bottom rounded-2xl border border-border bg-card p-1.5 shadow-xl outline-none transition data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
            <StartMenuItem
              href="/rounds/new"
              icon={FlagTriangleRight}
              label="Log a round"
              sub="Tap through 18 holes from memory"
              onSelect={() => setOpen(false)}
            />
            <StartMenuItem
              href="/practice"
              icon={Target}
              label="Practice game"
              sub="Scored drills · beat your number"
              onSelect={() => setOpen(false)}
            />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

function StartMenuItem({
  href,
  icon: Icon,
  label,
  sub,
  onSelect,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  sub: string;
  onSelect: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onSelect}
      className="flex w-[248px] items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-muted active:bg-muted"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-[18px]" strokeWidth={2} />
      </span>
      <span className="flex flex-col">
        <span className="text-[15px] font-semibold leading-tight text-foreground">{label}</span>
        <span className="text-xs leading-tight text-muted-foreground">{sub}</span>
      </span>
    </Link>
  );
}

function NavTab({ tab, active }: { tab: Tab; active: boolean }) {
  return (
    <Link
      href={tab.href}
      aria-label={tab.label}
      aria-current={active ? "page" : undefined}
      className={cn(
        // min-h-14 matches the FAB height so the bar keeps the same height when
        // the FAB is hidden (signed-out view, /rounds/new); self-stretch then
        // fills it so the thumb insets evenly as a segmented-control toggle.
        "relative z-[2] flex min-h-14 flex-1 items-center justify-center self-stretch px-1",
      )}
    >
      <NavTabGlyph icon={tab.icon} active={active} />
    </Link>
  );
}

/**
 * The icon + selector thumb. Lives *inside* the Link so it can read
 * `useLinkStatus().pending` and light up the instant the tab is tapped —
 * before the destination route commits. That optimistic acknowledgment is what
 * kills the "did my tap register?" multi-tap: pathname-driven `active` only
 * flips after navigation lands, but `pending` fires immediately. If the route
 * is already prefetched the transition is instant and pending is simply
 * skipped, so this never lingers. `aria-current` stays on the real `active` so
 * assistive tech is never told the wrong page is current.
 */
function NavTabGlyph({ icon: Icon, active }: { icon: LucideIcon; active: boolean }) {
  const { pending } = useLinkStatus();
  const on = active || pending;
  return (
    <>
      {/* Selector "thumb": a lighter rounded container behind the active icon,
          inset from the cell edges. Rendered inside the tab (not floating), so
          it stays aligned; opacity-toggled for a soft fade between tabs. */}
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-1 inset-x-1.5 rounded-2xl bg-white/[0.12] transition-opacity duration-200",
          on ? "opacity-100" : "opacity-0",
        )}
      />
      <Icon
        className={cn(
          "relative z-[1] h-[25px] w-[25px] transition-[color,transform] duration-200 active:scale-90 motion-reduce:transition-none",
          on ? "text-highlight" : "text-[#7E978A]",
        )}
        strokeWidth={2}
      />
    </>
  );
}
