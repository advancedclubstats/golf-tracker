import Link from "next/link";
import { getAllShots } from "@/lib/db/shots";
import { getAllRounds } from "@/lib/db/rounds";
import { computeRoundList } from "@/lib/analytics/rounds";
import { PageHeader } from "@/components/nav/PageHeader";
import { DeleteRoundButton } from "@/components/rounds/DeleteRoundButton";
import { SESSION_TYPE_LABELS } from "@/lib/constants";
import { fmtVsPar } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function RoundsPage() {
  const [shots, rounds] = await Promise.all([getAllShots(), getAllRounds()]);
  const list = computeRoundList(shots, rounds);

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 p-4">
      <PageHeader title="Rounds" current="rounds" />

      {list.length === 0 ? (
        <p className="py-4 text-sm text-muted-foreground">
          No rounds yet. Start one with “New Round”.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {list.map((r) => (
            <li
              key={r.id}
              className="flex items-center gap-1 rounded-xl bg-card pr-2 ring-1 ring-foreground/10 transition-colors hover:bg-muted/50"
            >
              <Link
                href={`/rounds/${r.id}`}
                className="flex min-w-0 flex-1 items-center justify-between gap-4 px-4 py-3 text-sm"
              >
                <div className="min-w-0">
                  <div className="font-medium">{r.date}</div>
                  <div className="text-xs text-muted-foreground">
                    {SESSION_TYPE_LABELS[r.sessionType]}
                    {r.completeHoles > 0
                      ? ` · ${r.completeHoles} hole${r.completeHoles === 1 ? "" : "s"}`
                      : r.shotCount > 0
                        ? ` · ${r.shotCount} shot${r.shotCount === 1 ? "" : "s"} logged`
                        : " · no shots yet"}
                  </div>
                </div>
                <div className="shrink-0 text-right tabular-nums">
                  {r.completeHoles > 0 ? (
                    <>
                      <div className="font-medium">{r.strokes}</div>
                      <div className="text-xs text-muted-foreground">
                        {fmtVsPar(r.vsPar)}
                      </div>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">In progress</span>
                  )}
                </div>
              </Link>
              <DeleteRoundButton id={r.id} date={r.date} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
