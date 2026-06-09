import { NextResponse } from "next/server";
import { clearHole } from "@/actions/shots";

/**
 * Clear a hole's shots so it can be re-entered from the tee. Route handler (not
 * a direct Server Action call) so the delete doesn't force an RSC re-render of
 * the force-dynamic entry page — see app/api/shots/route.ts for the rationale.
 */
export async function POST(req: Request) {
  try {
    const { roundId, hole } = await req.json();
    await clearHole(roundId, hole);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to clear hole." },
      { status: 400 },
    );
  }
}
