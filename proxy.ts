import { NextResponse, type NextRequest } from "next/server";

/**
 * Lightweight access gate for the deployed app (Next "proxy" convention — the
 * renamed successor to `middleware`).
 *
 * The app has no real auth yet (single hardcoded V1_USER_ID, RLS disabled), so a
 * public URL would be world-readable/writable. This adds HTTP Basic Auth gated
 * on a single shared password from the `APP_PASSWORD` env var — enough to keep a
 * single-user hobby deployment private until proper Supabase Auth lands.
 *
 * - When `APP_PASSWORD` is unset (e.g. local dev), the gate is OFF and everything
 *   passes through, so `next dev` is never prompted.
 * - Static assets, the PWA manifest, and icons are excluded (see `config`) so the
 *   install / home-screen flow isn't blocked by the auth prompt.
 *
 * Runs on the Edge runtime; `atob` is available there.
 */
export function proxy(req: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) return NextResponse.next(); // gate disabled (local dev)

  const header = req.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    const decoded = atob(header.slice("Basic ".length));
    const supplied = decoded.slice(decoded.indexOf(":") + 1); // ignore username
    if (supplied === password) return NextResponse.next();
  }

  return new NextResponse("Authentication required.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="Golf Tracker", charset="UTF-8"' },
  });
}

export const config = {
  // Gate everything except Next static assets and the PWA install files.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.json|icons/).*)"],
};
