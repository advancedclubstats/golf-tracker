"use client";

import { cn } from "@/lib/utils";

interface ClubSelectorProps {
  /** The user's bag, in order (from the Setup page). */
  clubs: string[];
  value: string | null;
  onChange: (club: string) => void;
}

function ClubButton({
  club,
  label,
  selected,
  onClick,
  className,
}: {
  club: string;
  label?: string;
  selected: boolean;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-lg font-medium transition-colors",
        selected
          ? "bg-primary text-primary-foreground"
          : "bg-muted text-foreground hover:bg-muted/70 active:bg-muted/50",
        className,
      )}
    >
      {label ?? club}
    </button>
  );
}

export function ClubSelector({ clubs, value, onChange }: ClubSelectorProps) {
  const hasDriver = clubs.includes("D");
  const hasPutter = clubs.includes("Putter");
  // Driver and Putter get prominent full-width rows; everything else (in bag
  // order) sits in the 3-up grid between them.
  const midClubs = clubs.filter((c) => c !== "D" && c !== "Putter");

  return (
    <div className="flex flex-col gap-2">
      {hasDriver && (
        <ClubButton
          club="D"
          label="Driver"
          selected={value === "D"}
          onClick={() => onChange("D")}
          className="h-14 w-full text-base font-semibold"
        />
      )}

      {midClubs.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {midClubs.map((club) => (
            <ClubButton
              key={club}
              club={club}
              selected={value === club}
              onClick={() => onChange(club)}
              className="h-12 text-sm"
            />
          ))}
        </div>
      )}

      {hasPutter && (
        <ClubButton
          club="Putter"
          selected={value === "Putter"}
          onClick={() => onChange("Putter")}
          className="h-14 w-full text-base font-semibold"
        />
      )}
    </div>
  );
}
