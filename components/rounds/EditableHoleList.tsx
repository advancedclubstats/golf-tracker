"use client";

import { Fragment, useState } from "react";
import {
  EditShotSheet,
  type InsertTarget,
} from "@/components/rounds/EditShotSheet";
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

/** A thin inline control to drop a shot in at a given position. */
function InsertRow({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-center gap-2 px-1.5 py-0.5 text-muted-foreground/45 transition-colors hover:text-foreground"
      aria-label="Insert a shot here"
    >
      <span className="h-px flex-1 bg-current opacity-40 transition-opacity group-hover:opacity-70" />
      <span className="font-mono text-[10px] uppercase tracking-wide">+ shot</span>
      <span className="h-px flex-1 bg-current opacity-40 transition-opacity group-hover:opacity-70" />
    </button>
  );
}

/** What a shot's result reads as in the list — on-green putts show "Green". */
function resultLabel(s: ShotRow): string {
  if (s.result) return s.result;
  // A putt with no explicit result is a putt taken on the green (it stays null
  // in the DB so putt/GIR analytics are correct — this is display only).
  if (s.club === "Putter") return "Green";
  return "—";
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
  const [insertAt, setInsertAt] = useState<InsertTarget | null>(null);

  function close() {
    setEditing(null);
    setInsertAt(null);
  }

  return (
    <>
      <ul className="flex flex-col gap-3">
        {holes.map((h) => {
          const lastShotNo = h.shots.reduce((m, s) => Math.max(m, s.shot_no), 0);
          return (
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
                  <Fragment key={s.id}>
                    <InsertRow
                      onClick={() =>
                        setInsertAt({ hole: h.hole, par: h.par, shotNo: s.shot_no })
                      }
                    />
                    <li>
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
                          {s.yardage != null
                            ? s.distance_unit === "ft"
                              ? ` · ${Math.round(s.yardage * 3)} ft`
                              : ` · ${s.yardage}y`
                            : ""}
                          {s.miss_direction ? ` · ${s.miss_direction}` : ""}
                          {s.penalty > 0 ? ` · +${s.penalty} pen` : ""}
                        </span>
                        <span className="shrink-0 text-right">
                          {resultLabel(s)}
                          {s.execution != null && (
                            <span className="ml-2 text-xs">exec {s.execution}</span>
                          )}
                        </span>
                      </button>
                    </li>
                  </Fragment>
                ))}
                {/* Append at the end of the hole. */}
                <InsertRow
                  onClick={() =>
                    setInsertAt({
                      hole: h.hole,
                      par: h.par,
                      shotNo: lastShotNo + 1,
                    })
                  }
                />
              </ol>
            </li>
          );
        })}
      </ul>

      <EditShotSheet
        shot={editing}
        insertAt={insertAt}
        roundId={roundId}
        clubs={clubs}
        onClose={close}
      />
    </>
  );
}
