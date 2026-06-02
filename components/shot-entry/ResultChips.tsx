"use client";

import { RESULTS, type Club, type Result } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface ResultChipsProps {
  // Passed through for context — used in Phase 4 (P4-T3) to reorder chips.
  club: Club | null;
  shotNo: number;
  par: number | null;
  value: Result | null;
  onChange: (result: Result | null) => void;
}

// TODO(P4-T3): Use club/shotNo/par to reorder and highlight chips contextually.
export function ResultChips({ value, onChange }: ResultChipsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {RESULTS.map((result) => (
        <button
          key={result}
          type="button"
          onClick={() => onChange(value === result ? null : result)}
          className={cn(
            "h-10 px-4 rounded-full text-sm font-medium transition-colors",
            value === result
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-foreground hover:bg-muted/70 active:bg-muted/50"
          )}
        >
          {result}
        </button>
      ))}
    </div>
  );
}
