// Phase 4 — canonical organizer matcher.
//
// "Organizer" in SalsaSegura is the `organizers` brand table (NOT a user
// account). An extracted name like "Salsa y Control" must NEVER be attached to
// a user_id; we only ever resolve to an organizer brand id, and only when a
// reliable signal exists.
//
// Reliable signal priority (deterministic, strongest first):
//   1. exact normalized Instagram handle        (strong)
//   2. exact normalized website domain          (strong)
//   3. exact normalized name (+ single candidate) (strong)
//
// Weak name-only matches against ambiguous names (multiple candidates) are
// returned as "ambiguous" and never auto-applied. We do NOT fabricate an id.

import type { OrganizerCandidate, OrganizerMatch } from "./types";
import { normalizeDomain, normalizeInstagramHandle, normalizeName } from "./normalize";

const DEFAULT_ALLOWED_STATUSES = new Set(["active"]);

export interface OrganizerMatchOptions {
  allowedStatuses?: Set<string>;
}

export function matchOrganizer(
  extracted: {
    organizer_name: string | null;
    instagram: string | null;
    website: string | null;
  },
  candidates: OrganizerCandidate[],
  options: OrganizerMatchOptions = {}
): OrganizerMatch {
  const allowed = options.allowedStatuses ?? DEFAULT_ALLOWED_STATUSES;

  const normHandle = normalizeInstagramHandle(extracted.instagram);
  const normDomain = normalizeDomain(extracted.website);
  const normName = normalizeName(extracted.organizer_name);

  const eligible = candidates.filter((c) => allowed.has(c.status));

  // ── Instagram exact match (strongest) ──
  if (normHandle) {
    const byHandle = eligible.filter(
      (c) => normalizeInstagramHandle(c.instagram) === normHandle
    );
    if (byHandle.length >= 1) {
      const best = byHandle[0];
      return {
        status: "strong",
        organizer_id: best.id,
        name: best.name,
        matched_on: ["instagram"],
      };
    }
  }

  // ── Website domain exact match ──
  if (normDomain) {
    const byDomain = eligible.filter((c) => normalizeDomain(c.website) === normDomain);
    if (byDomain.length >= 1) {
      const best = byDomain[0];
      return {
        status: "strong",
        organizer_id: best.id,
        name: best.name,
        matched_on: ["website"],
      };
    }
  }

  // ── Name match ──
  if (!normName) {
    return { status: "none" };
  }

  const byName = eligible.filter((c) => normalizeName(c.name) === normName);
  if (byName.length === 1) {
    const best = byName[0];
    return {
      status: "strong",
      organizer_id: best.id,
      name: best.name,
      matched_on: ["name"],
    };
  }

  if (byName.length > 1) {
    // Ambiguous brand name — e.g. "Latin Dance Boston" could be several pages.
    return {
      status: "ambiguous",
      candidates: byName.map((c) => ({ id: c.id, name: c.name })),
    };
  }

  return { status: "none" };
}
