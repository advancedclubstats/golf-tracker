"use client";

import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Popover } from "@base-ui/react/popover";
import { CalendarIcon, ChevronDownIcon, FlagIcon, MapPinIcon, PlusIcon } from "lucide-react";
import {
  RoundInsertSchema,
  type RoundInsert,
  type RoundInsertInput,
} from "@/lib/schemas/round";
import { createRound } from "@/actions/rounds";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/** A course the round can be played on, with its tees. */
export interface CourseOption {
  id: string;
  name: string;
  tees: { id: string; name: string }[];
}

const NO_COURSE = "none";

/** Shared field-card style — full-width 56px white card with a hairline border,
 *  matching the New Round mockup. Course / Tee / Starting hole triggers use this
 *  (flex row: leading icon · value · chevron). */
const FIELD =
  "flex min-h-14 w-full items-center gap-3 rounded-xl border-[1.5px] border-input bg-card px-4 text-base text-foreground shadow-sm transition-colors hover:border-ink-300";

/** Card surface for the multi-line notes <textarea> (non-flex block control). */
const FIELD_INPUT =
  "min-h-14 w-full rounded-xl border-[1.5px] border-input bg-card px-4 text-base text-foreground shadow-sm transition-colors hover:border-ink-300";

function todayString() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Starting-hole control (D-13): a field that opens a popover with a 1–18 grid.
 *  Matches the New Round mockup — collapsed "Hole N" trigger, tap-to-pick grid. */
function StartingHolePicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (hole: number) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        render={
          <button
            type="button"
            id="starting_hole"
            className={cn(
              FIELD,
              "justify-between data-[popup-open]:border-ring data-[popup-open]:ring-4 data-[popup-open]:ring-ring/15",
            )}
          />
        }
      >
        <span className="flex items-center gap-3">
          <MapPinIcon className="size-5 text-muted-foreground" />
          <span>Hole {value}</span>
        </span>
        <ChevronDownIcon
          className={cn(
            "size-5 text-muted-foreground transition-transform",
            open && "rotate-180 text-primary",
          )}
        />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner
          sideOffset={8}
          align="center"
          className="z-50 w-[var(--anchor-width)]"
        >
          <Popover.Popup className="rounded-xl border-[1.5px] border-input bg-popover p-2 shadow-lg outline-none">
            <div
              role="radiogroup"
              aria-label="Starting hole"
              className="grid grid-cols-6 gap-1.5 p-1"
            >
              {Array.from({ length: 18 }, (_, i) => i + 1).map((h) => {
                const selected = value === h;
                return (
                  <button
                    key={h}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    onClick={() => {
                      onChange(h);
                      setOpen(false);
                    }}
                    className={cn(
                      "flex aspect-square items-center justify-center rounded-lg border-[1.5px] font-mono text-base font-semibold tabular-nums transition-transform active:scale-95",
                      selected
                        ? "border-primary bg-primary text-primary-foreground shadow-sm"
                        : "border-input bg-card text-ink-700 hover:border-ink-300",
                    )}
                  >
                    {h}
                  </button>
                );
              })}
            </div>
            <p className="px-2 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-300">
              Tap the hole you tee off on
            </p>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function NewRoundForm({ courses }: { courses: CourseOption[] }) {
  const router = useRouter();

  const {
    register,
    control,
    setValue,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RoundInsertInput, unknown, RoundInsert>({
    resolver: zodResolver(RoundInsertSchema),
    defaultValues: {
      date: todayString(),
      // D-13/Option A: session_type is no longer asked. Write it silently so the
      // column and every existing reader (rounds list, log fallback) keep working.
      session_type: "Full18",
      starting_hole: 1,
      notes: "",
      // Default to the only/first course so new rounds are course-aware.
      course_id: courses[0]?.id ?? null,
      // Default the tee to "Blue" (falling back to the first tee, then none).
      tee_id:
        courses[0]?.tees.find((t) => t.name === "Blue")?.id ??
        courses[0]?.tees[0]?.id ??
        null,
    },
  });

  // Notes is collapsed by default — it's almost never used, so it stays out of
  // the way behind a "+ Add a note" toggle.
  const [notesOpen, setNotesOpen] = useState(false);

  const selectedCourseId = useWatch({ control, name: "course_id" });
  const selectedCourse = courses.find((c) => c.id === selectedCourseId);
  const tees = selectedCourse?.tees ?? [];

  // value → label maps so the Select trigger shows names, not raw values/UUIDs.
  const courseItems: Record<string, string> = {
    ...Object.fromEntries(courses.map((c) => [c.id, c.name])),
    [NO_COURSE]: "No course",
  };
  const teeItems: Record<string, string> = {
    ...Object.fromEntries(tees.map((t) => [t.id, t.name])),
    [NO_COURSE]: "No tee",
  };

  async function onSubmit(data: RoundInsert) {
    try {
      const { id } = await createRound(data);
      router.push(`/rounds/${id}/log`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create round.");
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
      {/* Date — a bare native date input inside the shared flex card (same
          pattern as Course/Tee). The input carries no border/background/padding
          and `min-w-0`, so it flexes to fit the card and can't overflow on iOS
          WebKit. (The old full-width input + left padding overflowed there: the
          native control doesn't honor box-sizing, and a flex child without
          min-w-0 won't shrink below its intrinsic width.) */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="date">Date</Label>
        <div
          className={cn(
            FIELD,
            "focus-within:border-ring focus-within:ring-4 focus-within:ring-ring/15",
          )}
        >
          <CalendarIcon className="size-5 shrink-0 text-muted-foreground" />
          <input
            id="date"
            type="date"
            className="min-w-0 flex-1 bg-transparent text-base text-foreground outline-none"
            {...register("date")}
          />
        </div>
        {errors.date && (
          <p className="text-sm text-destructive">{errors.date.message}</p>
        )}
      </div>

      {/* Course */}
      {courses.length > 0 && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="course_id">Course</Label>
          <Controller
            name="course_id"
            control={control}
            render={({ field }) => (
              <Select
                items={courseItems}
                value={field.value ?? NO_COURSE}
                onValueChange={(v) => {
                  field.onChange(v === NO_COURSE ? null : v);
                  setValue("tee_id", null); // reset tee when course changes
                }}
              >
                <SelectTrigger id="course_id" className={cn(FIELD, "justify-between")}>
                  <span className="flex items-center gap-3">
                    <FlagIcon className="size-5 text-muted-foreground" />
                    <SelectValue />
                  </span>
                </SelectTrigger>
                <SelectContent align="start" alignItemWithTrigger={false} className="p-1">
                  {courses.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="py-2.5 pl-3 text-base">
                      {c.name}
                    </SelectItem>
                  ))}
                  <SelectItem value={NO_COURSE} className="py-2.5 pl-3 text-base">
                    No course
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
      )}

      {/* Tee — only when the selected course has tees set up */}
      {tees.length > 0 ? (
        <div className="flex flex-col gap-2">
          <Label htmlFor="tee_id">Tee</Label>
          <Controller
            name="tee_id"
            control={control}
            render={({ field }) => (
              <Select
                items={teeItems}
                value={field.value ?? NO_COURSE}
                onValueChange={(v) => field.onChange(v === NO_COURSE ? null : v)}
              >
                <SelectTrigger id="tee_id" className={cn(FIELD, "justify-between")}>
                  <SelectValue placeholder="Select a tee" />
                </SelectTrigger>
                <SelectContent align="start" alignItemWithTrigger={false} className="p-1">
                  {tees.map((t) => (
                    <SelectItem key={t.id} value={t.id} className="py-2.5 pl-3 text-base">
                      {t.name}
                    </SelectItem>
                  ))}
                  <SelectItem value={NO_COURSE} className="py-2.5 pl-3 text-base">
                    No tee
                  </SelectItem>
                </SelectContent>
              </Select>
            )}
          />
        </div>
      ) : (
        selectedCourse && (
          <p className="text-xs text-muted-foreground">
            No tees set up for {selectedCourse.name} yet — add them in course settings.
          </p>
        )
      )}

      {/* Starting hole — popover with a 1–18 grid (D-13). Seeds the opening hole
          in the log so shotgun / mid-course starts open on the right hole. */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="starting_hole">Starting hole</Label>
        <Controller
          name="starting_hole"
          control={control}
          render={({ field }) => (
            <StartingHolePicker
              value={typeof field.value === "number" ? field.value : 1}
              onChange={field.onChange}
            />
          )}
        />
        {errors.starting_hole && (
          <p className="text-sm text-destructive">
            {errors.starting_hole.message}
          </p>
        )}
      </div>

      {/* Notes — collapsed by default (rarely used); reveal on demand. */}
      {!notesOpen ? (
        <button
          type="button"
          onClick={() => setNotesOpen(true)}
          className="flex items-center gap-2 self-start text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          <PlusIcon className="size-4" />
          Add a note
        </button>
      ) : (
        <div className="flex flex-col gap-2">
          <Label htmlFor="notes">
            Notes{" "}
            <span className="font-normal text-muted-foreground">(optional)</span>
          </Label>
          <Textarea
            id="notes"
            autoFocus
            placeholder="Weather, course conditions, anything notable…"
            rows={3}
            className={cn(FIELD_INPUT, "min-h-28 resize-none py-3")}
            {...register("notes")}
          />
          {errors.notes && (
            <p className="text-sm text-destructive">{errors.notes.message}</p>
          )}
        </div>
      )}

      <Button
        type="submit"
        disabled={isSubmitting}
        className="mt-2 h-14 text-base font-semibold"
      >
        {isSubmitting ? "Starting round…" : "Start Round →"}
      </Button>
    </form>
  );
}
