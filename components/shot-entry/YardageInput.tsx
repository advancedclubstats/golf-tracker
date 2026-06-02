"use client";

interface YardageInputProps {
  value: number | null;
  onChange: (yardage: number | null) => void;
}

export function YardageInput({ value, onChange }: YardageInputProps) {
  function adjust(delta: number) {
    onChange(Math.max(0, (value ?? 0) + delta));
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        aria-label="Decrease yardage"
        onClick={() => adjust(-1)}
        className="h-12 w-12 shrink-0 rounded-lg bg-muted text-xl font-bold flex items-center justify-center hover:bg-muted/70 active:bg-muted/50 transition-colors"
      >
        −
      </button>

      <input
        type="number"
        inputMode="numeric"
        min={0}
        value={value ?? ""}
        onChange={(e) => {
          const v = e.target.value;
          onChange(v === "" ? null : Math.max(0, Number(v)));
        }}
        placeholder="yds"
        className="flex-1 h-12 text-center text-lg font-semibold rounded-lg border border-input bg-background px-3 focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
      />

      <button
        type="button"
        aria-label="Increase yardage"
        onClick={() => adjust(1)}
        className="h-12 w-12 shrink-0 rounded-lg bg-muted text-xl font-bold flex items-center justify-center hover:bg-muted/70 active:bg-muted/50 transition-colors"
      >
        +
      </button>
    </div>
  );
}
