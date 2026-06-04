"use client";

import { useState } from "react";
import { EditShotSheet } from "@/components/rounds/EditShotSheet";
import { fmtVsPar } from "@/lib/format";
import type { ShotRow } from "@/lib/schemas/shot";

/** A hole's shots plus its computed score (null while in progress). */
export interface HoleView {
  hole: number;
  par: number;
  complete: boolean;
  conceded: boolean;
  strokes: number | null;
  shots: ShotRow[];
}

export function EditableHoleList({
  roundId,
  clubs,
  holes,
}: {
  roundId: string;
  clubs: string[];
  holes: HoleView[];
}) {
  const [editing, setEditing] = useState<ShotRow | null>(null);

  return (
    <>
      <ul className="flex flex-col gap-3">
        {holes.map((h) => (
          <li
            key={h.hole}
            className="rounded-xl bg-card p-4 text-sm ring-1 ring-foreground/10"
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="font-medium">
                Hole {h.hole}{" "}
                <span className="text-muted-foreground">· par {h.par}</span>
              </span>
              {h.complete && h.strokes !== null ? (
                <span className="tabular-nums">
                  {h.strokes}{" "}
                  <span className="text-muted-foreground">
                    ({fmtVsPar(h.strokes - h.par)})
                  </span>
                </span>
              ) : h.conceded ? (
                <span className="text-xs text-muted-foreground">Picked up</span>
              ) : (
                <span className="text-xs text-muted-foreground">In progress</span>
              )}
            </div>
            <ol className="flex flex-col gap-0.5">
              {h.shots.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => setEditing(s)}
                    className="flex w-full items-baseline justify-between gap-3 rounded-md px-1.5 py-1.5 text-left text-muted-foreground transition-colors hover:bg-muted/60"
                  >
                    <span>
                      <span className="tabular-nums text-foreground">
                        {s.shot_no}.
                      </span>{" "}
                      <span className="text-foreground">{s.club}</span>
                      {s.yardage != null ? ` · ${s.yardage}y` : ""}
                      {s.miss_direction ? ` · ${s.miss_direction}` : ""}
                      {s.penalty > 0 ? ` · +${s.penalty} pen` : ""}
                    </span>
                    <span className="shrink-0 text-right">
                      {s.result ?? "—"}
                      {s.execution != null && (
                        <span className="ml-2 text-xs">exec {s.execution}</span>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          </li>
        ))}
      </ul>

      <EditShotSheet
        shot={editing}
        roundId={roundId}
        clubs={clubs}
        onClose={() => setEditing(null)}
      />
    </>
  );
}
