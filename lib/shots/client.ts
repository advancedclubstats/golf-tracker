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
 */

import type { ShotInsert, ShotUpdate } from "@/lib/schemas/shot";

async function postJson<T>(url: string, method: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const payload = (await res.json().catch(() => null)) as { error?: string } | null;
    throw new Error(payload?.error ?? `Request failed (${res.status}).`);
  }
  return res.json() as Promise<T>;
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
