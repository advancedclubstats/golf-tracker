import { NextResponse } from "next/server";
import { concedeHole } from "@/actions/shots";

/**
 * Pick-up / concede a hole from the entry wizard. Route handler (not a direct
 * Server Action call) so the write doesn't force an RSC re-render of the
 * force-dynamic entry page — see app/api/shots/route.ts for the full rationale.
 */
export async function POST(req: Request) {
  try {
    const { roundId, hole } = await req.json();
    await concedeHole(roundId, hole);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to pick up hole." },
      { status: 400 },
    );
  }
}
