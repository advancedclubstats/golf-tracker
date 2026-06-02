/**
 * Generic, column-driven table for the stats pages. Server Component, no
 * client JS. Each summary page supplies its own column definitions; formatting
 * lives in the column `cell` functions (using lib/format helpers).
 */

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface Column<T> {
  header: string;
  cell: (row: T) => ReactNode;
  align?: "left" | "right";
}

export function DataTable<T>({
  columns,
  rows,
  getKey,
  empty = "No data yet.",
}: {
  columns: Column<T>[];
  rows: T[];
  getKey: (row: T, index: number) => string | number;
  empty?: string;
}) {
  if (rows.length === 0) {
    return <p className="py-4 text-sm text-muted-foreground">{empty}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm tabular-nums">
        <thead>
          <tr className="text-xs text-muted-foreground">
            {columns.map((c) => (
              <th
                key={c.header}
                className={cn(
                  "whitespace-nowrap px-2 py-2 font-medium",
                  c.align === "right" ? "text-right" : "text-left",
                )}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border/40">
          {rows.map((row, ri) => (
            <tr key={getKey(row, ri)}>
              {columns.map((c) => (
                <td
                  key={c.header}
                  className={cn(
                    "whitespace-nowrap px-2 py-2",
                    c.align === "right" ? "text-right" : "text-left",
                  )}
                >
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
