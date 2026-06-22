import { NextResponse } from "next/server";
import { createShot, updateShot, deleteShot } from "@/actions/shots";

/**
 * Route handlers for shot writes from the entry wizard.
 *
 * Why a route handler and not the server actions directly: invoking a Server
 * Action from the client *always* re-renders the current route's server
 * components. The shot-entry page is `force-dynamic`, so that re-render re-runs
 * its DB reads on every save — and if one transiently fails, the thrown
 * "Server Components render" error becomes the rejection of the action call,
 * so a shot that already committed looks like a failed save and the wizard
 * stalls. A `fetch` to a route handler runs the same write with NO RSC
 * re-render, so the save returns cleanly. The wizard owns its UI state; the
 * dashboard / round pages are `force-dynamic` and refetch when navigated to.
 *
 * These delegate to the existing actions (which validate + revalidate); calling
 * them here runs the logic without the client-side re-render side effect.
 */

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { id } = await createShot(body);
    return NextResponse.json({ id });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to save shot." },
      { status: 400 },
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const { id, roundId, data } = await req.json();
    await updateShot(id, roundId, data);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update shot." },
      { status: 400 },
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { id, roundId } = await req.json();
    await deleteShot(id, roundId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to delete shot." },
      { status: 400 },
    );
  }
}
