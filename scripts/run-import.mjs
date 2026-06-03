/**
 * Executes the sheet import against Supabase (clears existing data, then inserts
 * the parsed + corrected rounds and shots). Reads credentials from .env.local.
 *
 *   node scripts/run-import.mjs "<path-to-csv>"
 *
 * Idempotent: deletes all rounds/shots for the v1 user first, so re-running
 * replaces rather than duplicates.
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { buildImport, V1_USER_ID } from "./import-sheet.mjs";

// Minimal .env.local parser (no dotenv dependency).
function loadEnv() {
  const env = {};
  for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return env;
}

const csv = process.argv[2];
if (!csv) { console.error("usage: node scripts/run-import.mjs <csv>"); process.exit(1); }

const env = loadEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY || env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) { console.error("Missing Supabase URL/key in .env.local"); process.exit(1); }

const { rounds, shots, summary } = buildImport(csv);
console.log(`Validated ${shots.length} shots / ${rounds.length} rounds:`);
for (const s of summary) console.log(`  ${s.rid} → ${s.session} (${s.holes} holes)`);

const supabase = createClient(url, key, { auth: { persistSession: false } });

// Clear existing data (shots first — FK).
for (const table of ["shots", "rounds"]) {
  const { error } = await supabase.from(table).delete().eq("user_id", V1_USER_ID);
  if (error) { console.error(`Delete ${table} failed:`, error.message); process.exit(1); }
}
console.log("Cleared existing rounds + shots.");

const { error: rErr } = await supabase.from("rounds").insert(rounds);
if (rErr) { console.error("Insert rounds failed:", rErr.message); process.exit(1); }

const { error: sErr } = await supabase.from("shots").insert(shots);
if (sErr) { console.error("Insert shots failed:", sErr.message); process.exit(1); }

console.log(`✓ Imported ${rounds.length} rounds and ${shots.length} shots.`);
