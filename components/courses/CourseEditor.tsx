"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { PRESET_TEE_COLORS } from "@/lib/constants";
import {
  renameCourse,
  setHolePar,
  addTee,
  deleteTee,
  setTeeYardage,
} from "@/actions/courses";

interface HoleEntry {
  hole: number;
  par: number;
}
interface TeeEntry {
  id: string;
  name: string;
  color: string | null;
}
interface YardageEntry {
  teeId: string;
  hole: number;
  yardage: number;
}

interface CourseEditorProps {
  courseId: string;
  initialName: string;
  holes: HoleEntry[];
  tees: TeeEntry[];
  yardages: YardageEntry[];
}

const yardKey = (teeId: string, hole: number) => `${teeId}:${hole}`;

export function CourseEditor({
  courseId,
  initialName,
  holes,
  tees: initialTees,
  yardages,
}: CourseEditorProps) {
  const holeNumbers = holes.map((h) => h.hole).sort((a, b) => a - b);

  const [name, setName] = useState(initialName);
  const [tees, setTees] = useState<TeeEntry[]>(initialTees);
  const [pars, setPars] = useState<Record<number, number>>(
    Object.fromEntries(holes.map((h) => [h.hole, h.par])),
  );
  // Raw input strings keyed by tee:hole (empty string = no yardage).
  const [yards, setYards] = useState<Record<string, string>>(
    Object.fromEntries(yardages.map((y) => [yardKey(y.teeId, y.hole), String(y.yardage)])),
  );

  // New-tee form state.
  const [newTeeName, setNewTeeName] = useState("");
  const [newTeeColor, setNewTeeColor] = useState<string>(PRESET_TEE_COLORS[0].hex);

  async function run(fn: () => Promise<unknown>, errMsg: string) {
    try {
      await fn();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : errMsg);
    }
  }

  function onNameBlur() {
    const trimmed = name.trim();
    if (trimmed && trimmed !== initialName) {
      void run(() => renameCourse(courseId, trimmed), "Failed to rename course.");
    }
  }

  function onParChange(hole: number, par: number) {
    setPars((p) => ({ ...p, [hole]: par }));
    void run(() => setHolePar(courseId, hole, par), "Failed to set par.");
  }

  async function onAddTee(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newTeeName.trim();
    if (!trimmed) return;
    try {
      const { id } = await addTee(courseId, trimmed, newTeeColor, tees.length);
      setTees((t) => [...t, { id, name: trimmed, color: newTeeColor }]);
      setNewTeeName("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add tee.");
    }
  }

  function onRemoveTee(teeId: string) {
    if (!window.confirm("Remove this tee and its yardages?")) return;
    setTees((t) => t.filter((x) => x.id !== teeId));
    setYards((y) => {
      const next = { ...y };
      for (const k of Object.keys(next)) if (k.startsWith(`${teeId}:`)) delete next[k];
      return next;
    });
    void run(() => deleteTee(teeId, courseId), "Failed to remove tee.");
  }

  function onYardageBlur(teeId: string, hole: number) {
    const key = yardKey(teeId, hole);
    const raw = (yards[key] ?? "").trim();
    const parsed = raw === "" ? null : parseInt(raw, 10);
    const value = parsed != null && Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    // Normalise the displayed value.
    setYards((y) => ({ ...y, [key]: value == null ? "" : String(value) }));
    void run(
      () => setTeeYardage(teeId, courseId, hole, value),
      "Failed to save yardage.",
    );
  }

  const totalPar = holeNumbers.reduce((s, h) => s + (pars[h] ?? 0), 0);
  const teeTotal = (teeId: string) =>
    holeNumbers.reduce((s, h) => {
      const v = parseInt(yards[yardKey(teeId, h)] ?? "", 10);
      return s + (Number.isFinite(v) ? v : 0);
    }, 0);

  return (
    <div className="flex flex-col gap-6">
      {/* Course name */}
      <div className="flex flex-col gap-2">
        <Label htmlFor="course-name">Course name</Label>
        <Input
          id="course-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={onNameBlur}
          className="h-11 text-base"
        />
      </div>

      {/* Tees */}
      <div className="flex flex-col gap-2">
        <Label>Tees</Label>
        {tees.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {tees.map((t) => (
              <span
                key={t.id}
                className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-sm"
              >
                <span
                  className="size-3 rounded-full ring-1 ring-foreground/20"
                  style={{ backgroundColor: t.color ?? "transparent" }}
                />
                {t.name}
                <button
                  type="button"
                  aria-label={`Remove ${t.name} tee`}
                  onClick={() => onRemoveTee(t.id)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  ✕
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No tees yet.</p>
        )}
        <form onSubmit={onAddTee} className="mt-1 flex flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {PRESET_TEE_COLORS.map((c) => (
              <button
                key={c.hex}
                type="button"
                aria-label={c.name}
                title={c.name}
                onClick={() => {
                  setNewTeeColor(c.hex);
                  if (!newTeeName.trim()) setNewTeeName(c.name);
                }}
                style={{ backgroundColor: c.hex }}
                className={cn(
                  "size-7 shrink-0 rounded-full ring-offset-1 ring-offset-background transition-all",
                  newTeeColor === c.hex
                    ? "ring-2 ring-foreground"
                    : "ring-1 ring-foreground/20",
                )}
              />
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Input
              value={newTeeName}
              onChange={(e) => setNewTeeName(e.target.value)}
              placeholder="Tee name (e.g. Blue)"
              className="h-10"
            />
            <Button type="submit" disabled={!newTeeName.trim()} className="h-10 shrink-0">
              Add tee
            </Button>
          </div>
        </form>
      </div>

      {/* Par + yardage grid */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm tabular-nums">
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th className="px-2 py-2 text-left font-medium">Hole</th>
              <th className="px-2 py-2 text-left font-medium">Par</th>
              {tees.map((t) => (
                <th key={t.id} className="px-2 py-2 text-right font-medium">
                  {t.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {holeNumbers.map((h) => (
              <tr key={h}>
                <td className="px-2 py-1.5">{h}</td>
                <td className="px-2 py-1.5">
                  <select
                    value={pars[h]}
                    onChange={(e) => onParChange(h, Number(e.target.value))}
                    className="h-8 rounded-md border border-input bg-background px-1 text-sm"
                  >
                    {[3, 4, 5].map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </td>
                {tees.map((t) => {
                  const key = yardKey(t.id, h);
                  return (
                    <td key={t.id} className="px-2 py-1.5 text-right">
                      <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        value={yards[key] ?? ""}
                        onChange={(e) =>
                          setYards((y) => ({ ...y, [key]: e.target.value }))
                        }
                        onBlur={() => onYardageBlur(t.id, h)}
                        placeholder="—"
                        className="h-8 w-16 rounded-md border border-input bg-background px-2 text-right text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-border font-medium">
              <td className="px-2 py-2">Total</td>
              <td className="px-2 py-2">{totalPar}</td>
              {tees.map((t) => (
                <td key={t.id} className="px-2 py-2 text-right">
                  {teeTotal(t.id) || "—"}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="text-xs text-muted-foreground">
        Changes save automatically. Yardages are optional — leave a cell blank if
        you don&apos;t know it.
      </p>
    </div>
  );
}
