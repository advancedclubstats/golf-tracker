"use client";

/**
 * Icon-only Liquid Glass bottom navigation — the app's primary chrome.
 * Replaces the old top tab row (StatsNav) and the "New Round" pill: four
 * destinations plus a central FAB that starts a round, floating in the thumb
 * zone over the warm-paper background.
 *
 * A selector orb glides under the active tab on a soft spring. The bar hides
 * during the focused shot-entry flow (`/rounds/[id]/log`) so logging stays
 * distraction-free. An in-flow spacer reserves scroll clearance so page
 * content is never tucked behind the bar (the document body is the scroll
 * container).
 */

import { useEffect, useLayoutEffect, useRef, useState } from "react";
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

// SSR-safe layout effect (avoids the React warning on the server).
const useIsoLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

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

export function BottomNav({ owner }: { owner: boolean }) {
  const pathname = usePathname() ?? "/";
  const navRef = useRef<HTMLElement>(null);
  const tabRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const [orb, setOrb] = useState<{ x: number; visible: boolean }>({
    x: 0,
    visible: false,
  });

  const active = activeKey(pathname);

  // Visitors (read-only demo) don't get write actions: hide Setup + the FAB.
  const tabs = owner ? TABS : TABS.filter((t) => t.key !== "setup");

  // Glide the orb under the active tab; recompute on route + resize.
  useIsoLayoutEffect(() => {
    function place() {
      const nav = navRef.current;
      const el = active ? tabRefs.current[active] : null;
      if (!nav || !el) {
        setOrb((o) => ({ ...o, visible: false }));
        return;
      }
      const navBox = nav.getBoundingClientRect();
      const box = el.getBoundingClientRect();
      const center = box.left - navBox.left + box.width / 2;
      setOrb({ x: center, visible: true });
    }
    place();
    window.addEventListener("resize", place);
    return () => window.removeEventListener("resize", place);
  }, [active, owner, pathname]);

  if (isFocusedFlow(pathname)) return null;

  return (
    <>
      {/* In-flow spacer so the fixed bar never covers page content. */}
      <div aria-hidden className="h-[calc(96px+env(safe-area-inset-bottom))]" />

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center pb-[calc(18px+env(safe-area-inset-bottom))]">
        <nav
          ref={navRef}
          aria-label="Primary"
          className="pointer-events-auto relative mx-4 flex w-[calc(100%-32px)] max-w-[420px] items-center justify-around overflow-visible rounded-full border border-white/75 px-3 py-2 backdrop-blur-2xl backdrop-saturate-150"
          style={{
            background:
              "linear-gradient(180deg, rgba(255,255,255,.5), rgba(246,243,236,.32))",
            backdropFilter: "blur(36px) saturate(1.9) brightness(1.05)",
            WebkitBackdropFilter: "blur(36px) saturate(1.9) brightness(1.05)",
            boxShadow:
              "0 20px 46px -14px rgba(20,32,26,.34), 0 2px 8px rgba(20,32,26,.08), inset 0 1px 0 rgba(255,255,255,.95), inset 0 -2px 3px rgba(255,255,255,.4)",
          }}
        >
          {/* Specular sheen */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-[inherit]"
            style={{
              background:
                "linear-gradient(150deg, rgba(255,255,255,.5) 0%, rgba(255,255,255,0) 40%)",
              mixBlendMode: "screen",
            }}
          />

          {/* Selector orb */}
          <span
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-0 z-[1] h-[50px] w-[50px] -translate-y-1/2 rounded-full border border-white/85 motion-reduce:transition-none"
            style={{
              background:
                "radial-gradient(125% 125% at 50% 22%, rgba(255,255,255,.92), rgba(217,241,228,.72) 52%, rgba(143,217,180,.6))",
              boxShadow:
                "0 7px 18px -5px rgba(21,120,74,.45), inset 0 1px 2px rgba(255,255,255,.95), inset 0 -4px 7px rgba(21,120,74,.2)",
              opacity: orb.visible ? 1 : 0,
              transform: `translate(${orb.x - 25}px, -50%)`,
              transition:
                "transform .52s cubic-bezier(.34,1.32,.48,1), opacity .25s ease",
            }}
          />

          {/* Left half: Home, Rounds */}
          {tabs
            .filter((t) => t.key === "home" || t.key === "rounds")
            .map((t) => (
              <NavTab
                key={t.key}
                tab={t}
                active={active === t.key}
                refCb={(el) => (tabRefs.current[t.key] = el)}
              />
            ))}

          {/* Center FAB — start a round (owner only) */}
          {owner && (
            <Link
              href="/rounds/new"
              aria-label="Log a round"
              className="relative z-[3] mx-1.5 flex h-14 w-14 shrink-0 -translate-y-3.5 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform duration-150 active:translate-y-[-14px] active:scale-95 motion-reduce:transition-none"
              style={{
                boxShadow:
                  "0 12px 26px -6px rgba(21,120,74,.5), 0 0 0 5px rgba(205,242,62,.3), inset 0 1px 1px rgba(255,255,255,.4)",
              }}
            >
              <Plus className="h-[26px] w-[26px]" strokeWidth={2.25} />
            </Link>
          )}

          {/* Right half: Stats, Setup */}
          {tabs
            .filter((t) => t.key === "stats" || t.key === "setup")
            .map((t) => (
              <NavTab
                key={t.key}
                tab={t}
                active={active === t.key}
                refCb={(el) => (tabRefs.current[t.key] = el)}
              />
            ))}
        </nav>
      </div>
    </>
  );
}

function NavTab({
  tab,
  active,
  refCb,
}: {
  tab: Tab;
  active: boolean;
  refCb: (el: HTMLAnchorElement | null) => void;
}) {
  const Icon = tab.icon;
  return (
    <Link
      ref={refCb}
      href={tab.href}
      aria-label={tab.label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative z-[2] flex flex-1 items-center justify-center px-0.5 py-3 transition-colors duration-300",
        active ? "text-fairway-900" : "text-muted-foreground",
      )}
    >
      <Icon
        className={cn(
          "h-[25px] w-[25px] transition-transform duration-300 active:scale-90 motion-reduce:transition-none",
          active && "scale-110",
        )}
        strokeWidth={2}
      />
    </Link>
  );
}
