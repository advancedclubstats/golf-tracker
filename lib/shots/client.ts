/**
 * Client-side fetch wrappers for shot writes from the entry wizard.
 *
 * The wizard calls these instead of the server actions so a save doesn't
 * trigger an RSC re-render of the force-dynamic entry page (which is what made
 * a committed shot surface as a failed "Server Components render" save). See
 * app/api/shots/route.ts for the full rationale.
 *
 * Each rejects with a readable Error on a non-2xx response so the wizard's
 * existing try/catch → toast keeps working for genuine failures.
 *
 * Transient-failure retry: a `fetch` that never reaches the server or whose
 * response is lost rejects with a TypeError — Safari surfaces it as the bare
 * "Load failed" toast mid-entry. The usual cause on mobile is the browser
 * reusing a keep-alive socket the serverless function has already closed; a
 * fresh attempt succeeds (which is why a refresh "fixes" it). We retry those
 * network-level failures with a short backoff. This is the client-side analog
 * of `lib/supabase/retry.ts`, and it's safe to retry because every write here
 * is idempotent: createShot upserts on (round_id, hole, shot_no); edit/delete
 * key off the row id. A *received* HTTP error status is NOT retried — it's
 * deterministic, so the caller sees it once.
 */

import type { ShotInsert, ShotUpdate } from "@/lib/schemas/shot";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function postJson<T>(url: string, method: string, body: unknown): Promise<T> {
  const tries = 3;
  for (let attempt = 1; ; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
    } catch (err) {
      // Network-level failure (no response). Retry a couple of times before
      // giving up with a clearer message than the raw "Load failed".
      if (attempt < tries) {
        await sleep(200 * attempt);
        continue;
      }
      throw new Error("Network hiccup — couldn't reach the server. Try again.", {
        cause: err,
      });
    }
    if (!res.ok) {
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      throw new Error(payload?.error ?? `Request failed (${res.status}).`);
    }
    return res.json() as Promise<T>;
  }
}

export function saveShot(data: ShotInsert): Promise<{ id: string }> {
  return postJson("/api/shots", "POST", data);
}

export function editShot(
  id: string,
  roundId: string,
  data: ShotUpdate,
): Promise<{ ok: true }> {
  return postJson("/api/shots", "PATCH", { id, roundId, data });
}

export function deleteShot(id: string, roundId: string): Promise<{ ok: true }> {
  return postJson("/api/shots", "DELETE", { id, roundId });
}

export function pickUpHole(roundId: string, hole: number): Promise<{ ok: true }> {
  return postJson("/api/rounds/concede", "POST", { roundId, hole });
}

export function clearHole(roundId: string, hole: number): Promise<{ ok: true }> {
  return postJson("/api/rounds/clear-hole", "POST", { roundId, hole });
}
