import { NextResponse, type NextRequest } from "next/server";
import { OWNER_COOKIE } from "@/lib/auth/owner";

/**
 * Owner unlock/lock for the read-only portfolio model.
 *
 * - `GET /unlock?key=<OWNER_KEY>` — if the key matches, set the httpOnly owner
 *   cookie (enables write access on this device), then redirect home.
 * - `GET /unlock?lock=1` — clear the cookie (back to read-only).
 *
 * The cookie is httpOnly, so a visitor can't read or forge it without the key.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const res = NextResponse.redirect(new URL("/", req.url));

  if (url.searchParams.get("lock") != null) {
    res.cookies.delete(OWNER_COOKIE);
    return res;
  }

  const key = process.env.OWNER_KEY;
  if (key && url.searchParams.get("key") === key) {
    res.cookies.set(OWNER_COOKIE, key, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365, // a year
    });
  }
  return res;
}
