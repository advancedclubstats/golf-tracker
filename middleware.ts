/**
 * Mints the visitor **sandbox** cookie. Every logged-out visitor gets a random
 * `gt_sandbox` id so their rounds/shots are scoped to an isolated copy of the
 * owner's data (see `lib/auth/scope.ts`). It's a *session* cookie (no Max-Age),
 * so closing the browser starts a fresh sandbox next visit; a 24h DB purge
 * (pg_cron) reaps abandoned ones.
 *
 * Owner requests (valid `gt_owner` key cookie, or local dev with no `OWNER_KEY`)
 * are left alone — they operate on the real data. No DB work happens here.
 */

import { NextResponse, type NextRequest } from "next/server";

const OWNER_COOKIE = "gt_owner";
const SANDBOX_COOKIE = "gt_sandbox";

function isOwnerRequest(req: NextRequest): boolean {
  const key = process.env.OWNER_KEY;
  // Mirror lib/auth/owner.ts: no key configured ⇒ gate off in dev, on in prod.
  if (!key) return process.env.NODE_ENV !== "production";
  return req.cookies.get(OWNER_COOKIE)?.value === key;
}

export function middleware(req: NextRequest) {
  // Owner or already-sandboxed: nothing to mint.
  if (isOwnerRequest(req) || req.cookies.get(SANDBOX_COOKIE)) {
    return NextResponse.next();
  }

  const id = crypto.randomUUID();
  // Set on the request too, so this same render resolves the new scope.
  req.cookies.set(SANDBOX_COOKIE, id);
  const res = NextResponse.next({ request: { headers: req.headers } });
  res.cookies.set(SANDBOX_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    // No maxAge/expires → session cookie (cleared when the browser closes).
  });
  return res;
}

export const config = {
  // Run on pages, not static assets or API routes.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|manifest.json).*)"],
};
