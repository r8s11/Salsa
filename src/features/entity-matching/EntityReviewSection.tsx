import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  CircleHelp,
  Loader2,
  Plus,
  PlusCircle,
  RefreshCw,
  Search,
  Undo2,
  X,
} from "lucide-react";
import type { EntityCandidates, EntityMatch, EntityReview, EntityReviewItem } from "./entityReview";
import { reconcileEntities, searchEntityMatches } from "./entityReviewClient";
import {
  CREATION_SIGNAL_HINT,
  FIELDS_BY_KIND,
  FIELD_LABEL,
  KIND_LABEL,
  SLOTS,
  SLOT_KIND,
  STATE_COPY,
  applyRecheck,
  chooseExisting,
  clearDecision,
  confirmNew,
  decisionSummary,
  editCandidateField,
  getReviewItem,
  hasCreationSignal,
  newReviewItem,
  listReviewEntries,
  removeItem,
  setReviewItem,
  type CandidateField,
  type EntityKind,
  type EntitySlot,
  type EntityState,
  type ReviewEntry,
} from "./entityReviewState";
import "./EntityReviewSection.css";

export interface EntityReviewSectionProps {
  review: EntityReview;
  onChange: (review: EntityReview) => void;
  disabled?: boolean;
  /**
   * `public` decisions are suggestions a moderator confirms; `authorized`
   * decisions create or link records when the event is saved or approved.
   */
  mode?: "public" | "authorized";
}

type SearchState = {
  query: string;
  status: "idle" | "loading" | "done" | "error";
  results: EntityMatch[];
  searchedFor: string;
};

const IDLE_SEARCH: SearchState = { query: "", status: "idle", results: [], searchedFor: "" };

const STATE_ICON: Record<EntityState, typeof CheckCircle2> = {
  MATCHED: CheckCircle2,
  "POSSIBLE MATCH": CircleHelp,
  NEW: PlusCircle,
  "NEEDS REVIEW": AlertTriangle,
};

const keyOf = (slot: EntitySlot, index: number) => `${slot}:${index}`;

function matchContext(match: EntityMatch): string[] {
  const place = [match.city, match.state_region].filter(Boolean).join(", ");
  return [match.address, place, match.website, match.instagram].filter((part): part is string =>
    Boolean(part)
  );
}

/** Accessible name for a match button; adds place or address only when another match shares the name. */
function matchLabel(match: EntityMatch, pool: EntityMatch[], noun: string, verb: string): string {
  const shared = pool.some((other) => other.id !== match.id && other.name === match.name);
  const context = shared
    ? [match.city, match.state_region, match.address].filter(Boolean).join(", ")
    : "";
  return `${verb} ${match.name}${context ? ` (${context})` : ""} as the ${noun}`;
}

function candidatesFor(slot: EntitySlot, item: EntityReviewItem): EntityCandidates {
  const none: EntityCandidates = { venue: null, organizer: null, instructors: [], school: null };
  if (slot === "instructors") return { ...none, instructors: [item.candidate] };
  return { ...none, [slot]: item.candidate };
}

const swallowEnter = (event: KeyboardEvent<HTMLInputElement>, then?: () => void) => {
  // These inputs live inside the event form; Enter must never submit it.
  if (event.key !== "Enter") return;
  event.preventDefault();
  then?.();
};

export default function EntityReviewSection({
  review,
  onChange,
  disabled = false,
  mode = "authorized",
}: EntityReviewSectionProps) {
  const headingId = useId();
  const baseId = useId();
  const isPublic = mode === "public";
  // Async checks resolve after the parent may have re-rendered; always merge
  // into the latest review, not the one captured when the request started.
  const reviewRef = useRef(review);
  const mounted = useRef(true);
  const [searches, setSearches] = useState<Record<string, SearchState>>({});
  const [checking, setChecking] = useState<Record<string, "loading" | "error" | undefined>>({});
  const [announcement, setAnnouncement] = useState("");

  useEffect(() => {
    reviewRef.current = review;
  }, [review]);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const commit = (next: EntityReview) => {
    reviewRef.current = next;
    onChange(next);
  };

  const updateItem = (
    slot: EntitySlot,
    index: number,
    change: (item: EntityReviewItem) => EntityReviewItem,
    message?: string
  ) => {
    const current = getReviewItem(reviewRef.current, slot, index);
    if (!current) return;
    const next = change(current);
    if (next !== current) commit(setReviewItem(reviewRef.current, slot, index, next));
    if (message) setAnnouncement(message);
  };

  const patchSearch = (key: string, patch: Partial<SearchState>) =>
    setSearches((previous) => ({
      ...previous,
      [key]: { ...(previous[key] ?? IDLE_SEARCH), ...patch },
    }));

  const add = (slot: EntitySlot, name: string) => {
    const kind = SLOT_KIND[slot];
    const index = slot === "instructors" ? reviewRef.current.instructors.length : 0;
    const item = newReviewItem(name);
    commit(setReviewItem(reviewRef.current, slot, index, item));
    setAnnouncement(`Added ${item.candidate.name}. Checking against existing records.`);
    void recheck({ slot, index, kind, item });
  };

  const remove = ({ slot, index, kind }: ReviewEntry) =>
    updateItem(slot, index, removeItem, `${KIND_LABEL[kind]} removed. You can undo this.`);

  const search = async ({ slot, index, kind }: ReviewEntry) => {
    const key = keyOf(slot, index);
    const query = (searches[key]?.query ?? "").trim();
    if (!query) return;
    patchSearch(key, { status: "loading", searchedFor: query });
    try {
      const results = await searchEntityMatches(kind, query);
      if (!mounted.current) return;
      setSearches((previous) => {
        // A newer query replaced this one while it was in flight.
        if (previous[key]?.searchedFor !== query) return previous;
        return { ...previous, [key]: { ...previous[key], status: "done", results } };
      });
      setAnnouncement(
        results.length === 0
          ? `No existing ${kind}s found for ${query}.`
          : `${results.length} existing ${kind}${results.length === 1 ? "" : "s"} found for ${query}.`
      );
    } catch {
      if (!mounted.current) return;
      setSearches((previous) =>
        previous[key]?.searchedFor !== query
          ? previous
          : { ...previous, [key]: { ...previous[key], status: "error", results: [] } }
      );
    }
  };

  const recheck = async ({ slot, index, kind, item }: ReviewEntry) => {
    const key = keyOf(slot, index);
    setChecking((previous) => ({ ...previous, [key]: "loading" }));
    try {
      const result = await reconcileEntities(candidatesFor(slot, item));
      if (!mounted.current) return;
      const current = getReviewItem(reviewRef.current, slot, index);
      const fresh = slot === "instructors" ? (result.instructors[0] ?? null) : result[slot];
      // The user kept editing or decided while the check ran; their change wins.
      const unchanged =
        current &&
        current.decision === item.decision &&
        JSON.stringify(current.candidate) === JSON.stringify(item.candidate);
      if (unchanged) {
        commit(setReviewItem(reviewRef.current, slot, index, applyRecheck(current, fresh)));
        setAnnouncement(`${KIND_LABEL[kind]} checked against existing records.`);
      }
      setChecking((previous) => ({ ...previous, [key]: undefined }));
    } catch {
      if (!mounted.current) return;
      setChecking((previous) => ({ ...previous, [key]: "error" }));
    }
  };

  const entries = listReviewEntries(review);

  return (
    <section className="entity-review" data-mode={mode} aria-labelledby={headingId}>
      <header className="entity-review__head">
        <h3 id={headingId}>Venue, organizer, instructors and school</h3>
        <p className="entity-review__intro">
          {isPublic
            ? "Check what was read from the flyer against places and people already listed. A moderator confirms anything new before it is added."
            : "Check what was read from the flyer against records already listed. Strong existing matches are selected automatically; new records need your choice. Undecided items are skipped on save."}
        </p>
      </header>
      <p className="entity-review__live" role="status" aria-live="polite">
        {announcement}
      </p>
      <fieldset className="entity-review__fieldset" disabled={disabled}>
        {SLOTS.map((slot) => {
          const kind = SLOT_KIND[slot];
          const label = KIND_LABEL[kind];
          const groupEntries = entries.filter((entry) => entry.slot === slot);
          const groupId = `${baseId}-${slot}`;
          const canAdd = slot === "instructors" || groupEntries.length === 0;
          return (
            <section className="entity-review__group" key={slot} aria-labelledby={groupId}>
              <h4 id={groupId} className="entity-review__group-title">
                {slot === "instructors" ? "Instructors" : label}
              </h4>
              {groupEntries.length === 0 && (
                <p className="entity-review__empty">
                  No {label.toLowerCase()} was found on the flyer.
                </p>
              )}
              {groupEntries.length > 0 && (
                <ul className="entity-review__list">
                  {groupEntries.map((entry) => (
                    <EntityItem
                      key={keyOf(entry.slot, entry.index)}
                      entry={entry}
                      idBase={`${baseId}-${keyOf(entry.slot, entry.index).replace(":", "-")}`}
                      isPublic={isPublic}
                      search={searches[keyOf(entry.slot, entry.index)] ?? IDLE_SEARCH}
                      checking={checking[keyOf(entry.slot, entry.index)]}
                      onEdit={(field, value) =>
                        updateItem(entry.slot, entry.index, (item) =>
                          editCandidateField(item, field, value)
                        )
                      }
                      onChoose={(match) =>
                        updateItem(
                          entry.slot,
                          entry.index,
                          (item) =>
                            item.selected_id === match.id
                              ? clearDecision(item)
                              : chooseExisting(item, match, { moderator: !isPublic }),
                          entry.item.selected_id === match.id
                            ? `Stopped using ${match.name}.`
                            : `Using existing ${kind} ${match.name}.`
                        )
                      }
                      onConfirmNew={() =>
                        updateItem(
                          entry.slot,
                          entry.index,
                          (item) =>
                            item.decision === "new"
                              ? clearDecision(item)
                              : confirmNew(item, { moderator: !isPublic }),
                          entry.item.decision === "new"
                            ? `${label} is undecided again.`
                            : isPublic
                              ? `${label} suggested as new.`
                              : `${label} will be added as new.`
                        )
                      }
                      onRemove={() => remove(entry)}
                      onRestore={() =>
                        updateItem(entry.slot, entry.index, clearDecision, `${label} restored.`)
                      }
                      onQuery={(query) => patchSearch(keyOf(entry.slot, entry.index), { query })}
                      onSearch={() => void search(entry)}
                      onRecheck={() => void recheck(entry)}
                    />
                  ))}
                </ul>
              )}
              {canAdd && (
                <AddEntity
                  kind={kind}
                  idBase={`${baseId}-add-${slot}`}
                  onAdd={(name) => add(slot, name)}
                />
              )}
            </section>
          );
        })}
      </fieldset>
    </section>
  );
}

type EntityItemProps = {
  entry: ReviewEntry;
  idBase: string;
  isPublic: boolean;
  search: SearchState;
  checking: "loading" | "error" | undefined;
  onEdit: (field: CandidateField, value: string) => void;
  onChoose: (match: EntityMatch) => void;
  onConfirmNew: () => void;
  onRemove: () => void;
  onRestore: () => void;
  onQuery: (query: string) => void;
  onSearch: () => void;
  onRecheck: () => void;
};

function EntityItem({
  entry,
  idBase,
  isPublic,
  search,
  checking,
  onEdit,
  onChoose,
  onConfirmNew,
  onRemove,
  onRestore,
  onQuery,
  onSearch,
  onRecheck,
}: EntityItemProps) {
  const { item, kind } = entry;
  const noun = KIND_LABEL[kind].toLowerCase();
  const name = item.candidate.name.trim();
  const copy = STATE_COPY[item.state];
  const Icon = STATE_ICON[item.state];
  const removed = item.decision === "removed";
  const isNew = item.decision === "new";
  const searchId = `${idBase}-search`;
  const searchStatusId = `${idBase}-search-status`;
  // The server will not create a record it cannot tell apart from another.
  // A public suggestion is only a hint to a moderator, so it is not gated.
  const canCreate = isPublic || hasCreationSignal(kind, item.candidate);
  // Two records can share a name (same-named people in different cities); the
  // buttons for those must differ by more than the name.
  const labelPool = [...item.matches, ...search.results];

  if (removed) {
    return (
      <li className="entity-review__item" data-decision="removed">
        <div role="group" aria-label={`${KIND_LABEL[kind]}: ${name || "unnamed"}`}>
          <p className="entity-review__removed">
            <X size={16} aria-hidden="true" />
            <span>
              <strong>{name || `Unnamed ${noun}`}</strong>
              <span className="entity-review__decision">{decisionSummary(item, kind)}</span>
            </span>
          </p>
          <div className="entity-review__actions">
            <button type="button" className="entity-review__btn" onClick={onRestore}>
              <Undo2 size={16} aria-hidden="true" />
              Undo remove {noun}
            </button>
          </div>
        </div>
      </li>
    );
  }

  return (
    <li className="entity-review__item" data-state={item.state} data-decision={item.decision}>
      <div role="group" aria-label={`${KIND_LABEL[kind]}: ${name || "unnamed"}`}>
        <div className="entity-review__top">
          <p className="entity-review__name">{name || `Unnamed ${noun}`}</p>
          <p className="entity-review__status" data-state={item.state}>
            <Icon size={16} aria-hidden="true" />
            <strong>{copy.label}</strong>
          </p>
        </div>
        <p className="entity-review__state-note">{copy.description}</p>
        <p className="entity-review__decision">
          {item.decision === "pending" ? null : <Check size={14} aria-hidden="true" />}
          {decisionSummary(item, kind)}
        </p>

        {item.matches.length > 0 && (
          <ul className="entity-review__matches" aria-label={`Existing ${noun} matches`}>
            {item.matches.map((match) => {
              const selected = item.selected_id === match.id && item.decision === "existing";
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
                    aria-pressed={selected}
                    aria-label={matchLabel(match, labelPool, noun, selected ? "Using" : "Use")}
                    onClick={() => onChoose(match)}
                  >
                    {selected && <Check size={16} aria-hidden="true" />}
                    {selected ? "Using this one" : "Use this one"}
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        <div className="entity-review__search">
          <label htmlFor={searchId}>Find a different existing {noun}</label>
          <div className="entity-review__search-row">
            <input
              id={searchId}
              type="search"
              value={search.query}
              placeholder={`Search ${noun}s by name`}
              aria-describedby={searchStatusId}
              onChange={(event) => onQuery(event.target.value)}
              onKeyDown={(event) => swallowEnter(event, onSearch)}
            />
            <button
              type="button"
              className="entity-review__btn"
              onClick={onSearch}
              disabled={!search.query.trim() || search.status === "loading"}
            >
              {search.status === "loading" ? (
                <Loader2 className="entity-review__spin" size={16} aria-hidden="true" />
              ) : (
                <Search size={16} aria-hidden="true" />
              )}
              Search {noun}s
            </button>
          </div>
          <p id={searchStatusId} className="entity-review__search-status">
            {search.status === "loading" && `Searching for “${search.searchedFor}”…`}
            {search.status === "error" && "Search is unavailable right now. Try again."}
            {search.status === "done" &&
              search.results.length === 0 &&
              `No existing ${noun}s found for “${search.searchedFor}”.`}
          </p>
          {search.status === "done" && search.results.length > 0 && (
            <ul className="entity-review__matches" aria-label={`Search results for ${noun}s`}>
              {search.results.map((match) => {
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
                      aria-label={matchLabel(match, labelPool, noun, "Use")}
                      onClick={() => onChoose(match)}
                    >
                      Use this one
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <details className="entity-review__edit">
          <summary>Edit {noun} details</summary>
          <div className="entity-review__fields">
            {(["name", ...FIELDS_BY_KIND[kind]] as CandidateField[]).map((field) => (
              <CandidateInput
                key={field}
                id={`${idBase}-${field}`}
                label={FIELD_LABEL[field]}
                value={item.candidate[field] ?? ""}
                required={field === "name"}
                onCommit={(value) => onEdit(field, value)}
              />
            ))}
          </div>
        </details>

        {checking === "error" && (
          <p className="entity-review__error" role="alert">
            We couldn’t check this {noun} against existing records. Review it by hand or try again.
          </p>
        )}

        {!canCreate && name && (
          <p className="entity-review__hint">
            To add a new {noun}, include {CREATION_SIGNAL_HINT[kind]} under Edit {noun} details.
            Otherwise choose an existing one or leave it undecided.
          </p>
        )}
        <div className="entity-review__actions">
          <button
            type="button"
            className="entity-review__btn entity-review__btn--primary"
            aria-pressed={isNew}
            disabled={!name || !canCreate}
            onClick={onConfirmNew}
          >
            {isNew && <Check size={16} aria-hidden="true" />}
            {isNew
              ? isPublic
                ? `Suggested as new ${noun}`
                : `Adding as new ${noun}`
              : isPublic
                ? `Suggest as new ${noun}`
                : `Add as new ${noun}`}
          </button>
          <button
            type="button"
            className="entity-review__btn"
            disabled={!name || checking === "loading"}
            onClick={onRecheck}
          >
            {checking === "loading" ? (
              <Loader2 className="entity-review__spin" size={16} aria-hidden="true" />
            ) : (
              <RefreshCw size={16} aria-hidden="true" />
            )}
            {item.state === "NEEDS REVIEW" ? "Check for matches" : "Check again"}
          </button>
          <button type="button" className="entity-review__btn" onClick={onRemove}>
            <X size={16} aria-hidden="true" />
            Remove {noun}
          </button>
        </div>
      </div>
    </li>
  );
}

type CandidateInputProps = {
  id: string;
  label: string;
  value: string;
  required: boolean;
  onCommit: (value: string) => void;
};

/**
 * A candidate's name can never be blank in the review, because a nameless
 * candidate is not a valid record anywhere downstream. While the person is
 * mid-edit the field keeps its own text; only a non-blank name is committed,
 * and leaving the field blank restores the last committed name.
 */
function CandidateInput({ id, label, value, required, onCommit }: CandidateInputProps) {
  const [text, setText] = useState(value);
  const [committed, setCommitted] = useState(value);
  if (value !== committed) {
    setCommitted(value);
    setText(value);
  }
  const blank = required && text.trim() === "";
  const errorId = `${id}-error`;
  return (
    <div className="entity-review__field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="text"
        value={text}
        required={required}
        autoComplete="off"
        aria-invalid={blank || undefined}
        aria-describedby={blank ? errorId : undefined}
        onChange={(event) => {
          setText(event.target.value);
          if (!required || event.target.value.trim()) onCommit(event.target.value);
        }}
        onBlur={() => {
          if (blank) setText(value);
        }}
        onKeyDown={(event) => swallowEnter(event)}
      />
      {blank && (
        <p id={errorId} className="entity-review__error">
          A name is required. Without one, the last name is kept.
        </p>
      )}
    </div>
  );
}

type AddEntityProps = {
  kind: EntityKind;
  idBase: string;
  onAdd: (name: string) => void;
};

function AddEntity({ kind, idBase, onAdd }: AddEntityProps) {
  const noun = KIND_LABEL[kind].toLowerCase();
  const [name, setName] = useState("");
  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onAdd(trimmed);
    setName("");
  };
  return (
    <div className="entity-review__add">
      <label htmlFor={idBase}>Add {noun} by name</label>
      <div className="entity-review__search-row">
        <input
          id={idBase}
          type="text"
          value={name}
          autoComplete="off"
          placeholder={`Name of the ${noun}`}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => swallowEnter(event, submit)}
        />
        <button
          type="button"
          className="entity-review__btn"
          disabled={!name.trim()}
          onClick={submit}
        >
          <Plus size={16} aria-hidden="true" />
          Add {noun}
        </button>
      </div>
    </div>
  );
}
