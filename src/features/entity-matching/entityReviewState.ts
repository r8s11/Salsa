import type { ExtractedEvent } from "../flyer-extraction/types";
import { parseEntityReview } from "./entityReview";
import type {
  EntityCandidate,
  EntityCandidates,
  EntityKind,
  EntityMatch,
  EntityReview,
  EntityReviewItem,
} from "./entityReview";

/**
 * Pure state transitions for the flyer entity review UI. Everything here takes
 * and returns plain `EntityReview` data so the section stays a thin controlled
 * view and every rule (what a decision means, what an edit invalidates) is
 * testable without rendering.
 */

export type { EntityKind };
export type EntitySlot = "venue" | "organizer" | "instructors" | "school";
export type EntityState = EntityReviewItem["state"];
export type EntityDecision = EntityReviewItem["decision"];
export type CandidateField = keyof EntityCandidate;

export const SLOTS: readonly EntitySlot[] = ["venue", "organizer", "instructors", "school"];

export const SLOT_KIND: Record<EntitySlot, EntityKind> = {
  venue: "venue",
  organizer: "organizer",
  instructors: "instructor",
  school: "school",
};

export const KIND_LABEL: Record<EntityKind, string> = {
  venue: "Venue",
  organizer: "Organizer",
  instructor: "Instructor",
  school: "School",
};

export const STATE_COPY: Record<EntityState, { label: string; description: string }> = {
  MATCHED: {
    label: "Matched",
    description: "A close match already exists in our records.",
  },
  "POSSIBLE MATCH": {
    label: "Possible match",
    description: "Similar records exist. Pick one, or confirm this one is new.",
  },
  NEW: {
    label: "Not in our records",
    description: "No similar record was found.",
  },
  "NEEDS REVIEW": {
    label: "Needs review",
    description: "Check these details before they are used.",
  },
};

export const FIELD_LABEL: Record<CandidateField, string> = {
  name: "Name",
  address: "Address",
  city: "City",
  state_region: "State or region",
  country: "Country",
  website: "Website",
  instagram: "Instagram",
  email: "Email",
  phone: "Phone",
  organization: "Organization",
};

export const FIELDS_BY_KIND: Record<EntityKind, readonly CandidateField[]> = {
  venue: ["address", "city", "state_region", "country", "website", "instagram", "phone"],
  organizer: ["city", "state_region", "website", "instagram", "email", "phone"],
  instructor: ["organization", "instagram", "website", "email", "phone"],
  school: ["address", "city", "state_region", "country", "website", "instagram", "email", "phone"],
};

/**
 * Fields the reconcile RPC matches on. Editing one of these makes any earlier
 * match or decision a statement about a different record; editing contact-only
 * fields (email, phone, organization) does not.
 */
export const MATCH_FIELDS: readonly CandidateField[] = [
  "name",
  "address",
  "city",
  "state_region",
  "country",
  "website",
  "instagram",
];

export type ReviewEntry = {
  slot: EntitySlot;
  index: number;
  kind: EntityKind;
  item: EntityReviewItem;
};

/** A candidate the person typed in by hand; its first check against existing records is still due. */
export function newReviewItem(name: string): EntityReviewItem {
  return {
    candidate: { name: name.trim() },
    state: "NEEDS REVIEW",
    matches: [],
    decision: "pending",
    selected_id: null,
  };
}
function itemFromCandidate(candidate: EntityCandidate): EntityReviewItem {
  return {
    candidate,
    state: "NEEDS REVIEW",
    matches: [],
    decision: "pending",
    selected_id: null,
  };
}

/** Used when reconciliation is unavailable: every candidate stays reviewable by hand. */
export function reviewFromCandidates(candidates: EntityCandidates): EntityReview {
  return {
    venue: candidates.venue ? itemFromCandidate(candidates.venue) : null,
    organizer: candidates.organizer ? itemFromCandidate(candidates.organizer) : null,
    instructors: candidates.instructors.map(itemFromCandidate),
    school: candidates.school ? itemFromCandidate(candidates.school) : null,
  };
}

export function listReviewEntries(review: EntityReview): ReviewEntry[] {
  const entries: ReviewEntry[] = [];
  if (review.venue) entries.push({ slot: "venue", index: 0, kind: "venue", item: review.venue });
  if (review.organizer)
    entries.push({ slot: "organizer", index: 0, kind: "organizer", item: review.organizer });
  review.instructors.forEach((item, index) =>
    entries.push({ slot: "instructors", index, kind: "instructor", item })
  );
  if (review.school)
    entries.push({ slot: "school", index: 0, kind: "school", item: review.school });
  return entries;
}

/** Items whose fate is still undecided. Pending items are skipped on save, never forced. */
export function unresolvedCount(review: EntityReview | null | undefined): number {
  if (!review) return 0;
  return listReviewEntries(review).filter(({ item }) => item.decision === "pending").length;
}

/** Replaces the item at `slot`/`index`; an index past the end appends an instructor. */
export function setReviewItem(
  review: EntityReview,
  slot: EntitySlot,
  index: number,
  item: EntityReviewItem
): EntityReview {
  if (slot !== "instructors") return { ...review, [slot]: item };
  const instructors = [...review.instructors];
  if (index >= instructors.length) instructors.push(item);
  else instructors[index] = item;
  return { ...review, instructors };
}

export function getReviewItem(
  review: EntityReview,
  slot: EntitySlot,
  index: number
): EntityReviewItem | null {
  return slot === "instructors" ? (review.instructors[index] ?? null) : review[slot];
}

type DecisionFlags = { explicit?: boolean; moderator_confirmed?: boolean };
type FlaggedItem = EntityReviewItem & DecisionFlags;

function stripFlags(item: EntityReviewItem): EntityReviewItem {
  const copy: FlaggedItem = { ...item };
  delete copy.explicit;
  delete copy.moderator_confirmed;
  return copy;
}

/** Drops the earlier verdict: the record no longer describes what is on screen. */
export function invalidateItem(item: EntityReviewItem): EntityReviewItem {
  return {
    ...stripFlags(item),
    state: "NEEDS REVIEW",
    matches: [],
    decision: "pending",
    selected_id: null,
  };
}

export function editCandidateField(
  item: EntityReviewItem,
  field: CandidateField,
  value: string
): EntityReviewItem {
  const stored = field === "name" ? value : value === "" ? null : value;
  const previous = item.candidate[field] ?? (field === "name" ? "" : null);
  if (previous === stored) return item;
  const edited: EntityReviewItem = { ...item, candidate: { ...item.candidate, [field]: stored } };
  return MATCH_FIELDS.includes(field) ? invalidateItem(edited) : edited;
}

/**
 * Marks a choice as the person's own. `explicit` lets a chosen existing record
 * win over a venue picked another way; `moderator_confirmed` is what lets a
 * moderator's choice count when it matches a public submitter's suggestion.
 */
type DecisionOptions = { moderator?: boolean };

export function chooseExisting(
  item: EntityReviewItem,
  match: EntityMatch,
  options: DecisionOptions = {}
): EntityReviewItem {
  const matches = item.matches.some((existing) => existing.id === match.id)
    ? item.matches
    : [match, ...item.matches];
  const chosen: FlaggedItem = {
    ...stripFlags(item),
    matches,
    decision: "existing",
    selected_id: match.id,
    explicit: true,
    ...(options.moderator ? { moderator_confirmed: true } : {}),
  };
  return chosen;
}

export function confirmNew(
  item: EntityReviewItem,
  options: DecisionOptions = {}
): EntityReviewItem {
  const confirmed: FlaggedItem = {
    ...stripFlags(item),
    decision: "new",
    selected_id: null,
    ...(options.moderator ? { moderator_confirmed: true } : {}),
  };
  return confirmed;
}

export function clearDecision(item: EntityReviewItem): EntityReviewItem {
  return { ...stripFlags(item), decision: "pending", selected_id: null };
}

export function removeItem(item: EntityReviewItem): EntityReviewItem {
  return { ...stripFlags(item), decision: "removed", selected_id: null };
}

/** Keeps the user's edited candidate; takes verdict, matches, and decision from a fresh check. */
export function applyRecheck(
  item: EntityReviewItem,
  rechecked: EntityReviewItem | null
): EntityReviewItem {
  if (!rechecked) {
    return {
      ...stripFlags(item),
      state: "NEW",
      matches: [],
      decision: "pending",
      selected_id: null,
    };
  }
  return {
    candidate: item.candidate,
    state: rechecked.state,
    matches: rechecked.matches,
    decision: rechecked.decision,
    selected_id: rechecked.selected_id,
  };
}

export function selectedMatch(item: EntityReviewItem): EntityMatch | null {
  if (item.decision !== "existing" || !item.selected_id) return null;
  return item.matches.find((match) => match.id === item.selected_id) ?? null;
}

export function decisionSummary(item: EntityReviewItem, kind: EntityKind): string {
  const noun = KIND_LABEL[kind].toLowerCase();
  switch (item.decision) {
    case "existing": {
      const match = selectedMatch(item);
      return match ? `Using existing ${noun}: ${match.name}` : `Using an existing ${noun}`;
    }
    case "new":
      return `Will be added as a new ${noun}`;
    case "removed":
      return `Not using this ${noun}`;
    case "pending":
      return `Undecided. This ${noun} is skipped unless you choose.`;
  }
}

/** A matched venue replaces the flyer's raw venue text, as exact matches always have. */
export function enrichExtractionWithReview(
  extraction: ExtractedEvent,
  review: EntityReview | null | undefined
): ExtractedEvent {
  const match = review?.venue ? selectedMatch(review.venue) : null;
  if (!match) return extraction;
  return {
    ...extraction,
    venue_name: match.name,
    address: match.address ?? extraction.address,
    city: match.city ?? extraction.city,
  };
}

/**
 * Public submitters can only suggest, and the server treats a moderator's
 * decision as theirs only when it differs from, or is explicitly confirmed
 * against, the submitter's. A moderator therefore starts from every suggested
 * "existing" or "new" decision shown as undecided and confirms the ones they
 * accept with one click. Removals stay: they never write anything.
 */
export function suggestionsToPending(review: EntityReview): EntityReview {
  const demote = (item: EntityReviewItem | null) =>
    item && (item.decision === "new" || item.decision === "existing") ? clearDecision(item) : item;
  return {
    venue: demote(review.venue),
    organizer: demote(review.organizer),
    instructors: review.instructors.map((item) => demote(item) as EntityReviewItem),
    school: demote(review.school),
  };
}

const normalizeText = (value: string | null | undefined) =>
  (value ?? "").normalize("NFKD").replace(/\s+/g, " ").trim().toLowerCase();

/** The server only creates a new record when the candidate carries something to tell it apart. */
export function hasCreationSignal(kind: EntityKind, candidate: EntityCandidate): boolean {
  const present = (value: string | null | undefined) => Boolean(value && value.trim());
  const web = present(candidate.website) || present(candidate.instagram);
  return kind === "venue" || kind === "school" ? web || present(candidate.address) : web;
}

export const CREATION_SIGNAL_HINT: Record<EntityKind, string> = {
  venue: "an address, website or Instagram",
  school: "an address, website or Instagram",
  organizer: "a website or Instagram",
  instructor: "a website or Instagram",
};

type VenueLinkDraft = {
  location?: string;
  address?: string;
  venue_id?: string;
  entity_review?: EntityReview;
};

/**
 * A venue the matcher linked on its own (an "existing" decision the person did
 * not click) must never override venue text or a venue the person set by hand.
 * Used after extraction: if the form already carries a different venue, the
 * automatic link is left undecided instead.
 */
export function suppressAutoVenueLink(review: EntityReview, draft: VenueLinkDraft): EntityReview {
  const venue = review.venue as FlaggedItem | null;
  if (!venue || venue.decision !== "existing" || venue.explicit) return review;
  const match = selectedMatch(venue);
  const names = [venue.candidate.name, match?.name].map(normalizeText);
  const addresses = [venue.candidate.address, match?.address].map(normalizeText).filter(Boolean);
  const location = normalizeText(draft.location);
  const address = normalizeText(draft.address);
  const differs =
    Boolean(draft.venue_id) ||
    (location !== "" && !names.includes(location)) ||
    (address !== "" && addresses.length > 0 && !addresses.includes(address));
  return differs ? { ...review, venue: clearDecision(venue) } : review;
}

/**
 * When the person edits the event's own venue text (or picks a venue), an
 * automatic link no longer describes the event they are building, so it is
 * detached. A link they accepted by clicking stays; that choice was theirs.
 */
export function detachAutoVenueLink<T extends VenueLinkDraft>(
  previous: VenueLinkDraft,
  next: T
): T {
  const venue = next.entity_review?.venue as FlaggedItem | null | undefined;
  if (!venue || venue.decision !== "existing" || venue.explicit) return next;
  const unchanged =
    previous.location === next.location &&
    previous.address === next.address &&
    previous.venue_id === next.venue_id;
  if (unchanged) return next;
  return { ...next, entity_review: { ...next.entity_review!, venue: clearDecision(venue) } };
}

/**
 * Reads a stored `entity_review` JSON value (submission or event row). Returns
 * null when it is absent, empty, or fails the model's strict validation, so a
 * damaged draft never blocks the moderator from reading the submission.
 */
export function readStoredEntityReview(raw: unknown): EntityReview | null {
  if (raw === null || raw === undefined) return null;
  try {
    const review = parseEntityReview(raw);
    return listReviewEntries(review).length > 0 ? review : null;
  } catch {
    return null;
  }
}

/**
 * The review a moderator starts from: their own earlier edits if any, otherwise
 * the submitter's review with "create new" suggestions shown as undecided.
 */
export function moderatorStartingReview(
  submittedReview: unknown,
  editedReview: unknown
): { review: EntityReview | null; demoted: boolean } {
  const edited = readStoredEntityReview(editedReview);
  if (edited) return { review: edited, demoted: false };
  const submitted = readStoredEntityReview(submittedReview);
  return submitted
    ? { review: suggestionsToPending(submitted), demoted: true }
    : { review: null, demoted: false };
}
