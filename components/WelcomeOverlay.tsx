"use client";

/**
 * Welcome / owner sign-in (portfolio first impression).
 *
 * For visitors: a first-visit overlay framing the project and inviting them to
 * explore (read-only). Dismissal is remembered (localStorage), and a small
 * persistent "Owner sign-in" pill lets the owner sign in any time via a password
 * (→ unlockOwner server action, which sets the owner cookie). For the owner: a
 * small "Owner mode · Sign out" pill. The heavy lifting (write enforcement) is
 * server-side; this is just the UX over it.
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { unlockOwner, lockOwner } from "@/actions/owner";
import { cn } from "@/lib/utils";

const SEEN_KEY = "gt_intro_seen";

const LINKEDIN_URL = "https://www.linkedin.com/in/matthewmartin3/";

export function WelcomeOverlay({ owner }: { owner: boolean }) {
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
        className="fixed bottom-3 right-3 z-40 rounded-full border border-border bg-card/90 px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm backdrop-blur transition-colors hover:text-foreground"
      >
        {owner ? "Owner mode · Sign out" : "Owner sign-in"}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90dvh] w-full max-w-md flex-col overflow-y-auto rounded-2xl border border-border bg-background p-6 shadow-xl">
            <p className="eyebrow text-muted-foreground">👋 A portfolio project</p>
            <h2 className="mt-1 font-heading text-3xl font-bold">Round Recall</h2>

            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              I&apos;m <span className="font-medium text-foreground">Matt</span>, a PM
              and PMM. I built this because I wanted tour-level data for my golf game
              without using a GPS on the course or buying expensive sensors.
              Everything in here is my own rounds at Hayden Lake Country Club, tracked
              from memory and entered after I play. It all runs on{" "}
              <span className="text-foreground">Strokes Gained</span>, and every
              number drills down to the exact shots behind it.
            </p>

            <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
              Go ahead and poke around. You&apos;re in your own sandbox seeded with a
              copy of my rounds. Add your own data, edit mine, break whatever you
              want, it&apos;s isolated and{" "}
              <span className="text-foreground">never touches my real numbers</span>.
              It clears itself when you close the browser, so don&apos;t worry about
              leaving a mess.
            </p>

            {!signin ? (
              <>
                <button
                  type="button"
                  onClick={dismiss}
                  className="mt-5 h-12 w-full rounded-xl bg-primary text-base font-semibold text-primary-foreground transition-transform active:scale-[0.99]"
                >
                  Take a look →
                </button>
                <p className="mt-3 text-center text-xs text-muted-foreground">
                  Like what you see? Tell me on{" "}
                  <a
                    href={LINKEDIN_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline underline-offset-2 hover:text-foreground"
                  >
                    LinkedIn
                  </a>
                  .{" "}
                  <button
                    type="button"
                    onClick={() => setSignin(true)}
                    className="underline underline-offset-2 hover:text-foreground"
                  >
                    Owner sign-in
                  </button>
                </p>
              </>
            ) : (
              <form onSubmit={handleSignin} className="mt-5">
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
