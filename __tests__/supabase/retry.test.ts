import { describe, it, expect, vi } from "vitest";
import type { PostgrestError } from "@supabase/supabase-js";
import { withRetry } from "@/lib/supabase/retry";

type Result<T> = { data: T; error: PostgrestError | null };

const ok = <T>(data: T): Result<T> => ({ data, error: null });
const err = (code: string, message = "boom"): Result<null> => ({
  data: null,
  error: { code, message, details: "", hint: "" } as PostgrestError,
});

/** A thunk that returns the given results in order, one per call. */
function sequence<T>(...results: Result<T>[]) {
  let i = 0;
  return vi.fn(() => Promise.resolve(results[Math.min(i++, results.length - 1)]));
}

describe("withRetry", () => {
  const fast = { baseDelayMs: 0 };

  it("returns immediately on success without retrying", async () => {
    const run = sequence(ok("first"));
    const res = await withRetry(run, fast);
    expect(res.data).toBe("first");
    expect(run).toHaveBeenCalledOnce();
  });

  it("retries a transient connection error, then succeeds", async () => {
    const run = sequence(err("08006"), ok("recovered"));
    const res = await withRetry(run, fast);
    expect(res.data).toBe("recovered");
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("treats a missing error code (fetch/network failure) as transient", async () => {
    const run = sequence(err("", "fetch failed"), ok("recovered"));
    const res = await withRetry(run, fast);
    expect(res.data).toBe("recovered");
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("does NOT retry a logical error (e.g. PGRST116 no-rows) — returns it at once", async () => {
    const run = sequence(err("PGRST116"));
    const res = await withRetry(run, fast);
    expect(res.error?.code).toBe("PGRST116");
    expect(run).toHaveBeenCalledOnce();
  });

  it("does NOT retry a constraint violation", async () => {
    const run = sequence(err("23505", "duplicate key"));
    const res = await withRetry(run, fast);
    expect(res.error?.code).toBe("23505");
    expect(run).toHaveBeenCalledOnce();
  });

  it("gives up after `tries` transient failures and returns the last error", async () => {
    const run = sequence(err("08006"), err("08006"), err("08006"));
    const res = await withRetry(run, { ...fast, tries: 3 });
    expect(res.error?.code).toBe("08006");
    expect(run).toHaveBeenCalledTimes(3);
  });

  it("retries a thrown fetch failure, then succeeds", async () => {
    let calls = 0;
    const run = vi.fn(() => {
      calls += 1;
      if (calls === 1) throw new Error("network down");
      return Promise.resolve(ok("recovered"));
    });
    const res = await withRetry(run, fast);
    expect(res.data).toBe("recovered");
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("rethrows if the thunk keeps throwing past the last attempt", async () => {
    const run = vi.fn(() => {
      throw new Error("network down");
    });
    await expect(withRetry(run, { ...fast, tries: 2 })).rejects.toThrow(
      "network down",
    );
    expect(run).toHaveBeenCalledTimes(2);
  });
});
