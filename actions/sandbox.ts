"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { isSandbox, getDataScopeUserId, userDataTag } from "@/lib/auth/scope";
import { COURSE_GEOMETRY_TAG } from "@/lib/db/courses";

/**
 * Seed a logged-out visitor's sandbox with a copy of the owner's rounds/shots,
 * so the app feels lived-in and is fully editable without touching real data.
 *
 * Called once on first visit by <SandboxBootstrap>. The DB function is
 * idempotent (no-op if the sandbox already has rounds), so repeat calls are
 * cheap and safe. No-op for the owner.
 */
export async function ensureSandboxSeeded(): Promise<void> {
  if (!(await isSandbox())) return;

  const target = await getDataScopeUserId();
  const supabase = createServerClient();

  const { error } = await supabase.rpc("seed_sandbox", { p_target: target });
  if (error) throw new Error(`Failed to seed sandbox: ${error.message}`);

  // Reflect the freshly-seeded data on the views the visitor lands on. The seed
  // inserts this sandbox's rounds/shots, so bust its cached reads too.
  revalidatePath("/");
  revalidatePath("/rounds");
  revalidateTag(userDataTag(target), { expire: 0 });
  // Backstop: if seeding ever introduces geometry for this scope, make sure the
  // cached global tee/yardage reads include it (otherwise tee-shot SG distances
  // could be unfilled until the revalidate window elapses).
  revalidateTag(COURSE_GEOMETRY_TAG, { expire: 0 });
}
