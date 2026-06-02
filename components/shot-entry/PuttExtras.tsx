"use client";

import { PUTT_SIDES, PUTT_LENGTHS, type PuttSide, type PuttLength } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface PuttExtrasProps {
  puttSide: PuttSide | null;
  onPuttSideChange: (side: PuttSide | null) => void;
  puttLength: PuttLength | null;
  onPuttLengthChange: (length: PuttLength | null) => void;
}

function ChipRow<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  value: T | null;
  onChange: (v: T | null) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex gap-2">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(value === opt ? null : opt)}
            className={cn(
              "h-10 px-5 rounded-full text-sm font-medium transition-colors",
              value === opt
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-foreground hover:bg-muted/70 active:bg-muted/50"
            )}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
}

export function PuttExtras({
  puttSide,
  onPuttSideChange,
  puttLength,
  onPuttLengthChange,
}: PuttExtrasProps) {
  return (
    <div className="flex flex-col gap-3 rounded-lg bg-muted/40 p-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        Putt miss — material only
      </p>
      <ChipRow
        label="Side"
        options={PUTT_SIDES}
        value={puttSide}
        onChange={onPuttSideChange}
      />
      <ChipRow
        label="Length"
        options={PUTT_LENGTHS}
        value={puttLength}
        onChange={onPuttLengthChange}
      />
    </div>
  );
}
