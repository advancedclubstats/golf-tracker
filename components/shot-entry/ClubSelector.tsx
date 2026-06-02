"use client";

import { CLUBS, type Club } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface ClubSelectorProps {
  value: Club | null;
  onChange: (club: Club) => void;
}

// Mid-bag clubs shown in a 3-column grid between Driver and Putter.
const MID_CLUBS = CLUBS.filter((c) => c !== "D" && c !== "Putter");

function ClubButton({
  club,
  selected,
  onClick,
  className,
}: {
  club: string;
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
        className
      )}
    >
      {club}
    </button>
  );
}

export function ClubSelector({ value, onChange }: ClubSelectorProps) {
  return (
    <div className="flex flex-col gap-2">
      {/* Driver — full-width prominent */}
      <ClubButton
        club="Driver"
        selected={value === "D"}
        onClick={() => onChange("D")}
        className="h-14 w-full text-base font-semibold"
      />

      {/* Mid-bag — 3 per row */}
      <div className="grid grid-cols-3 gap-2">
        {MID_CLUBS.map((club) => (
          <ClubButton
            key={club}
            club={club}
            selected={value === club}
            onClick={() => onChange(club)}
            className="h-12 text-sm"
          />
        ))}
      </div>

      {/* Putter — full-width prominent */}
      <ClubButton
        club="Putter"
        selected={value === "Putter"}
        onClick={() => onChange("Putter")}
        className="h-14 w-full text-base font-semibold"
      />
    </div>
  );
}
