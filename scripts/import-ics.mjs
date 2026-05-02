#!/usr/bin/env node
/**
 * One-shot importer: scrape golatindance.com ICS feeds → Supabase events table.
 *
 * Usage:
 *   node scripts/import-ics.mjs            # dry run, prints what it would insert
 *   node scripts/import-ics.mjs --insert   # actually inserts as status=pending
 *
 * Reads VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY from .env (or .env.local).
 *
 * Dedup: best-effort, matches existing rows by (title, event_date) tuple. If
 * RLS blocks reading non-approved rows the dedup is a no-op — re-runs may
 * insert duplicates. Run once per import cycle.
 */

import { readFileSync, existsSync } from "node:fs";
import ICAL from "ical.js";
import { createClient } from "@supabase/supabase-js";

const FEEDS = {
  boston:
    "https://golatindance.com/events/category/boston/?post_type=tribe_events&ical=1&eventDisplay=list",
  "new-york-city":
    "https://golatindance.com/events/category/new-york-city/?post_type=tribe_events&ical=1&eventDisplay=list",
};

const SOURCE_TAG = "ICS import (golatindance.com)";
const DO_INSERT = process.argv.includes("--insert");

// --- Read .env (preferring .env.local) without adding a dotenv dep
function loadEnv() {
  const file = existsSync(".env.local")
    ? ".env.local"
    : existsSync(".env")
      ? ".env"
      : null;
  if (!file) return {};
  const out = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
    if (!m) continue;
    out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

const env = { ...loadEnv(), ...process.env };
const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_KEY = env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error(
    "Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY (checked .env.local, .env, and process env)"
  );
  process.exit(1);
}

// --- Mapping helpers
function inferEventType(title) {
  const t = title.toLowerCase();
  if (/\b(workshop|bootcamp|intensive)\b/.test(t)) return "workshop";
  if (/\b(class|lesson|crash course)\b/.test(t)) return "class";
  return "social";
}

function readString(vevent, name) {
  const v = vevent.getFirstPropertyValue(name);
  if (v === null || v === undefined) return null;
  return typeof v === "string" ? v : String(v);
}

function splitVenueAndAddress(loc) {
  if (!loc) return { location: null, address: null };
  const parts = loc.split(",").map((s) => s.trim());
  if (parts.length <= 1) return { location: null, address: loc };
  return { location: parts[0], address: parts.slice(1).join(", ") };
}

function veventToRow(vevent, city) {
  const ev = new ICAL.Event(vevent);
  const startIso = ev.startDate.toJSDate().toISOString();
  const title = ev.summary || "Untitled event";
  const { location, address } = splitVenueAndAddress(readString(vevent, "location"));

  return {
    title,
    description: readString(vevent, "description"),
    event_type: inferEventType(title),
    city,
    event_date: startIso,
    event_time: null,
    location,
    address,
    price_type: null,
    price_amount: null,
    rsvp_link: readString(vevent, "url"),
    image_url: readString(vevent, "attach"),
    status: "pending",
    submitter_name: SOURCE_TAG,
    submitter_email: `${city}@import.local`,
  };
}

// --- Fetch + parse one feed
async function fetchFeed(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Feed ${url} → HTTP ${r.status}`);
  const text = await r.text();
  const comp = new ICAL.Component(ICAL.parse(text));
  return comp.getAllSubcomponents("vevent");
}

// --- Main
async function main() {
  console.log(DO_INSERT ? "Mode: INSERT" : "Mode: DRY RUN (pass --insert to write)");

  const rows = [];
  for (const [city, url] of Object.entries(FEEDS)) {
    process.stdout.write(`Fetching ${city}... `);
    const vevents = await fetchFeed(url);
    console.log(`${vevents.length} events`);
    for (const v of vevents) rows.push(veventToRow(v, city));
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // Best-effort dedup
  const { data: existing, error: readErr } = await supabase
    .from("events")
    .select("title, event_date");

  if (readErr) {
    console.warn(`(dedup read failed: ${readErr.message} — proceeding without dedup)`);
  }

  const seen = new Set(
    (existing ?? []).map((e) => `${e.title}|${e.event_date}`)
  );
  const toInsert = rows.filter(
    (r) => !seen.has(`${r.title}|${r.event_date}`)
  );

  console.log(`\nFetched ${rows.length} total`);
  console.log(`Already in Supabase: ${rows.length - toInsert.length}`);
  console.log(`To insert: ${toInsert.length}`);

  if (toInsert.length === 0) {
    console.log("Nothing to do.");
    return;
  }

  if (!DO_INSERT) {
    console.log("\n--- Sample (first 2) ---");
    console.log(JSON.stringify(toInsert.slice(0, 2), null, 2));
    console.log(`\nDry run complete. Re-run with --insert to write ${toInsert.length} rows.`);
    return;
  }

  console.log("\nInserting (status=pending)...");
  const { data, error } = await supabase
    .from("events")
    .insert(toInsert)
    .select("id");

  if (error) {
    console.error("Insert failed:", error.message);
    process.exit(1);
  }
  console.log(`✓ Inserted ${data.length} rows.`);
  console.log("Review them in Supabase and flip status='approved' to publish.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
