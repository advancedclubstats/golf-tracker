"use client";

import { MISS_DIRECTIONS, type MissDirection } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface MissDirectionChipsProps {
  value: MissDirection | null;
  onChange: (dir: MissDirection | null) => void;
}

export function MissDirectionChips({ value, onChange }: MissDirectionChipsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {MISS_DIRECTIONS.map((dir) => (
        <button
          key={dir}
          type="button"
          onClick={() => onChange(value === dir ? null : dir)}
          className={cn(
            "h-10 px-4 rounded-full text-sm font-medium transition-colors",
            value === dir
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-foreground hover:bg-muted/70 active:bg-muted/50"
          )}
        >
          {dir}
        </button>
      ))}
    </div>
  );
}
