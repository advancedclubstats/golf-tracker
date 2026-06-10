"use server";

import { cookies } from "next/headers";
import { OWNER_COOKIE } from "@/lib/auth/owner";

/**
 * Owner sign-in via password (the welcome-screen form). Compares the submitted
 * password to OWNER_KEY and, on a match, sets the httpOnly owner cookie that
 * unlocks write access (see lib/auth/owner.ts). Returns whether it matched so
 * the form can show an error. The password travels in the POST body over HTTPS —
 * never in the URL.
 */
export async function unlockOwner(password: string): Promise<boolean> {
  const key = process.env.OWNER_KEY;
  if (!key || password !== key) return false;
  (await cookies()).set(OWNER_COOKIE, key, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // a year
  });
  return true;
}

/** Sign out of owner mode (back to the read-only visitor view). */
export async function lockOwner(): Promise<void> {
  (await cookies()).delete(OWNER_COOKIE);
}
