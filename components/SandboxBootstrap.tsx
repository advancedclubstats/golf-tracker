"use client";

/**
 * Seeds a logged-out visitor's sandbox on first load. Rendered in the root
 * layout for visitors only. The seed action is idempotent server-side; here we
 * call it once per mount and refresh so the seeded rounds/shots appear. Uses
 * sessionStorage to avoid re-calling on every client navigation within a tab.
 */

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ensureSandboxSeeded } from "@/actions/sandbox";

const SEEDED_FLAG = "gt_sandbox_seeded";

export function SandboxBootstrap() {
  const router = useRouter();

  useEffect(() => {
    if (sessionStorage.getItem(SEEDED_FLAG)) return;
    let cancelled = false;
    (async () => {
      try {
        await ensureSandboxSeeded();
        if (cancelled) return;
        sessionStorage.setItem(SEEDED_FLAG, "1");
        router.refresh();
      } catch {
        // Best-effort: a failed seed just leaves an empty sandbox; don't surface.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return null;
}
