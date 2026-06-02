"use client";

import { Controller, useForm } from "react-hook-form";
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

function todayString() {
  // Returns today's date as YYYY-MM-DD in the local timezone.
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function NewRoundForm() {
  const router = useRouter();

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RoundInsert>({
    resolver: zodResolver(RoundInsertSchema),
    defaultValues: {
      date: todayString(),
      session_type: "Full18",
      notes: "",
    },
  });

  async function onSubmit(data: RoundInsert) {
    try {
      const { id } = await createRound(data);
      router.push(`/rounds/${id}/log`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create round."
      );
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

      {/* Session type */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="session_type">Session</Label>
        {/* shadcn Select doesn't fire native change events, so use Controller */}
        <Controller
          name="session_type"
          control={control}
          render={({ field }) => (
            <Select
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
          <p className="text-sm text-destructive">
            {errors.session_type.message}
          </p>
        )}
      </div>

      {/* Notes */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="notes">
          Notes{" "}
          <span className="text-muted-foreground font-normal">(optional)</span>
        </Label>
        <Textarea
          id="notes"
          placeholder="Weather, course conditions, anything notable…"
          rows={3}
          className="text-base resize-none"
          {...register("notes")}
        />
        {errors.notes && (
          <p className="text-sm text-destructive">{errors.notes.message}</p>
        )}
      </div>

      <Button
        type="submit"
        disabled={isSubmitting}
        className="h-14 text-base font-semibold mt-2"
      >
        {isSubmitting ? "Starting round…" : "Start Round →"}
      </Button>
    </form>
  );
}
