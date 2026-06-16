/**
 * Friendly title for a leak from its kind + bucket/club label. Kept in a plain
 * (non-"use client") module so both the server-rendered hero and the client
 * leak list can call it.
 */

import type { Leak } from "@/lib/analytics/leaks";

export function leakTitle(leak: Leak): string {
  switch (leak.kind) {
    case "approach":
      return `Approach ${leak.label}`;
    case "putt":
      return `Putts ${leak.label}`;
    case "atg":
      return `Around green ${leak.label}`;
  }
}
