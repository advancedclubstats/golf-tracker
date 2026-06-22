import { describe, it, expect, vi, afterEach } from "vitest";
import { saveShot } from "@/lib/shots/client";
import type { ShotInsert } from "@/lib/schemas/shot";

/**
 * postJson's transient-retry behaviour (the "Load failed" fix). A `fetch` that
 * rejects at the network layer is retried; a received HTTP error status is not.
 */

const okResponse = () =>
  ({ ok: true, json: async () => ({ id: "shot-1" }) }) as unknown as Response;
const errResponse = (status: number, body: unknown = null) =>
  ({ ok: false, status, json: async () => body }) as unknown as Response;

// Minimal valid insert payload — the body shape doesn't matter here since fetch
// is mocked; we only exercise the transport wrapper.
const draft = { round_id: "r", hole: 1, par: 4, shot_no: 1, club: "D" } as ShotInsert;

afterEach(() => {
  vi.restoreAllMocks();
});

describe("postJson retry (via saveShot)", () => {
  it("retries a network-level failure, then succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("Load failed")) // mobile Safari blip
      .mockResolvedValueOnce(okResponse());
    vi.stubGlobal("fetch", fetchMock);

    await expect(saveShot(draft)).resolves.toEqual({ id: "shot-1" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after 3 network failures with a clear message (not 'Load failed')", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError("Load failed"));
    vi.stubGlobal("fetch", fetchMock);

    await expect(saveShot(draft)).rejects.toThrow(/couldn't reach the server/i);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("does NOT retry a received HTTP error status — surfaces it once", async () => {
    const fetchMock = vi.fn().mockResolvedValue(errResponse(400, { error: "bad shot" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(saveShot(draft)).rejects.toThrow("bad shot");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
