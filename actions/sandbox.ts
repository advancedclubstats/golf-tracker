"use server";

import { revalidatePath } from "next/cache";
import { createServerClient } from "@/lib/supabase/server";
import { isSandbox, getDataScopeUserId } from "@/lib/auth/scope";

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

  // Reflect the freshly-seeded data on the views the visitor lands on.
  revalidatePath("/");
  revalidatePath("/rounds");
}
