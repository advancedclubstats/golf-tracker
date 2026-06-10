/**
 * Owner access (portfolio read-only model).
 *
 * The deployed app is public and **read-only for visitors** — anyone can explore
 * every view, but only the owner can write (log rounds, edit, setup). Writes are
 * enforced here on the server (see `requireOwner` in every mutating action), not
 * just hidden in the UI, so a visitor literally cannot POST changes.
 *
 * The owner unlocks write access by visiting `/unlock?key=<OWNER_KEY>` once per
 * device, which sets an httpOnly cookie (see app/unlock/route.ts). `/unlock?lock=1`
 * clears it.
 *
 * When `OWNER_KEY` is unset (e.g. local dev), the gate is OFF and everyone is the
 * owner — so `next dev` keeps full access. Set `OWNER_KEY` in production.
 */

import { cookies } from "next/headers";

export const OWNER_COOKIE = "gt_owner";

/**
 * True when the request is the owner. With no `OWNER_KEY` configured the gate is
 * OFF in development (everyone is owner, so `next dev` keeps full access) but
 * fail-safe in production (no one can write until the key is set) — so a missing
 * key in Vercel can't accidentally leave the live app open to writes.
 */
export async function isOwner(): Promise<boolean> {
  const key = process.env.OWNER_KEY;
  if (!key) return process.env.NODE_ENV !== "production";
  const store = await cookies();
  return store.get(OWNER_COOKIE)?.value === key;
}

/** Throw if the caller isn't the owner. Call at the top of every write action. */
export async function requireOwner(): Promise<void> {
  if (!(await isOwner())) {
    throw new Error(
      "This is a read-only demo — only the owner can make changes.",
    );
  }
}
