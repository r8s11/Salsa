import { supabase } from "../../lib/supabase";
import {
  ENTITY_KINDS,
  hasEntityCandidates,
  emptyEntityReview,
  normalizeEntityCandidates,
  parseEntityMatches,
  parseEntityReview,
  type EntityCandidates,
  type EntityKind,
  type EntityMatch,
  type EntityReview,
  type EntityReviewItem,
} from "./entityReview";

const RECONCILE_ERROR = "We couldn't match the names on this flyer. Please try again.";
const SEARCH_ERROR = "We couldn't search right now. Please try again.";
const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 120;

/** Keeps the text the user sent: the server decides matches, never the wording. */
function withSentCandidate(
  received: EntityReviewItem | null,
  sent: EntityCandidates["venue"]
): EntityReviewItem | null {
  return received && sent ? { ...received, candidate: sent } : received;
}

/**
 * Asks the backend (`reconcile_flyer_entities`, the only matcher) how each
 * candidate relates to canonical records. Candidates are normalized first and
 * nothing is sent when none remain. The review comes back with decisions the
 * server could settle deterministically; everything else is `pending`.
 */
export async function reconcileEntities(candidates: EntityCandidates): Promise<EntityReview> {
  const sent = normalizeEntityCandidates(candidates);
  if (!hasEntityCandidates(sent)) return emptyEntityReview();

  let review: EntityReview;
  try {
    const { data, error } = await supabase.rpc("reconcile_flyer_entities", { p_candidates: sent });
    if (error) throw new Error(RECONCILE_ERROR);
    review = parseEntityReview(data);
  } catch {
    throw new Error(RECONCILE_ERROR);
  }

  return {
    venue: withSentCandidate(review.venue, sent.venue),
    organizer: withSentCandidate(review.organizer, sent.organizer),
    instructors:
      review.instructors.length === sent.instructors.length
        ? review.instructors.map((item, index) => ({ ...item, candidate: sent.instructors[index] }))
        : review.instructors,
    school: withSentCandidate(review.school, sent.school),
  };
}

/** Typeahead over canonical entities of one kind (`search_flyer_entities`, public fields only). */
export async function searchEntityMatches(kind: EntityKind, query: string): Promise<EntityMatch[]> {
  if (!ENTITY_KINDS.includes(kind)) throw new Error("Unknown entity kind");
  const trimmed = query.trim().slice(0, MAX_QUERY_LENGTH).trim();
  if (trimmed.length < MIN_QUERY_LENGTH) return [];

  try {
    const { data, error } = await supabase.rpc("search_flyer_entities", {
      p_kind: kind,
      p_query: trimmed,
    });
    if (error) throw new Error(SEARCH_ERROR);
    return parseEntityMatches(data);
  } catch {
    throw new Error(SEARCH_ERROR);
  }
}
