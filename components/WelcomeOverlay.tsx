"use client";

/**
 * Welcome / owner sign-in (portfolio first impression).
 *
 * For visitors: a first-visit full-screen landing (Direction B) framing the
 * project for a non-golfer — a dark fairway hero (problem + who built it), then
 * a paper section showing the product itself (a real round, the way the recall
 * view renders it) and the one-tap invitation into the live seeded sandbox.
 * Dismissal is remembered (localStorage `gt_intro_seen`), and a small persistent
 * "Owner sign-in" pill lets the owner sign in any time via a password
 * (→ unlockOwner server action). For the owner: a "Owner mode · Sign out" pill.
 * The heavy lifting (write enforcement) is server-side; this is just the UX.
 *
 * The dark hero follows the codebase's dark-card convention (DistanceGapHero):
 * `bg-fairway-900` with fixed light `#EAF1EC` text + `#CDF23E` lime accents,
 * which read correctly regardless of theme. The paper proof card uses the
 * normal themeable tokens. The recall proof is a hand-tuned snapshot of a real
 * round (2026-06-19) — a curated marketing example, no live data plumbing.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { unlockOwner, lockOwner } from "@/actions/owner";
import { cn } from "@/lib/utils";

const SEEN_KEY = "gt_intro_seen";

const LINKEDIN_URL = "https://www.linkedin.com/in/matthewmartin3/";

/** Hand-tuned proof rows from a real round (2026-06-19) — see file header. */
const PROOF_HOLES = [
  { hole: 1, par: 4, tag: "Birdie", vsPar: -1 },
  { hole: 8, par: 3, tag: "Approach", vsPar: 1 },
  { hole: 15, par: 4, tag: "Birdie", vsPar: -1 },
] as const;

function fmtVsPar(n: number): string {
  if (n === 0) return "E";
  return n > 0 ? `+${n}` : `−${Math.abs(n)}`;
}

export function WelcomeOverlay({
  owner,
  shotCount,
}: {
  owner: boolean;
  /** Matt's real total shots (all scopes) — the splash usage credential. */
  shotCount: number;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [signin, setSignin] = useState(false);
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);

  // First-visit auto-open for visitors only (owners never see the intro). This
  // reads localStorage, which only exists on the client, so it must run after
  // mount — not in render or a state initializer (that would mismatch SSR).
  useEffect(() => {
    if (owner) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only localStorage gate
    if (localStorage.getItem(SEEN_KEY) !== "1") setOpen(true);
  }, [owner]);

  function dismiss() {
    localStorage.setItem(SEEN_KEY, "1");
    setOpen(false);
    setSignin(false);
    setError(false);
    setPassword("");
  }

  async function handleSignin(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(false);
    const ok = await unlockOwner(password);
    setBusy(false);
    if (ok) {
      localStorage.setItem(SEEN_KEY, "1");
      setOpen(false);
      router.refresh(); // re-render: owner now unlocked, write UI appears
    } else {
      setError(true);
    }
  }

  async function signOut() {
    await lockOwner();
    router.refresh();
  }

  return (
    <>
      {/* Persistent corner pill: sign in (visitor) / sign out (owner). */}
      <button
        type="button"
        onClick={owner ? signOut : () => { setOpen(true); setSignin(true); }}
        className="fixed bottom-3 left-3 z-40 rounded-full border border-border bg-card/90 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur transition-colors hover:text-foreground"
      >
        {owner ? "Owner mode · Sign out" : "Owner sign-in"}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-background">
          {/* Dark fairway hero: the problem, framed sharp, + who built it. */}
          <section className="bg-fairway-900 px-6 pb-9 pt-11 text-[#EAF1EC]">
            <div className="mx-auto w-full max-w-md">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-full bg-[#CDF23E]" aria-hidden />
                <span className="font-heading text-lg font-bold text-white">Round Recall</span>
              </div>
              <p className="eyebrow mt-8 text-[#CDF23E]/90">A portfolio project by Matt · PM / PMM</p>
              <h2 className="font-heading mt-2 text-[2rem] font-bold leading-[1.1] text-white text-balance">
                Tour-level golf stats, tracked from memory.
              </h2>
              <p className="mt-3.5 text-sm leading-relaxed text-[#EAF1EC]/70">
                No GPS, no sensors. I tap through a round from memory in five minutes
                and see, in strokes gained, exactly where it went.
              </p>
            </div>
          </section>

          {/* Paper section: show the product, then invite into the sandbox. */}
          <div className="mx-auto w-full max-w-md flex-1 px-6 pb-12 pt-7">
            <p className="eyebrow mb-2">A real round, the way you’ll see it</p>
            <div className="rounded-xl border border-border p-3.5">
              <p className="font-heading text-sm font-bold leading-snug">
                Off the tee was the leak this round — −3.2 vs your average.
              </p>
              <div className="mt-2.5 grid grid-cols-2 gap-1.5">
                <div className="rounded-lg bg-muted/40 px-2.5 py-1.5">
                  <div className="eyebrow text-[10px] text-muted-foreground">Putting</div>
                  <div className="font-mono text-sm font-semibold tabular-nums text-positive">+1.69</div>
                </div>
                <div className="rounded-lg bg-muted/40 px-2.5 py-1.5">
                  <div className="eyebrow text-[10px] text-muted-foreground">Off the tee</div>
                  <div className="font-mono text-sm font-semibold tabular-nums text-destructive">−3.23</div>
                </div>
              </div>
              <div className="mt-1.5">
                {PROOF_HOLES.map((h) => (
                  <div
                    key={h.hole}
                    className="flex items-center gap-3 border-b border-border py-2 last:border-b-0"
                  >
                    <span className="w-5 font-mono text-sm font-semibold tabular-nums">{h.hole}</span>
                    <span className="w-12 text-[11px] text-muted-foreground">par {h.par}</span>
                    <span className="flex-1">
                      <span
                        className={cn(
                          "eyebrow rounded px-1.5 py-0.5 text-[10px]",
                          h.vsPar < 0
                            ? "bg-highlight/25 text-foreground"
                            : "bg-clay/10 text-clay",
                        )}
                      >
                        {h.tag}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "font-mono text-[15px] font-bold tabular-nums",
                        h.vsPar < 0 ? "text-positive" : "text-destructive",
                      )}
                    >
                      {fmtVsPar(h.vsPar)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
            {!signin ? (
              <>
                <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
                  Poke around your own sandbox, seeded with a copy of my rounds. Edit,
                  add, break anything. It never touches my real numbers and clears
                  itself when you close the tab.
                </p>
                <button
                  type="button"
                  onClick={dismiss}
                  className="mt-4 h-12 w-full rounded-xl bg-primary text-base font-semibold text-primary-foreground transition-transform active:scale-[0.99]"
                >
                  Explore the live demo →
                </button>
                <a
                  href={LINKEDIN_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 flex h-12 w-full items-center justify-center rounded-xl border border-border text-sm font-medium text-foreground transition-colors hover:bg-muted"
                >
                  Connect on LinkedIn
                </a>
                {shotCount > 0 && (
                  <div className="mt-5 flex justify-center">
                    <span className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5">
                      <span className="h-[5px] w-[5px] rounded-full bg-primary" aria-hidden />
                      <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                        {shotCount.toLocaleString()} shots logged from memory
                      </span>
                    </span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setSignin(true)}
                  className="mt-3 w-full text-center text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                >
                  Owner sign-in
                </button>
              </>
            ) : (
              <form onSubmit={handleSignin} className="mt-6">
                <label className="eyebrow text-muted-foreground">Owner password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(false); }}
                  autoFocus
                  className={cn(
                    "mt-1 h-12 w-full rounded-xl border-2 bg-card px-4 text-base outline-none transition-colors",
                    error ? "border-destructive" : "border-border focus:border-primary",
                  )}
                  placeholder="Enter your password"
                />
                {error && (
                  <p className="mt-1.5 text-xs font-medium text-destructive">
                    Incorrect password.
                  </p>
                )}
                <button
                  type="submit"
                  disabled={busy || password.length === 0}
                  className="mt-3 h-12 w-full rounded-xl bg-primary text-base font-semibold text-primary-foreground transition-transform active:scale-[0.99] disabled:opacity-50"
                >
                  {busy ? "Signing in…" : "Sign in"}
                </button>
                <button
                  type="button"
                  onClick={() => { setSignin(false); setError(false); setPassword(""); }}
                  className="mt-2 h-10 w-full rounded-xl text-sm text-muted-foreground transition-colors hover:bg-muted"
                >
                  Back
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
