/**
 * Per-request data scope.
 *
 * Rounds and shots are scoped by `user_id`. The owner reads/writes the real data
 * (`V1_USER_ID`); every logged-out visitor gets an isolated **sandbox** under a
 * random `user_id` carried in the `gt_sandbox` cookie (minted by middleware).
 * This lets visitors use the full app — log rounds, edit shots — against a
 * seeded copy of the owner's data without ever touching the owner's rows.
 *
 * Courses/clubs are NOT scoped here — they stay shared, read-only reference
 * (see `lib/db/courses.ts` / `lib/db/clubs.ts`, still keyed to `V1_USER_ID`).
 *
 * Isolation is enforced in the query layer (this app has no RLS). The owner is
 * gated by the secret-key cookie (`isOwner`); the sandbox id is an httpOnly
 * cookie a visitor can't use to reach owner rows.
 */

import { cookies } from "next/headers";
import { isOwner } from "@/lib/auth/owner";
import { V1_USER_ID } from "@/lib/constants";

export const SANDBOX_COOKIE = "gt_sandbox";

/**
 * Cache tag for a scope's shots+rounds reads. The per-scope `getAllShots` /
 * `getAllRounds` are cached under this tag so every read for a `user_id` shares
 * one entry; any write to that scope busts it via `revalidateTag`. Keyed by
 * `user_id` so the owner and each sandbox visitor invalidate independently and
 * never cross scopes.
 */
export function userDataTag(userId: string): string {
  return `user-data-${userId}`;
}

/** True when the caller is a logged-out visitor operating in a sandbox. */
export async function isSandbox(): Promise<boolean> {
  return !(await isOwner());
}

/**
 * The `user_id` that scopes rounds/shots for this request: the owner's real id,
 * or the visitor's sandbox id from the cookie. Falls back to a throwaway id if
 * the cookie is somehow missing (middleware normally mints it) so a visitor
 * never accidentally reads or writes the owner's data.
 */
export async function getDataScopeUserId(): Promise<string> {
  if (await isOwner()) return V1_USER_ID;
  const store = await cookies();
  return store.get(SANDBOX_COOKIE)?.value ?? "00000000-0000-0000-0000-000000000000";
}
