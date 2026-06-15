"use client";

/**
 * The Rounds browser list. The header row still navigates to the round detail;
 * a chevron expands an inline strokes-gained / stats breakdown so you can see
 * how a finished round moved your averages without leaving the list. In-progress
 * rounds (no complete holes) have no chevron.
 */

import { useState } from "react";
import Link from "next/link";
import { ChevronDownIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { DeleteRoundButton } from "@/components/rounds/DeleteRoundButton";
import { RoundChips } from "@/components/rounds/RoundChips";
import { fmtVsPar } from "@/lib/format";
import type { RoundBreakdown } from "@/lib/analytics/roundCard";

export interface RoundListRow {
  id: string;
  date: string;
  subLabel: string;
  complete: boolean;
  strokes: number;
  vsPar: number;
  breakdown: RoundBreakdown | null;
}

export function RoundsList({
  rounds,
  owner,
}: {
  rounds: RoundListRow[];
  owner: boolean;
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});

  return (
    <ul className="flex flex-col gap-2">
      {rounds.map((r) => {
        const expandable = r.breakdown != null;
        const isOpen = !!open[r.id];
        return (
          <li
            key={r.id}
            className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10"
          >
            <div className="flex items-center gap-1 pr-2 transition-colors hover:bg-muted/50">
              <Link
                href={`/rounds/${r.id}`}
                className="flex min-w-0 flex-1 items-center justify-between gap-4 px-4 py-3 text-sm"
              >
                <div className="min-w-0">
                  <div className="font-medium">{r.date}</div>
                  <div className="text-xs text-muted-foreground">{r.subLabel}</div>
                </div>
                <div className="shrink-0 text-right tabular-nums">
                  {r.complete ? (
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

              {expandable && (
                <button
                  type="button"
                  onClick={() => setOpen((o) => ({ ...o, [r.id]: !o[r.id] }))}
                  aria-expanded={isOpen}
                  aria-label={isOpen ? "Hide round breakdown" : "Show round breakdown"}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <ChevronDownIcon
                    className={cn("size-4 transition-transform", isOpen && "rotate-180")}
                  />
                </button>
              )}

              {owner && <DeleteRoundButton id={r.id} date={r.date} />}
            </div>

            {expandable && isOpen && (
              <div className="border-t border-foreground/10 px-4 py-3">
                <RoundChips breakdown={r.breakdown!} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
