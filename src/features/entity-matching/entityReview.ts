import type { ExtractedEvent } from "../flyer-extraction/types";

/**
 * Flyer-to-entity review model. Pure and DOM/network-free: the flyer produces
 * *candidates*, the backend RPC `reconcile_flyer_entities` is the only matcher
 * (there is deliberately no local matching here), and the user resolves each
 * item into a decision before anything canonical is written.
 */

export type EntityKind = "venue" | "organizer" | "instructor" | "school";

export const ENTITY_KINDS: readonly EntityKind[] = ["venue", "organizer", "instructor", "school"];

export type EntityCandidate = {
  name: string;
  address?: string | null;
  city?: string | null;
  state_region?: string | null;
  country?: string | null;
  website?: string | null;
  instagram?: string | null;
  email?: string | null;
  phone?: string | null;
  organization?: string | null;
};

export type EntityMatch = {
  id: string;
  name: string;
  address?: string | null;
  city?: string | null;
  state_region?: string | null;
  website?: string | null;
  instagram?: string | null;
};

export type EntityReviewState = "MATCHED" | "POSSIBLE MATCH" | "NEW" | "NEEDS REVIEW";
export type EntityReviewDecision = "pending" | "existing" | "new" | "removed";

export type EntityReviewItem = {
  candidate: EntityCandidate;
  state: EntityReviewState;
  matches: EntityMatch[];
  decision: EntityReviewDecision;
  selected_id: string | null;
  explicit?: boolean;
  moderator_confirmed?: boolean;
  /** Client-only origin for an edited instructor across repeat extractions. */
  extraction_candidate?: EntityCandidate | null;
};

export type EntityReview = {
  venue: EntityReviewItem | null;
  organizer: EntityReviewItem | null;
  instructors: EntityReviewItem[];
  school: EntityReviewItem | null;
};

export type EntityCandidates = {
  venue: EntityCandidate | null;
  organizer: EntityCandidate | null;
  instructors: EntityCandidate[];
  school: EntityCandidate | null;
};

export const MAX_REVIEW_INSTRUCTORS = 10;
export const MAX_ENTITY_MATCHES = 25;

const REVIEW_STATES: readonly string[] = ["MATCHED", "POSSIBLE MATCH", "NEW", "NEEDS REVIEW"];
const REVIEW_DECISIONS: readonly string[] = ["pending", "existing", "new", "removed"];
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;
const PHONE_CHARS_PATTERN = /^[0-9+().\-\s]+$/;
const INSTAGRAM_HANDLE_PATTERN = /^[A-Za-z0-9._]{1,30}$/;
const INSTAGRAM_URL_PATTERN =
  /^(?:https?:\/\/)?(?:www\.)?instagram\.com\/([A-Za-z0-9._]{1,30})\/?(?:[?#].*)?$/i;

const FIELD_LIMITS = {
  name: 200,
  address: 300,
  city: 100,
  state_region: 100,
  country: 100,
  website: 300,
  instagram: 31,
  email: 254,
  phone: 30,
  organization: 200,
} as const;

const CANDIDATE_KEYS = Object.keys(FIELD_LIMITS) as (keyof EntityCandidate)[];

export function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/** Control and invisible formatting characters become spaces; whitespace collapses. */
function cleanText(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max)
    .trim();
  return cleaned || null;
}

// Flyers print bare domains far more often than full URLs: assume https for a
// scheme-less hostname, reject anything that is not http(s) or carries credentials.
function cleanWebsite(value: unknown): string | null {
  const text = cleanText(value, 2048);
  if (!text) return null;
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`;
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (parsed.username || parsed.password) return null;
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(parsed.hostname)) return null;
  return candidate.length <= FIELD_LIMITS.website ? candidate : null;
}

function cleanInstagram(value: unknown): string | null {
  const text = cleanText(value, 300);
  if (!text) return null;
  const url = INSTAGRAM_URL_PATTERN.exec(text);
  const handle = url ? url[1] : text.replace(/^@/, "");
  return INSTAGRAM_HANDLE_PATTERN.test(handle) ? `@${handle}` : null;
}

function cleanEmail(value: unknown): string | null {
  const text = cleanText(value, FIELD_LIMITS.email);
  return text && EMAIL_PATTERN.test(text) ? text : null;
}

function cleanPhone(value: unknown): string | null {
  const text = cleanText(value, FIELD_LIMITS.phone);
  if (!text || !PHONE_CHARS_PATTERN.test(text)) return null;
  const digits = text.replace(/\D/g, "").length;
  return digits >= 7 && digits <= 15 ? text : null;
}

/**
 * Safe parser for one candidate. Requires a readable name; every other field is
 * optional, bounded, and validated. Unknown keys are never copied, so ids or
 * flags cannot ride in on a candidate.
 */
export function normalizeEntityCandidate(raw: unknown): EntityCandidate | null {
  if (!isRecord(raw)) return null;
  const name = cleanText(raw.name, FIELD_LIMITS.name);
  if (!name) return null;
  return {
    name,
    address: cleanText(raw.address, FIELD_LIMITS.address),
    city: cleanText(raw.city, FIELD_LIMITS.city),
    state_region: cleanText(raw.state_region, FIELD_LIMITS.state_region),
    country: cleanText(raw.country, FIELD_LIMITS.country),
    website: cleanWebsite(raw.website),
    instagram: cleanInstagram(raw.instagram),
    email: cleanEmail(raw.email),
    phone: cleanPhone(raw.phone),
    organization: cleanText(raw.organization, FIELD_LIMITS.organization),
  };
}

/** Case/diacritic/whitespace-insensitive identity used to dedupe names. */
export function entityKey(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}
function instructorCandidateKey(candidate: EntityCandidate): string {
  return JSON.stringify([
    entityKey(candidate.name),
    candidate.instagram?.toLowerCase() ?? "",
    entityKey(candidate.organization ?? ""),
    candidate.website ?? "",
    candidate.email?.toLowerCase() ?? "",
    candidate.phone?.replace(/\D/g, "") ?? "",
    entityKey(candidate.city ?? ""),
    entityKey(candidate.state_region ?? ""),
    entityKey(candidate.country ?? ""),
    entityKey(candidate.address ?? ""),
  ]);
}

/** Drops nameless entries and identical candidates, not distinct same-name people. */
export function normalizeEntityCandidateList(raw: readonly unknown[]): EntityCandidate[] {
  const result: EntityCandidate[] = [];
  const seen = new Set<string>();
  for (const entry of raw) {
    const normalized = normalizeEntityCandidate(entry);
    if (!normalized) continue;
    const key = instructorCandidateKey(normalized);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
    if (result.length >= MAX_REVIEW_INSTRUCTORS) break;
  }
  return result;
}

export function normalizeEntityCandidates(candidates: EntityCandidates): EntityCandidates {
  return {
    venue: normalizeEntityCandidate(candidates.venue),
    organizer: normalizeEntityCandidate(candidates.organizer),
    instructors: normalizeEntityCandidateList(candidates.instructors ?? []),
    school: normalizeEntityCandidate(candidates.school),
  };
}

export function emptyEntityCandidates(): EntityCandidates {
  return { venue: null, organizer: null, instructors: [], school: null };
}

export function emptyEntityReview(): EntityReview {
  return { venue: null, organizer: null, instructors: [], school: null };
}

export function hasEntityCandidates(candidates: EntityCandidates): boolean {
  return !!(
    candidates.venue ||
    candidates.organizer ||
    candidates.school ||
    candidates.instructors.length > 0
  );
}

/**
 * Entity candidates for review. The structured `venue`/`organizer`/`instructors`/
 * `school` fields are authoritative whenever present — an explicit `null` or `[]`
 * means "the flyer shows none" and the flat fields are NOT consulted. Only a
 * legacy extraction without any structured field falls back to the flat
 * `venue_name`/`address`/`city` and `organizer_name`. The flat `instagram` and
 * `website` are the event's contact and never become entity data.
 */
export function extractionEntityCandidates(extraction: ExtractedEvent): EntityCandidates {
  const venue =
    extraction.venue !== undefined
      ? normalizeEntityCandidate(extraction.venue)
      : normalizeEntityCandidate({
          name: extraction.venue_name,
          address: extraction.address,
          city: extraction.city,
        });
  const organizer =
    extraction.organizer !== undefined
      ? normalizeEntityCandidate(extraction.organizer)
      : normalizeEntityCandidate({ name: extraction.organizer_name });
  return {
    venue,
    organizer,
    instructors: normalizeEntityCandidateList(extraction.instructors ?? []),
    school: normalizeEntityCandidate(extraction.school),
  };
}

const INVALID_REVIEW = "Invalid entity review";

function parseMatch(raw: unknown): EntityMatch | null {
  if (!isRecord(raw)) return null;
  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  const name = cleanText(raw.name, FIELD_LIMITS.name);
  if (!UUID_PATTERN.test(id) || !name) return null;
  return {
    id: id.toLowerCase(),
    name,
    address: cleanText(raw.address, FIELD_LIMITS.address),
    city: cleanText(raw.city, FIELD_LIMITS.city),
    state_region: cleanText(raw.state_region, FIELD_LIMITS.state_region),
    website: cleanWebsite(raw.website),
    instagram: cleanInstagram(raw.instagram),
  };
}

/** Search results: accepts an array or `{ matches: [...] }`, drops unreadable rows. */
export function parseEntityMatches(raw: unknown): EntityMatch[] {
  const rows = Array.isArray(raw)
    ? raw
    : isRecord(raw) && Array.isArray(raw.matches)
      ? raw.matches
      : [];
  const matches: EntityMatch[] = [];
  for (const row of rows) {
    const match = parseMatch(row);
    if (match) matches.push(match);
    if (matches.length >= MAX_ENTITY_MATCHES) break;
  }
  return matches;
}

function parseItem(raw: unknown): EntityReviewItem {
  if (!isRecord(raw)) throw new Error(INVALID_REVIEW);
  const candidate = normalizeEntityCandidate(raw.candidate);
  if (!candidate) throw new Error(INVALID_REVIEW);
  if (typeof raw.state !== "string" || !REVIEW_STATES.includes(raw.state)) {
    throw new Error(INVALID_REVIEW);
  }
  if (typeof raw.decision !== "string" || !REVIEW_DECISIONS.includes(raw.decision)) {
    throw new Error(INVALID_REVIEW);
  }
  if (!Array.isArray(raw.matches)) throw new Error(INVALID_REVIEW);
  const matches: EntityMatch[] = [];
  for (const row of raw.matches.slice(0, MAX_ENTITY_MATCHES)) {
    const match = parseMatch(row);
    if (!match) throw new Error(INVALID_REVIEW);
    matches.push(match);
  }

  // Semantic safety: a selected id only means something with the "existing"
  // decision and only if it is a real uuid. An "existing" decision without a
  // usable id is downgraded to pending so nothing canonical is ever written on
  // a guess; any other decision never carries a stray id.
  const selected =
    typeof raw.selected_id === "string" && UUID_PATTERN.test(raw.selected_id.trim())
      ? raw.selected_id.trim().toLowerCase()
      : null;
  let decision = raw.decision as EntityReviewDecision;
  let selectedId: string | null = null;
  if (decision === "existing") {
    if (selected) selectedId = selected;
    else decision = "pending";
  }

  const confirmed = decision === "existing" || decision === "new";
  const extractionCandidate = normalizeEntityCandidate(raw.extraction_candidate);
  return {
    candidate,
    state: raw.state as EntityReviewState,
    matches,
    decision,
    selected_id: selectedId,
    ...(confirmed && raw.explicit === true ? { explicit: true } : {}),
    ...(confirmed && raw.moderator_confirmed === true ? { moderator_confirmed: true } : {}),
    ...(raw.extraction_candidate === null
      ? { extraction_candidate: null }
      : extractionCandidate
        ? { extraction_candidate: extractionCandidate }
        : {}),
  };
}

function parseSlot(raw: unknown): EntityReviewItem | null {
  return raw === undefined || raw === null ? null : parseItem(raw);
}

export function parseEntityReview(raw: unknown): EntityReview {
  if (!isRecord(raw)) throw new Error(INVALID_REVIEW);
  const rawInstructors = raw.instructors ?? [];
  if (!Array.isArray(rawInstructors)) throw new Error(INVALID_REVIEW);
  return {
    venue: parseSlot(raw.venue),
    organizer: parseSlot(raw.organizer),
    instructors: rawInstructors.slice(0, MAX_REVIEW_INSTRUCTORS).map(parseItem),
    school: parseSlot(raw.school),
  };
}

function sameCandidate(
  current: EntityCandidate,
  extracted: EntityCandidate | null | undefined
): boolean {
  if (!extracted) return false;
  return CANDIDATE_KEYS.every((key) => (current[key] ?? null) === (extracted[key] ?? null));
}

/** The user acted on the item or changed its text, or the flyer never produced it. */
function isTouched(item: EntityReviewItem, extracted: EntityCandidate | null | undefined): boolean {
  const deliberate =
    item.decision === "new" ||
    item.decision === "removed" ||
    (item.decision === "existing" && (item.state !== "MATCHED" || item.explicit === true));
  return deliberate || !sameCandidate(item.candidate, extracted);
}

function mergeSlot(
  current: EntityReviewItem | null,
  extracted: EntityCandidate | null,
  incoming: EntityReviewItem | null
): EntityReviewItem | null {
  if (!current) return incoming;
  return isTouched(current, extracted) ? current : incoming;
}

/**
 * Applies a repeat extraction's reconciliation without overwriting user work.
 *
 * - `current`: the review as the user left it.
 * - `previousExtraction`: candidates the *previous* extraction produced, used to
 *   tell an edited candidate from an untouched one.
 * - `incoming`: the fresh reconciliation of the repeat extraction.
 *
 * Explicit decisions and edits survive; unchanged automatic matches refresh.
 * Instructor origins travel with retained edits, rather than relying on the
 * merged array order to identify their extraction baseline on the next retry.
 */
export function mergeEntityReview(
  current: EntityReview | null,
  previousExtraction: EntityCandidates | null,
  incoming: EntityReview
): EntityReview {
  if (!current) return incoming;
  const previous = previousExtraction ?? emptyEntityCandidates();

  const kept: EntityReviewItem[] = [];
  const covered = new Set<string>();
  current.instructors.forEach((item, index) => {
    const extracted =
      item.extraction_candidate !== undefined
        ? item.extraction_candidate
        : previous.instructors[index];
    if (!isTouched(item, extracted)) return;
    kept.push({ ...item, extraction_candidate: extracted ?? null });
    covered.add(instructorCandidateKey(item.candidate));
    if (extracted) covered.add(instructorCandidateKey(extracted));
  });
  const instructors = [...kept];
  for (const item of incoming.instructors) {
    const key = instructorCandidateKey(item.candidate);
    if (covered.has(key)) continue;
    covered.add(key);
    instructors.push({ ...item, extraction_candidate: item.candidate });
  }

  return {
    venue: mergeSlot(current.venue, previous.venue, incoming.venue),
    organizer: mergeSlot(current.organizer, previous.organizer, incoming.organizer),
    instructors: instructors.slice(0, MAX_REVIEW_INSTRUCTORS),
    school: mergeSlot(current.school, previous.school, incoming.school),
  };
}
