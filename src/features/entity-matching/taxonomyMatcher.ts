// Phase 4 — taxonomy reconciliation (dance styles + event types).
//
// Replaces the inline alias maps that previously lived in
// flyer-extraction/applyExtraction.ts. This module is the single canonical
// source of known taxonomy → slug mappings. Aliases are EXPLICIT and testable;
// we never invent mappings from AI output (per the Phase 4 brief).
//
// Specificity is preserved: a raw label such as "Bachata Sensual" maps to the
// canonical "bachata" slug while the original text remains available in
// `raw`, so the descriptive phrase can still be used in the event description.

import type { EventType } from "../events/model/types";
import type {
  EventTypeReconciliation,
  StyleReconciliation,
} from "./types";
import { normalizeName } from "./normalize";

/**
 * Known dance-style synonyms → canonical slug. Keys are normalized (lower-cased,
 * punctuation stripped) at match time. Only map a synonym when its meaning is
 * unambiguous for SalsaSegura's product behavior.
 */
export const DANCE_STYLE_ALIASES: Record<string, string> = {
  salsa: "salsa",
  "salsa dancing": "salsa",
  "salsa on1": "salsa",
  "salsa on2": "salsa",
  "salsa on1/on2": "salsa",
  "ny style salsa": "salsa",
  "new york salsa": "salsa",
  "new york style salsa": "salsa",
  mambo: "salsa",
  "cuban salsa": "salsa",
  casino: "salsa",
  bachata: "bachata",
  "bachata dancing": "bachata",
  "bachata sensual": "bachata",
  "dominican bachata": "bachata",
  "bachata moderna": "bachata",
  merengue: "merengue",
  "cha-cha": "cha-cha",
  "cha cha": "cha-cha",
  chacha: "cha-cha",
  "cha cha cha": "cha-cha",
  kizomba: "kizomba",
  "urban kiz": "kizomba",
  "urban kizomba": "kizomba",
  zouk: "zouk",
  "brazilian zouk": "zouk",
  "afro-cuban": "afro-cuban",
  "afro cuban": "afro-cuban",
};

/** Known event-type synonyms → canonical EventType slug. */
export const EVENT_TYPE_ALIASES: Record<string, EventType> = {
  social: "social",
  "social dance": "social",
  "social dancing": "social",
  "dance social": "social",
  "party": "social",
  "dance party": "social",
  class: "class",
  lesson: "class",
  "dance class": "class",
  "group class": "class",
  workshop: "workshop",
  "bootcamp": "workshop",
};

export interface TaxonomyMatcherOptions {
  /** Slugs known to exist in taxonomy_terms (active). Unknown aliases are kept. */
  knownDanceStyleSlugs?: string[];
  /** Event types the product supports. */
  knownEventTypes?: string[];
}

/**
 * Reconcile a list of free-form dance-style labels.
 *  - exact known slug (normalized)            → that slug
 *  - explicit alias                            → mapped slug
 *  - supported slug already in knownDanceStyleSlugs (when provided) → kept
 *  - anything else                             → slug = null (unresolved)
 * Duplicates (same resolved slug) are de-duplicated. The original `raw` text is
 * always preserved so descriptive nuance survives.
 */
export function reconcileDanceStyles(
  labels: string[],
  options: TaxonomyMatcherOptions = {}
): StyleReconciliation[] {
  const known = options.knownDanceStyleSlugs
    ? new Set(options.knownDanceStyleSlugs.map((s) => s.toLowerCase()))
    : null;

  const seen = new Set<string>();
  const out: StyleReconciliation[] = [];

  for (const raw of labels) {
    const norm = normalizeName(raw);
    if (!norm) continue;
    if (seen.has(norm)) continue; // de-dup by normalized raw text

    let slug: string | null = DANCE_STYLE_ALIASES[norm] ?? null;

    // Allow exact slug equality (e.g. "Salsa" === "salsa") when it is a known
    // taxonomy slug, even if absent from the alias map.
    if (!slug && known && known.has(norm)) {
      slug = norm;
    }

    // A mapped alias must point at a known slug when a known-set is supplied.
    if (slug && known && !known.has(slug)) {
      slug = null;
    }

    seen.add(norm);
    out.push({ raw, slug });
  }

  return out;
}

/**
 * Reconcile a single free-form event-type label.
 *  - exact EventType ("social"|"class"|"workshop") → that type
 *  - explicit alias                                  → mapped type
 *  - unsupported label (e.g. "festival")            → null (NOT forced into social)
 * The raw label is preserved for the description tail.
 */
export function reconcileEventType(
  raw: string | null,
  options: TaxonomyMatcherOptions = {}
): EventTypeReconciliation {
  if (!raw) return { raw: null, slug: null };
  const norm = normalizeName(raw);
  if (!norm) return { raw, slug: null };

  const allowed = options.knownEventTypes
    ? new Set(options.knownEventTypes.map((t) => t.toLowerCase()))
    : null;

  let slug: EventType | null = EVENT_TYPE_ALIASES[norm] ?? null;
  if (!slug && (norm === "social" || norm === "class" || norm === "workshop")) {
    slug = norm as EventType;
  }

  if (slug && allowed && !allowed.has(slug)) {
    slug = null;
  }

  return { raw, slug };
}
