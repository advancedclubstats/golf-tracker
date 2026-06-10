# Deploying Golf Tracker

The app is a Next.js (App Router) PWA backed by a hosted Supabase project. It
deploys to **Vercel** straight from the GitHub repo. The Supabase backend is
already cloud-hosted, so the deployed app and local `next dev` talk to the **same
database** (same rounds/shots) — that's intended.

## One-time setup

1. **Vercel → Add New → Project**, import `advancedclubstats/golf-tracker`.
   Framework preset auto-detects as **Next.js**; leave build/output defaults.

2. **Environment variables** (Project → Settings → Environment Variables). Set all
   three for **Production** (and Preview if you want gated preview builds):

   | Name | Value | Notes |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | *(copy from your local `.env.local`)* | The Supabase project URL. |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | *(copy from your local `.env.local`)* | Used only server-side here — this app makes no client-side DB calls, so it never reaches the browser bundle. Don't paste it anywhere public. |
   | `OWNER_KEY` | *(choose a secret)* | Unlocks **write** access (see below). The app is public read-only; this is how *you* log/edit. Required in production — without it, the live app is read-only for everyone (including you). |

   Copy the two `NEXT_PUBLIC_*` values from your local `.env.local` — never commit
   them. Pick any hard-to-guess string for `OWNER_KEY`.

3. **Deploy.** Vercel builds and gives you a `*.vercel.app` URL. Every push to
   `main` auto-deploys after this.

## Public read-only + owner write (portfolio model)

The app is **public and read-only** — anyone can explore every view on the real
data. **Writes** (log a round, edit, clear hole, setup) are owner-only, enforced
server-side in every mutating action (`lib/auth/owner.ts` → `requireOwner`), so a
visitor literally can't POST changes. Owner-only pages (new round, the entry flow,
setup) redirect visitors to the read-only view.

**To unlock write access (you):** visit `https://<your-site>/unlock?key=<OWNER_KEY>`
once per device. It sets an httpOnly cookie and you have full access (log rounds
on your phone at the course, etc.). `…/unlock?lock=1` clears it.

- `OWNER_KEY` unset in **production** → no one can write (fail-safe). Set it.
- `OWNER_KEY` unset in **development** → everyone is owner, so `next dev` keeps
  full access with no unlock step.

When you're ready for real multi-user auth, replace this with Supabase Auth (see
`docs/BACKLOG.md`).

## Install on your phone (PWA)

Open the Vercel URL in mobile Safari/Chrome → **Share → Add to Home Screen**.
The `manifest.json` + icons make it launch full-screen like a native app — the
intended way to log rounds at the course.

## Security posture (current)

Public portfolio piece, intentionally lightweight:

- **Public read-only; writes are owner-only** and enforced server-side
  (`requireOwner` in every mutating action), so visitors can browse everything
  but can't change anything. Your showcase data can't be broken by a visitor.
- **No client-side DB access.** Every query runs server-side, so the Supabase
  anon key never ships to the browser (verified: 0 occurrences in the built
  client bundle). It lives only in server env + your gitignored `.env.local`.
- RLS is **off** by design at this stage. The anon key isn't published and the
  Supabase API rejects requests without it (401); writes are gated by
  `requireOwner` regardless. Defense-in-depth (RLS + `service_role`) remains an
  option but is unnecessary here.

The proper multi-user fix (Supabase Auth → `auth.uid()` RLS policies → drop the
`OWNER_KEY` gate) is tracked in `docs/BACKLOG.md`.
