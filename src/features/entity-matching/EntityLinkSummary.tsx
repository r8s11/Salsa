import { useId, useState } from "react";
import { AlertTriangle, CheckCircle2, Link2, Plus, PlusCircle, Type, Undo2, X } from "lucide-react";
import type { EntityMatch, EntityReview, EntityReviewItem } from "./entityReview";
import { MAX_REVIEW_INSTRUCTORS } from "./entityReview";
import { matchContext, matchLabel } from "./entityMatchDisplay";
import { EntityNameTypeahead } from "./EntityMatchAssist";
import {
  CREATION_SIGNAL_HINT,
  KIND_LABEL,
  SLOT_KIND,
  chooseExisting,
  clearDecision,
  confirmNew,
  hasCreationSignal,
  linkStatus,
  listReviewEntries,
  newReviewItem,
  removeItem,
  selectedMatch,
  setReviewItem,
  unresolvedCount,
  type EntitySlot,
  type LinkMode,
  type ReviewEntry,
} from "./entityReviewState";
import "./EntityReviewSection.css";
import "./EntityLinks.css";

const EMPTY: EntityReview = { venue: null, organizer: null, instructors: [], school: null };
const ADDABLE_SLOTS: readonly EntitySlot[] = ["organizer", "instructors", "school"];
const MAX_INLINE_MATCHES = 3;

const STATUS_ICON = {
  existing: CheckCircle2,
  new: PlusCircle,
  removed: X,
  pending: AlertTriangle,
} as const;

export interface EntityLinkSummaryProps {
  review: EntityReview | null | undefined;
  mode: LinkMode;
  /** Without it the summary is read-only (success page, the submitter's original). */
  onChange?: (review: EntityReview) => void;
  heading?: string;
  headingLevel?: 2 | 3;
  intro?: string;
  /** Venue text typed into the event with no venue link; shown so nothing is implied. */
  typedVenue?: string;
  /** A venue linked by id outside the review (admin venue search, older events). */
  directVenue?: string | null;
  /** Offers adding an organizer, instructor or school by name (public submit). */
  addable?: boolean;
  /** Typeahead lookups need a signed-in session. */
  searchEnabled?: boolean;
  /** Overrides the explanation shown when items still need a choice. */
  pendingNote?: string;
  emptyText?: string;
  disabled?: boolean;
}

/** Display name: the listed record when one is chosen, otherwise what was typed or read. */
function shownName(item: EntityReviewItem): { name: string; from: string | null } {
  const match = selectedMatch(item);
  const typed = item.candidate.name.trim();
  if (!match) return { name: typed, from: null };
  const differs = typed && typed.toLocaleLowerCase() !== match.name.trim().toLocaleLowerCase();
  return { name: match.name, from: differs ? typed : null };
}

/**
 * "Linked to this event": one row per venue, organizer, instructor and school
 * in the event's `entity_review`, each with its decision in words. It reads
 * the same review the form submits, so what is listed is exactly what is sent.
 * Rows still needing a choice can be settled inline.
 */
export default function EntityLinkSummary({
  review,
  mode,
  onChange,
  heading = "Linked to this event",
  headingLevel = 2,
  intro,
  typedVenue,
  directVenue = null,
  addable = false,
  searchEnabled = true,
  pendingNote,
  emptyText = "Nothing is linked to this event yet.",
  disabled = false,
}: EntityLinkSummaryProps) {
  const headingId = useId();
  const [announcement, setAnnouncement] = useState("");
  const current = review ?? EMPTY;
  const entries = listReviewEntries(current);
  const pending = unresolvedCount(current);
  const isPublic = mode === "public";
  const editable = Boolean(onChange) && !disabled;
  const venueRow: "direct" | "typed" | null = current.venue
    ? null
    : directVenue
      ? "direct"
      : typedVenue?.trim()
        ? "typed"
        : null;
  const Heading = headingLevel === 2 ? "h2" : "h3";

  const update = (entry: ReviewEntry, next: EntityReviewItem, message: string) => {
    if (!onChange) return;
    onChange(setReviewItem(current, entry.slot, entry.index, next));
    setAnnouncement(message);
  };

  const addAt = (slot: EntitySlot) => {
    if (slot !== "instructors") return 0;
    const removed = current.instructors.findIndex((item) => item.decision === "removed");
    return removed >= 0 ? removed : current.instructors.length;
  };
  const addableSlots = ADDABLE_SLOTS.filter((slot) =>
    slot === "instructors"
      ? current.instructors.filter((item) => item.decision !== "removed").length <
        MAX_REVIEW_INSTRUCTORS
      : !current[slot] || current[slot]?.decision === "removed"
  );
  const [addSlot, setAddSlot] = useState<EntitySlot>("organizer");
  const activeAddSlot = addableSlots.includes(addSlot) ? addSlot : addableSlots[0];

  const pickNew = (slot: EntitySlot, match: EntityMatch, typed: string) => {
    if (!onChange) return;
    const kind = SLOT_KIND[slot];
    const item: EntityReviewItem = {
      ...chooseExisting(newReviewItem(typed || match.name), match, { moderator: !isPublic }),
      state: "MATCHED",
    };
    onChange(setReviewItem(current, slot, addAt(slot), item));
    setAnnouncement(`${match.name} linked as the ${KIND_LABEL[kind].toLowerCase()}.`);
  };
  const addTyped = (slot: EntitySlot, typed: string, matches: EntityMatch[] | null) => {
    if (!onChange) return;
    const kind = SLOT_KIND[slot];
    const base: EntityReviewItem = {
      ...newReviewItem(typed),
      state: matches === null ? "NEEDS REVIEW" : matches.length > 0 ? "POSSIBLE MATCH" : "NEW",
      matches: (matches ?? []).slice(0, 10),
    };
    onChange(setReviewItem(current, slot, addAt(slot), confirmNew(base)));
    setAnnouncement(`${typed} suggested as a new ${KIND_LABEL[kind].toLowerCase()}.`);
  };

  return (
    <section
      className="entity-review entity-links"
      data-mode={mode}
      aria-labelledby={headingId}
    >
      <header className="entity-links__head">
        <Heading id={headingId}>{heading}</Heading>
        {intro && <p className="entity-review__intro">{intro}</p>}
      </header>
      <p className="entity-review__live" role="status" aria-live="polite">
        {announcement}
      </p>

      {pending > 0 && mode !== "submitted" && (
        <p className="entity-links__pending">
          <AlertTriangle size={16} aria-hidden="true" />
          <span>
            <strong>
              {onChange
                ? `${pending} ${pending === 1 ? "item needs" : "items need"} your choice.`
                : `${pending} left undecided.`}
            </strong>{" "}
            {pendingNote ??
              (isPublic
                ? "You can still submit. A moderator decides what to link for anything left undecided."
                : "Undecided items are not linked.")}
          </span>
        </p>
      )}

      {entries.length === 0 && !venueRow ? (
        <p className="entity-links__empty">{emptyText}</p>
      ) : (
        <ul className="entity-links__list">
          {venueRow === "direct" && (
            <li className="entity-links__row" data-decision="existing">
              <div className="entity-links__summary">
                <div className="entity-links__who">
                  <p className="entity-links__kind">Venue</p>
                  <p className="entity-links__name">{directVenue}</p>
                </div>
                <p className="entity-links__status" data-decision="existing">
                  <CheckCircle2 size={16} aria-hidden="true" />
                  Existing — will be linked
                </p>
              </div>
            </li>
          )}
          {venueRow === "typed" && (
            <li className="entity-links__row" data-decision="typed">
              <div className="entity-links__summary">
                <div className="entity-links__who">
                  <p className="entity-links__kind">Venue</p>
                  <p className="entity-links__name">“{typedVenue!.trim()}”</p>
                </div>
                <p className="entity-links__status" data-decision="typed">
                  <Type size={16} aria-hidden="true" />
                  Typed only — not linked
                </p>
              </div>
              <p className="entity-links__detail">
                Saved as text on the event. Pick a listed venue under the venue name to link it.
              </p>
            </li>
          )}
          {entries.map((entry) => (
            <SummaryRow
              key={`${entry.slot}:${entry.index}`}
              entry={entry}
              mode={mode}
              editable={editable}
              readOnly={!onChange}
              onUpdate={update}
            />
          ))}
        </ul>
      )}

      {addable && editable && activeAddSlot && (
        <fieldset className="entity-links__add">
          <legend className="entity-review__group-title">Add an organizer, instructor or school</legend>
          <div className="entity-review__actions" role="group" aria-label="What to add">
            {addableSlots.map((slot) => (
              <button
                key={slot}
                type="button"
                className="entity-review__btn"
                aria-pressed={slot === activeAddSlot}
                onClick={() => setAddSlot(slot)}
              >
                {slot === "instructors" ? "Instructor" : KIND_LABEL[SLOT_KIND[slot]]}
              </button>
            ))}
          </div>
          <EntityNameTypeahead
            key={activeAddSlot}
            kind={SLOT_KIND[activeAddSlot]}
            label={`${KIND_LABEL[SLOT_KIND[activeAddSlot]]} name`}
            addLabel="Suggest as new"
            searchEnabled={searchEnabled}
            onPick={(match, typed) => pickNew(activeAddSlot, match, typed)}
            onAdd={(typed, matches) => addTyped(activeAddSlot, typed, matches)}
          />
        </fieldset>
      )}
    </section>
  );
}

type SummaryRowProps = {
  entry: ReviewEntry;
  mode: LinkMode;
  editable: boolean;
  /** Shown after the fact: undecided reads as "left undecided", not as a request. */
  readOnly: boolean;
  onUpdate: (entry: ReviewEntry, next: EntityReviewItem, message: string) => void;
};

function SummaryRow({ entry, mode, editable, readOnly, onUpdate }: SummaryRowProps) {
  const { item, kind } = entry;
  const isPublic = mode === "public";
  const label = KIND_LABEL[kind];
  const noun = label.toLowerCase();
  const { name, from } = shownName(item);
  const status =
    readOnly && item.decision === "pending" && mode !== "submitted"
      ? {
          label: "Left undecided",
          detail: isPublic ? "A moderator decides whether to link it." : "Not linked unless decided.",
        }
      : linkStatus(item, mode);
  const Icon = STATUS_ICON[item.decision];
  const match = selectedMatch(item);
  const context = match ? matchContext(match) : [];
  const canCreate = isPublic || hasCreationSignal(kind, item.candidate);
  const choices = item.decision === "pending" ? item.matches.slice(0, MAX_INLINE_MATCHES) : [];
  const displayName = name || `Unnamed ${noun}`;

  return (
    <li className="entity-links__row" data-decision={item.decision}>
      <div className="entity-links__summary">
        <div className="entity-links__who">
          <p className="entity-links__kind">{label}</p>
          <p className="entity-links__name">{displayName}</p>
          {from && <p className="entity-links__from">From “{from}”</p>}
          {context.length > 0 && <p className="entity-links__from">{context.join(" · ")}</p>}
        </div>
        <p className="entity-links__status" data-decision={item.decision}>
          <Icon size={16} aria-hidden="true" />
          {status.label}
        </p>
      </div>
      {status.detail && item.decision !== "existing" && (
        <p className="entity-links__detail">{status.detail}</p>
      )}

      {editable && choices.length > 0 && (
        <ul className="entity-review__matches" aria-label={`Listed ${noun}s for ${displayName}`}>
          {choices.map((choice) => {
            const where = matchContext(choice);
            return (
              <li key={choice.id} className="entity-review__match">
                <div>
                  <p className="entity-review__match-name">{choice.name}</p>
                  {where.length > 0 && (
                    <p className="entity-review__match-context">{where.join(" · ")}</p>
                  )}
                </div>
                <button
                  type="button"
                  className="entity-review__btn"
                  aria-label={matchLabel(choice, item.matches, noun, "Link")}
                  onClick={() =>
                    onUpdate(
                      entry,
                      chooseExisting(item, choice, { moderator: !isPublic }),
                      `Using listed ${noun} ${choice.name}.`
                    )
                  }
                >
                  <Link2 size={16} aria-hidden="true" />
                  Link
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {editable && item.decision === "pending" && !canCreate && name && (
        <p className="entity-review__hint">
          To add a new {noun}, include {CREATION_SIGNAL_HINT[kind]} in the review details.
        </p>
      )}

      {editable && (
        <div className="entity-review__actions">
          {item.decision === "pending" && (
            <button
              type="button"
              className="entity-review__btn"
              disabled={!name || !canCreate}
              aria-label={`${isPublic ? "Suggest" : "Add"} ${displayName} as a new ${noun}`}
              onClick={() =>
                onUpdate(
                  entry,
                  confirmNew(item, { moderator: !isPublic }),
                  isPublic ? `${label} suggested as new.` : `${label} will be added as new.`
                )
              }
            >
              <Plus size={16} aria-hidden="true" />
              {isPublic ? "Suggest as new" : "Add as new"}
            </button>
          )}
          {item.decision === "removed" ? (
            <button
              type="button"
              className="entity-review__btn"
              aria-label={`Undo remove ${displayName}`}
              onClick={() => onUpdate(entry, clearDecision(item), `${label} restored. It needs your choice.`)}
            >
              <Undo2 size={16} aria-hidden="true" />
              Undo remove
            </button>
          ) : (
            <button
              type="button"
              className="entity-review__btn"
              aria-label={`Don’t link ${displayName}`}
              onClick={() => onUpdate(entry, removeItem(item), `${label} will not be linked.`)}
            >
              <X size={16} aria-hidden="true" />
              Don’t link
            </button>
          )}
        </div>
      )}
    </li>
  );
}
