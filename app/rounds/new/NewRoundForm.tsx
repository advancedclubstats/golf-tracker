"use client";

import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RoundInsertSchema, type RoundInsert } from "@/lib/schemas/round";
import {
  SESSION_TYPES,
  SESSION_TYPE_LABELS,
  type SessionType,
} from "@/lib/constants";
import { createRound } from "@/actions/rounds";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

function todayString() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function NewRoundForm({ courses }: { courses: CourseOption[] }) {
  const router = useRouter();

  const {
    register,
    control,
    setValue,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RoundInsert>({
    resolver: zodResolver(RoundInsertSchema),
    defaultValues: {
      date: todayString(),
      session_type: "Full18",
      notes: "",
      // Default to the only/first course so new rounds are course-aware.
      course_id: courses[0]?.id ?? null,
      tee_id: null,
    },
  });

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
    <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-6">
      {/* Date */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="date">Date</Label>
        <Input id="date" type="date" className="h-12 text-base" {...register("date")} />
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
                <SelectTrigger id="course_id" className="h-12 text-base">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {courses.map((c) => (
                    <SelectItem key={c.id} value={c.id} className="text-base">
                      {c.name}
                    </SelectItem>
                  ))}
                  <SelectItem value={NO_COURSE} className="text-base">
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
                <SelectTrigger id="tee_id" className="h-12 text-base">
                  <SelectValue placeholder="Select a tee" />
                </SelectTrigger>
                <SelectContent>
                  {tees.map((t) => (
                    <SelectItem key={t.id} value={t.id} className="text-base">
                      {t.name}
                    </SelectItem>
                  ))}
                  <SelectItem value={NO_COURSE} className="text-base">
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

      {/* Session type */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="session_type">Session</Label>
        {/* shadcn Select doesn't fire native change events, so use Controller */}
        <Controller
          name="session_type"
          control={control}
          render={({ field }) => (
            <Select
              items={SESSION_TYPE_LABELS}
              value={field.value}
              onValueChange={(v) => field.onChange(v as SessionType)}
            >
              <SelectTrigger id="session_type" className="h-12 text-base">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SESSION_TYPES.map((type) => (
                  <SelectItem key={type} value={type} className="text-base">
                    {SESSION_TYPE_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
        {errors.session_type && (
          <p className="text-sm text-destructive">{errors.session_type.message}</p>
        )}
      </div>

      {/* Notes */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="notes">
          Notes{" "}
          <span className="font-normal text-muted-foreground">(optional)</span>
        </Label>
        <Textarea
          id="notes"
          placeholder="Weather, course conditions, anything notable…"
          rows={3}
          className="resize-none text-base"
          {...register("notes")}
        />
        {errors.notes && (
          <p className="text-sm text-destructive">{errors.notes.message}</p>
        )}
      </div>

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
