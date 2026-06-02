"use client";

import { cn } from "@/lib/utils";

interface ExecutionButtonsProps {
  value: number | null;
  onChange: (execution: number) => void;
}

const RATINGS = [
  { n: 1, label: "Bad" },
  { n: 2, label: "Okay" },
  { n: 3, label: "Good" },
  { n: 4, label: "Great" },
] as const;

export function ExecutionButtons({ value, onChange }: ExecutionButtonsProps) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {RATINGS.map(({ n, label }) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          className={cn(
            "flex flex-col items-center justify-center h-16 rounded-lg transition-colors",
            value === n
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-foreground hover:bg-muted/70 active:bg-muted/50"
          )}
        >
          <span className="text-xl font-bold leading-none">{n}</span>
          <span className="text-xs mt-1 opacity-80">{label}</span>
        </button>
      ))}
    </div>
  );
}
