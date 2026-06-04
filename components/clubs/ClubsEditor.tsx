"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { addClub, renameClub, deleteClub, reorderClubs } from "@/actions/clubs";

interface ClubEntry {
  id: string;
  name: string;
}

export function ClubsEditor({ initialClubs }: { initialClubs: ClubEntry[] }) {
  const [clubs, setClubs] = useState<ClubEntry[]>(initialClubs);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  async function run(fn: () => Promise<unknown>, errMsg: string) {
    try {
      await fn();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : errMsg);
    }
  }

  async function onAdd(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newName.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    try {
      const { id } = await addClub(trimmed);
      setClubs((c) => [...c, { id, name: trimmed }]);
      setNewName("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add club.");
    } finally {
      setBusy(false);
    }
  }

  function onRename(id: string, name: string) {
    const trimmed = name.trim();
    const current = clubs.find((c) => c.id === id);
    if (!trimmed || !current || trimmed === current.name) {
      // Revert empty edits to the stored value.
      setClubs((cs) => cs.map((c) => (c.id === id ? { ...c, name: current?.name ?? c.name } : c)));
      return;
    }
    setClubs((cs) => cs.map((c) => (c.id === id ? { ...c, name: trimmed } : c)));
    void run(() => renameClub(id, trimmed), "Failed to rename club.");
  }

  function onRemove(id: string, name: string) {
    if (!window.confirm(`Remove ${name} from your bag? Logged shots keep their data.`)) {
      return;
    }
    setClubs((cs) => cs.filter((c) => c.id !== id));
    void run(() => deleteClub(id), "Failed to remove club.");
  }

  function move(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= clubs.length) return;
    const next = [...clubs];
    [next[index], next[target]] = [next[target], next[index]];
    setClubs(next);
    void run(() => reorderClubs(next.map((c) => c.id)), "Failed to reorder clubs.");
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col gap-2">
        {clubs.map((c, i) => (
          <li
            key={c.id}
            className="flex items-center gap-2 rounded-xl bg-card px-3 py-2 ring-1 ring-foreground/10"
          >
            <div className="flex flex-col">
              <button
                type="button"
                aria-label={`Move ${c.name} up`}
                disabled={i === 0}
                onClick={() => move(i, -1)}
                className="h-4 leading-none text-muted-foreground transition-colors hover:text-foreground disabled:opacity-25"
              >
                ▲
              </button>
              <button
                type="button"
                aria-label={`Move ${c.name} down`}
                disabled={i === clubs.length - 1}
                onClick={() => move(i, 1)}
                className="h-4 leading-none text-muted-foreground transition-colors hover:text-foreground disabled:opacity-25"
              >
                ▼
              </button>
            </div>
            <Input
              defaultValue={c.name}
              onBlur={(e) => onRename(c.id, e.target.value)}
              aria-label={`Club ${i + 1} name`}
              className="h-9 flex-1 font-mono"
            />
            <button
              type="button"
              aria-label={`Remove ${c.name}`}
              onClick={() => onRemove(c.id, c.name)}
              className="px-2 text-muted-foreground transition-colors hover:text-destructive"
            >
              ✕
            </button>
          </li>
        ))}
        {clubs.length === 0 && (
          <p className="py-2 text-sm text-muted-foreground">
            Your bag is empty — add a club below.
          </p>
        )}
      </ul>

      <form onSubmit={onAdd} className="flex items-center gap-2">
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Add a club (e.g. 2i, 60°)"
          className="h-10"
        />
        <Button
          type="submit"
          disabled={!newName.trim() || busy}
          className={cn("h-10 shrink-0")}
        >
          Add club
        </Button>
      </form>

      <p className="text-xs text-muted-foreground">
        These are the clubs offered during shot entry. Removing one never changes
        already-logged shots.
      </p>
    </div>
  );
}
