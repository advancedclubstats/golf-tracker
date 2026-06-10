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
   | `APP_PASSWORD` | *(choose a password)* | The access gate (see below). Pick something only you know. |

   Copy the two `NEXT_PUBLIC_*` values from your local `.env.local` — never commit
   them.

3. **Deploy.** Vercel builds and gives you a `*.vercel.app` URL. Every push to
   `main` auto-deploys after this.

## The access gate

There's no real auth yet (single hardcoded user, RLS off), so `middleware.ts`
adds **HTTP Basic Auth** gated on `APP_PASSWORD`:

- First visit prompts for a username/password. **Username is ignored**; enter any
  username and the `APP_PASSWORD` value as the password.
- If `APP_PASSWORD` is unset the gate is **off** — which is why local `next dev`
  is never prompted. Always set it in Vercel.
- Static assets, `manifest.json`, and `/icons/` are excluded so PWA install works.

To remove the gate later (e.g. once Supabase Auth lands), delete `middleware.ts`
and unset `APP_PASSWORD`.

## Install on your phone (PWA)

Open the Vercel URL in mobile Safari/Chrome → **Share → Add to Home Screen**.
The `manifest.json` + icons make it launch full-screen like a native app — the
intended way to log rounds at the course.

## Security posture (current)

Single-user, and intentionally lightweight:

- **No client-side DB access.** Every query runs server-side, so the Supabase
  anon key never ships to the browser (verified: 0 occurrences in the built
  client bundle). It lives only in server env + your gitignored `.env.local`.
- **`APP_PASSWORD` gate (`proxy.ts`).** Keeps the app private; anyone who knows
  the password is "the user."
- RLS is **off** by design at this stage. Because the anon key isn't published
  and the Supabase API rejects requests without it (401), the practical exposure
  is low. If you ever want defense-in-depth (deny even a leaked key), enable RLS
  and switch the server to a `service_role` key — but that's optional here.

The proper multi-user fix (Supabase Auth → `auth.uid()` RLS policies → drop the
password gate) is tracked in `docs/BACKLOG.md`.
