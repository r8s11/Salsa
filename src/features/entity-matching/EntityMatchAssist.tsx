import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Link2, Loader2, Plus, RefreshCw, Undo2 } from "lucide-react";
import type { EntityKind, EntityMatch } from "./entityReview";
import type { RecordPrefill } from "./entityPrefill";
import { matchContext, matchLabel } from "./entityMatchDisplay";
import { KIND_LABEL } from "./entityReviewState";
import { useEntityMatchSuggestions, type MatchSuggestions } from "./useEntityMatchSuggestions";
import "./EntityReviewSection.css";
import "./EntityLinks.css";

const MAX_SHOWN = 3;

const swallowEnter = (event: KeyboardEvent<HTMLInputElement>, then?: () => void) => {
  // These inputs live inside event forms; Enter must never submit the form.
  if (event.key !== "Enter") return;
  event.preventDefault();
  then?.();
};

type ChoicesProps = {
  suggestions: MatchSuggestions;
  kind: EntityKind;
  statusId: string;
  disabled?: boolean;
  onPick: (match: EntityMatch) => void;
};

/** Status line plus the first few existing records resembling the typed text. */
function MatchChoices({ suggestions, kind, statusId, disabled, onPick }: ChoicesProps) {
  const noun = KIND_LABEL[kind].toLowerCase();
  const { status, matches, query } = suggestions;
  const shown = matches.slice(0, MAX_SHOWN);
  return (
    <>
      <p id={statusId} className="entity-review__search-status" aria-live="polite">
        {status === "loading" && `Looking for existing ${noun}s…`}
        {status === "done" && matches.length === 0 && `No listed ${noun} matches “${query}”.`}
        {status === "done" &&
          matches.length > 0 &&
          `Already listed. Pick one to link it, or keep typing.`}
        {status === "error" && `We couldn’t look up existing ${noun}s right now.`}
      </p>
      {status === "error" && (
        <div className="entity-review__actions">
          <button
            type="button"
            className="entity-review__btn"
            onClick={suggestions.retry}
            disabled={disabled}
          >
            <RefreshCw size={16} aria-hidden="true" />
            Try the lookup again
          </button>
        </div>
      )}
      {shown.length > 0 && (
        <ul className="entity-review__matches" aria-label={`Listed ${noun}s matching ${query}`}>
          {shown.map((match) => {
            const context = matchContext(match);
            return (
              <li key={match.id} className="entity-review__match">
                <div>
                  <p className="entity-review__match-name">{match.name}</p>
                  {context.length > 0 && (
                    <p className="entity-review__match-context">{context.join(" · ")}</p>
                  )}
                </div>
                <button
                  type="button"
                  className="entity-review__btn"
                  aria-label={matchLabel(match, matches, noun, "Link")}
                  disabled={disabled}
                  onClick={() => onPick(match)}
                >
                  <Link2 size={16} aria-hidden="true" />
                  Link
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}

export type EntityNameTypeaheadProps = {
  kind: EntityKind;
  label: string;
  /** Visible text of the add button. */
  addLabel: string;
  searchEnabled?: boolean;
  disabled?: boolean;
  /** The person picked a listed record. */
  onPick: (match: EntityMatch, typed: string) => void;
  /** The person added the typed name as is; `matches` is what the lookup found, or null if it never answered. */
  onAdd: (typed: string, matches: EntityMatch[] | null) => void;
};

/** A name field that shows listed records as the person types (debounced). */
export function EntityNameTypeahead({
  kind,
  label,
  addLabel,
  searchEnabled = true,
  disabled = false,
  onPick,
  onAdd,
}: EntityNameTypeaheadProps) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const noun = KIND_LABEL[kind].toLowerCase();
  const [name, setName] = useState("");
  const typed = name.trim();
  const suggestions = useEntityMatchSuggestions(kind, name, { enabled: searchEnabled && !disabled });
  const add = () => {
    if (!typed || disabled) return;
    onAdd(typed, suggestions.status === "done" ? suggestions.matches : null);
    setName("");
  };
  return (
    <div className="entity-review__add">
      <label htmlFor={id}>{label}</label>
      <div className="entity-review__search-row">
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={name}
          autoComplete="off"
          placeholder={`Name of the ${noun}`}
          aria-describedby={`${id}-status`}
          disabled={disabled}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => swallowEnter(event, add)}
        />
        <button
          type="button"
          className="entity-review__btn"
          disabled={!typed || disabled}
          onClick={add}
        >
          <Plus size={16} aria-hidden="true" />
          {addLabel}
        </button>
      </div>
      <MatchChoices
        suggestions={suggestions}
        kind={kind}
        statusId={`${id}-status`}
        disabled={disabled}
        onPick={(match) => {
          onPick(match, typed);
          setName("");
          // The chosen match button disappears with the cleared query.
          inputRef.current?.focus();
        }}
      />
    </div>
  );
}

export type EntityFieldAssistProps<F extends string> = {
  kind: EntityKind;
  /** What the person typed into the event's own field. */
  text: string;
  /** The event field this assists; undo returns keyboard focus to it. */
  fieldId: string;
  /** False when signed out or the field already carries a link. */
  searchEnabled: boolean;
  disabled?: boolean;
  onPick: (match: EntityMatch) => void;
  /** The last link made from this field and what it filled; null when none is active. */
  prefill: RecordPrefill<F> | null;
  onUndo: () => void;
  onAcceptKept: (field: F) => void;
  /** A pick that is still loading the record's details (admin venues load their time zone). */
  picking?: boolean;
  pickError?: string | null;
};

const listLabels = (labels: string[]) =>
  labels.length <= 1
    ? (labels[0] ?? "")
    : `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;

/**
 * Sits under a typed event field (venue name, host). Offers listed records as
 * the person types; after a pick it says exactly what was filled, what typed
 * text was kept, and offers one-step undo.
 */
export function EntityFieldAssist<F extends string>({
  kind,
  text,
  fieldId,
  searchEnabled,
  disabled = false,
  onPick,
  prefill,
  onUndo,
  onAcceptKept,
  picking = false,
  pickError = null,
}: EntityFieldAssistProps<F>) {
  const id = useId();
  const undoRef = useRef<HTMLButtonElement>(null);
  const focusAfterChange = useRef<"undo" | "field" | null>(null);
  // A pick or undo replaces the button that was activated; move keyboard
  // focus to the control that now continues the task.
  useEffect(() => {
    if (focusAfterChange.current === "undo" && prefill) {
      undoRef.current?.focus();
      focusAfterChange.current = null;
    } else if (focusAfterChange.current === "field" && !prefill) {
      document.getElementById(fieldId)?.focus();
      focusAfterChange.current = null;
    }
  }, [prefill, fieldId]);
  const noun = KIND_LABEL[kind].toLowerCase();
  const suggestions = useEntityMatchSuggestions(kind, text, {
    enabled: searchEnabled && !prefill && !disabled,
  });

  if (prefill) {
    const filled = prefill.filled.map((change) => change.label.toLowerCase());
    return (
      <div className="entity-review entity-assist entity-assist--linked">
        <p className="entity-assist__line" role="status">
          <Link2 size={16} aria-hidden="true" />
          <span>
            Linked to the listed {noun} <strong>{prefill.recordName}</strong>.
            {filled.length > 0 && ` Filled ${listLabels(filled)} from the listing.`}
          </span>
        </p>
        {prefill.kept.map((change) => (
          <div key={change.field} className="entity-assist__kept">
            <p>
              Kept your {change.label.toLowerCase()}. The listing says “{change.next}”.
            </p>
            <button
              type="button"
              className="entity-review__btn"
              disabled={disabled}
              onClick={() => onAcceptKept(change.field)}
            >
              Use the listing’s {change.label.toLowerCase()}
            </button>
          </div>
        ))}
        <div className="entity-review__actions">
          <button
            ref={undoRef}
            type="button"
            className="entity-review__btn"
            disabled={disabled}
            onClick={() => {
              focusAfterChange.current = "field";
              onUndo();
            }}
          >
            <Undo2 size={16} aria-hidden="true" />
            {filled.length > 0 ? "Undo link and filled details" : "Undo link"}
          </button>
        </div>
      </div>
    );
  }

  if (!searchEnabled) return null;
  return (
    <div className="entity-review entity-assist" aria-busy={picking || undefined}>
      {picking && (
        <p className="entity-review__search-status" role="status">
          <Loader2 className="entity-review__spin" size={16} aria-hidden="true" /> Loading the{" "}
          {noun}’s details…
        </p>
      )}
      {pickError && (
        <p className="entity-review__error" role="alert">
          {pickError}
        </p>
      )}
      <MatchChoices
        suggestions={suggestions}
        kind={kind}
        statusId={`${id}-status`}
        disabled={disabled || picking}
        onPick={(match) => {
          focusAfterChange.current = "undo";
          onPick(match);
        }}
      />
    </div>
  );
}
