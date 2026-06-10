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
   | `NEXT_PUBLIC_SUPABASE_URL` | *(copy from your local `.env.local`)* | Public; the Supabase project URL. |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | *(copy from your local `.env.local`)* | Public. With RLS enabled (migration 013) this key can read/write nothing — it's safe in the client bundle. |
   | `SUPABASE_SERVICE_ROLE_KEY` | *(Supabase → Project Settings → API → `service_role`)* | **Secret.** The server uses it to bypass RLS. NEVER prefix with `NEXT_PUBLIC_` and never expose it client-side. Required once RLS is on. |
   | `APP_PASSWORD` | *(choose a password)* | The access gate (see below). Pick something only you know. |

   Copy the `NEXT_PUBLIC_*` values from your local `.env.local`; get the
   `service_role` key from the Supabase dashboard. Never commit any of them.

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

Two layers, even though there's no per-user auth yet:

1. **RLS on, server uses `service_role` (migration 013).** Every table has Row
   Level Security enabled with no policies, so the public anon key in the browser
   bundle can read/write **nothing**. The server bypasses RLS via the secret
   `service_role` key. So a leaked anon key (or a guessed URL) gets you nothing.
2. **`APP_PASSWORD` gate (`proxy.ts`).** Keeps the app UI itself private.

This is single-user: anyone who knows `APP_PASSWORD` is "the user." The proper
multi-user fix (Supabase Auth → `auth.uid()` RLS policies → drop the service_role
usage and the password gate) is tracked in `docs/BACKLOG.md`.

> **If the app suddenly can't read/write after enabling RLS**, the server is
> falling back to the anon key — `SUPABASE_SERVICE_ROLE_KEY` is missing in that
> environment. Set it and redeploy.
