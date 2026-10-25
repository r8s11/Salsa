import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { useAccessibleDialog } from "../../../../shared/a11y/useAccessibleDialog";
import { searchEntityMatches } from "../../../entity-matching/entityReviewClient";
import type { EntityKind as MatchKind, EntityMatch } from "../../../entity-matching/entityReview";
import { searchVenues, createVenue } from "../../api/venuesRepo";
import type { VenueDetailRow, VenueForm, VenueRow } from "../../model/venuesQuery";
import {
  buildEmptyVenueForm,
  validateVenueForm,
  venueDisplayAddress,
} from "../../model/venuesQuery";
import {
  fetchAdminEntityDetail,
  fetchAdminEntityDirectory,
  saveAdminEntity,
} from "../../entities/api/entitiesRepo";
import {
  buildEntityForm,
  entityPayload,
  validateEntityForm,
  type EntityForm,
  type EntityKind,
} from "../../entities/model";
import type { AdminEntityRow } from "../../entities/model";
import "./ComposerEntitySelect.css";

export type ComposerEntityKind = "venue" | "organizer" | "instructor" | "school" | "series";
export type ComposerEntity = {
  id: string;
  name: string;
  address?: string | null;
  city?: string | null;
  image_url?: string | null;
  description?: string | null;
  venue_id?: string | null;
  organizer_id?: string | null;
  /** IANA zone of a venue entity; undefined when the source does not carry it. */
  timezone?: string | null;
};

interface ComposerEntitySelectProps {
  kind: ComposerEntityKind;
  value: ComposerEntity | null;
  onSelect: (entity: ComposerEntity | null) => void;
  city: string;
  disabled?: boolean;
  label?: string;
}

type SearchState = {
  query: string;
  status: "idle" | "loading" | "done" | "error";
  results: ComposerEntity[];
  error: string | null;
  requestKey?: string;
};
const LABELS: Record<ComposerEntityKind, string> = {
  venue: "Venue",
  organizer: "Organizer",
  instructor: "Instructor",
  school: "School",
  series: "Series",
};
const exactName = (left: string, right: string) =>
  left.trim().toLocaleLowerCase() === right.trim().toLocaleLowerCase();

function fromMatch(row: EntityMatch): ComposerEntity {
  return { id: row.id, name: row.name, address: row.address ?? null, city: row.city ?? null };
}
function fromVenue(row: VenueRow): ComposerEntity {
  return {
    id: row.id,
    name: row.name,
    address: venueDisplayAddress(row),
    city: row.city,
    timezone: row.timezone,
  };
}
function fromEntity(row: AdminEntityRow): ComposerEntity {
  return {
    id: row.id,
    name: row.name,
    address: row.address ?? row.address_line1 ?? null,
    city: row.city,
    image_url: row.image_url,
    description: row.description,
    venue_id: row.venue_id ?? null,
    organizer_id: row.organizer_id ?? null,
  };
}

export default function ComposerEntitySelect({
  kind,
  value,
  onSelect,
  city,
  disabled = false,
  label,
}: ComposerEntitySelectProps) {
  const labelText = label ?? LABELS[kind];
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const searchToken = useRef(0);
  const [query, setQuery] = useState("");
  const [searchResult, setSearch] = useState<SearchState>({
    query: "",
    status: "idle",
    results: [],
    error: null,
  });
  const [activeIndex, setActiveIndex] = useState(-1);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [entityForm, setEntityForm] = useState<EntityForm>(() => ({
    ...buildEntityForm(null),
    city,
    status: "active",
  }));
  const [venueForm, setVenueForm] = useState<VenueForm>(() => ({ ...buildEmptyVenueForm(), city }));
  const [acknowledged, setAcknowledged] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [searchAttempt, setSearchAttempt] = useState(0);
  const createName = createOpen ? name.trim() : "";
  const searchTerm = createOpen ? createName : query.trim();
  const selectedName = value?.name;
  const requestKey = `${kind}:${createOpen}:${searchAttempt}:${searchTerm}`;
  const search: SearchState =
    searchResult.requestKey === requestKey
      ? searchResult
      : {
          query: searchTerm,
          status: searchTerm.length < 2 ? "idle" : "loading",
          results: [],
          error: null,
        };
  const selectionGeneration = useRef(0);
  useEffect(
    () => () => {
      selectionGeneration.current += 1;
    },
    [kind, searchTerm, createOpen]
  );
  const createExact =
    createOpen && search.query === createName
      ? search.results.find((row) => exactName(row.name, createName))
      : undefined;
  const createPossible =
    createOpen && search.query === createName
      ? search.results.filter((row) => !exactName(row.name, createName))
      : [];
  const createSearchReady = createOpen && search.query === createName && search.status === "done";
  const duplicateForQuery = !createOpen && search.query === query.trim() ? search.results : [];
  const exactQueryMatch = duplicateForQuery.find((row) => exactName(row.name, query));
  const queryHasPossible = duplicateForQuery.some((row) => !exactName(row.name, query));
  const canCreateFromQuery =
    query.trim().length >= 2 &&
    search.query === query.trim() &&
    search.status === "done" &&
    !exactQueryMatch;

  useEffect(() => {
    const clean = searchTerm;
    const token = ++searchToken.current;
    if (clean.length < 2 || (selectedName && exactName(selectedName, clean))) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const request =
        kind === "venue"
          ? searchVenues(clean).then((rows) => rows.map(fromVenue))
          : kind === "series"
            ? fetchAdminEntityDirectory({ kind: "series", query: clean }).then((rows) =>
                rows.map(fromEntity)
              )
            : searchEntityMatches(kind as MatchKind, clean).then((rows) => rows.map(fromMatch));
      void request
        .then((results) => {
          if (!cancelled && token === searchToken.current)
            setSearch({ query: clean, status: "done", results, error: null, requestKey });
        })
        .catch(() => {
          if (!cancelled && token === searchToken.current)
            setSearch({
              query: clean,
              status: "error",
              results: [],
              error: "We couldn't search for existing records. Retry or choose a different name.",
              requestKey,
            });
        });
    }, 180);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [kind, searchTerm, selectedName, createOpen, searchAttempt, requestKey]);

  const dismissCreate = () => {
    if (!saving) {
      setCreateOpen(false);
      setCreateError(null);
      setAcknowledged(false);
    }
  };
  const {
    onKeyDown: dialogKeyDown,
    onBackdropClick,
    onDialogClick,
  } = useAccessibleDialog({
    dialogRef,
    onDismiss: dismissCreate,
    isBusy: saving,
    initialFocusRef: inputRef,
    isOpen: createOpen,
  });

  const selectEntity = async (entity: ComposerEntity): Promise<boolean> => {
    const generation = ++selectionGeneration.current;
    if (kind !== "series") {
      onSelect(entity);
      setQuery("");
      setSearch({ query: "", status: "idle", results: [], error: null });
      return true;
    }
    try {
      const detail = await fetchAdminEntityDetail("series", entity.id);
      if (generation !== selectionGeneration.current) return false;
      if (!detail) throw new Error("Series not found");
      onSelect(fromEntity(detail));
      setQuery("");
      setSearch({ query: "", status: "idle", results: [], error: null });
      return true;
    } catch {
      if (generation !== selectionGeneration.current) return false;
      setSearch({
        query,
        status: "error",
        results: [],
        error: "We couldn't load that series. Search again and retry.",
        requestKey,
      });
      return false;
    }
  };

  const openCreate = () => {
    if (!canCreateFromQuery) return;
    setName(query.trim());
    setEntityForm({ ...buildEntityForm(null), name: query.trim(), city, status: "active" });
    setVenueForm({ ...buildEmptyVenueForm(), name: query.trim(), city });
    setAcknowledged(false);
    setCreateError(null);
    setCreateOpen(true);
  };

  const createEntity = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (saving || !createSearchReady || createExact || (createPossible.length > 0 && !acknowledged))
      return;
    const validated =
      kind === "venue" ? validateVenueForm(venueForm) : validateEntityForm(entityForm);
    if (validated) {
      setCreateError(validated);
      return;
    }
    setSaving(true);
    setCreateError(null);
    try {
      const row =
        kind === "venue"
          ? await createVenue(venueForm)
          : await saveAdminEntity(
              kind as EntityKind,
              null,
              entityPayload(kind as EntityKind, { ...entityForm, name, status: "active" })
            );
      const selected =
        kind === "venue" ? fromVenue(row as VenueDetailRow) : fromEntity(row as AdminEntityRow);
      onSelect(selected);
      setCreateOpen(false);
      setQuery("");
      setSearch({ query: "", status: "idle", results: [], error: null });
    } catch (error) {
      setCreateError(
        error instanceof Error ? error.message : `Couldn't create ${labelText.toLowerCase()}.`
      );
    } finally {
      setSaving(false);
    }
  };

  const updateEntityField = (field: keyof EntityForm, next: string) =>
    setEntityForm((previous) => ({ ...previous, [field]: next }));
  const updateVenueField = (field: keyof VenueForm, next: string) =>
    setVenueForm((previous) => ({ ...previous, [field]: next }));
  const root = createOpen
    ? (document.querySelector<HTMLElement>(".admin-shell") ?? document.body)
    : null;
  const dialog =
    createOpen && root
      ? createPortal(
          <div className="composer-entity__overlay" onClick={onBackdropClick}>
            <div
              ref={dialogRef}
              className="composer-entity__dialog admin-card"
              role="dialog"
              aria-modal="true"
              aria-labelledby={`${id}-title`}
              onKeyDown={dialogKeyDown}
              onClick={onDialogClick}
            >
              <form onSubmit={createEntity} onClick={(event) => event.stopPropagation()}>
                <h2 id={`${id}-title`}>Create {LABELS[kind].toLowerCase()}</h2>
                <p className="composer-entity__intro">
                  Check existing records before adding a new one.
                </p>
                <div className="composer-entity__fields">
                  <label className="admin-field">
                    <span>Name</span>
                    <input
                      ref={inputRef}
                      className="admin-input"
                      value={name}
                      onChange={(event) => {
                        setName(event.target.value);
                        setEntityForm((form) => ({ ...form, name: event.target.value }));
                        setVenueForm((form) => ({ ...form, name: event.target.value }));
                        setAcknowledged(false);
                      }}
                      required
                    />
                  </label>
                  <label className="admin-field">
                    <span>City</span>
                    <input
                      className="admin-input"
                      value={kind === "venue" ? venueForm.city : entityForm.city}
                      onChange={(event) =>
                        kind === "venue"
                          ? updateVenueField("city", event.target.value)
                          : updateEntityField("city", event.target.value)
                      }
                    />
                  </label>
                  {kind === "venue" ? (
                    <>
                      <label className="admin-field">
                        <span>Street address</span>
                        <input
                          className="admin-input"
                          value={venueForm.address_line1}
                          onChange={(event) =>
                            updateVenueField("address_line1", event.target.value)
                          }
                          required
                        />
                      </label>
                      <label className="admin-field">
                        <span>State / region</span>
                        <input
                          className="admin-input"
                          value={venueForm.state_region}
                          onChange={(event) => updateVenueField("state_region", event.target.value)}
                          required
                        />
                      </label>
                      <label className="admin-field">
                        <span>Website</span>
                        <input
                          className="admin-input"
                          type="url"
                          value={venueForm.website}
                          onChange={(event) => updateVenueField("website", event.target.value)}
                        />
                      </label>
                      <label className="admin-field">
                        <span>Phone</span>
                        <input
                          className="admin-input"
                          type="tel"
                          value={venueForm.phone}
                          onChange={(event) => updateVenueField("phone", event.target.value)}
                        />
                      </label>
                    </>
                  ) : kind === "organizer" ? (
                    <>
                      <label className="admin-field">
                        <span>Website</span>
                        <input
                          className="admin-input"
                          type="url"
                          value={entityForm.website}
                          onChange={(event) => updateEntityField("website", event.target.value)}
                        />
                      </label>
                      <label className="admin-field">
                        <span>Contact Instagram</span>
                        <input
                          className="admin-input"
                          value={entityForm.instagram}
                          onChange={(event) => updateEntityField("instagram", event.target.value)}
                        />
                      </label>
                    </>
                  ) : kind === "school" ? (
                    <>
                      <label className="admin-field">
                        <span>Address</span>
                        <input
                          className="admin-input"
                          value={entityForm.address}
                          onChange={(event) => updateEntityField("address", event.target.value)}
                        />
                      </label>
                      <label className="admin-field">
                        <span>Website</span>
                        <input
                          className="admin-input"
                          type="url"
                          value={entityForm.website}
                          onChange={(event) => updateEntityField("website", event.target.value)}
                        />
                      </label>
                      <label className="admin-field">
                        <span>Phone</span>
                        <input
                          className="admin-input"
                          type="tel"
                          value={entityForm.phone}
                          onChange={(event) => updateEntityField("phone", event.target.value)}
                        />
                      </label>
                    </>
                  ) : kind === "instructor" ? (
                    <>
                      <label className="admin-field">
                        <span>Organization</span>
                        <input
                          className="admin-input"
                          value={entityForm.organization}
                          onChange={(event) =>
                            updateEntityField("organization", event.target.value)
                          }
                        />
                      </label>
                      <label className="admin-field">
                        <span>Instagram</span>
                        <input
                          className="admin-input"
                          value={entityForm.instagram}
                          onChange={(event) => updateEntityField("instagram", event.target.value)}
                        />
                      </label>
                    </>
                  ) : (
                    <>
                      <label className="admin-field">
                        <span>Description</span>
                        <textarea
                          className="admin-input"
                          value={entityForm.description}
                          onChange={(event) => updateEntityField("description", event.target.value)}
                        />
                      </label>
                      <label className="admin-field">
                        <span>Image URL</span>
                        <input
                          className="admin-input"
                          type="url"
                          value={entityForm.image_url}
                          onChange={(event) => updateEntityField("image_url", event.target.value)}
                        />
                      </label>
                    </>
                  )}
                </div>
                <div className="composer-entity__duplicates" aria-live="polite">
                  {search.status === "loading" && <p>Checking for existing records…</p>}
                  {search.query === name.trim() && search.status === "error" && (
                    <div role="alert">
                      <p>{search.error}</p>
                      <button
                        type="button"
                        className="admin-btn admin-btn--secondary"
                        onClick={() => setSearchAttempt((attempt) => attempt + 1)}
                      >
                        Try search again
                      </button>
                    </div>
                  )}
                  {createExact && (
                    <div>
                      <p>
                        An exact match already exists. Select it instead of creating another record.
                      </p>
                      <button
                        type="button"
                        className="composer-entity__match"
                        onClick={async () => {
                          if (await selectEntity(createExact)) setCreateOpen(false);
                        }}
                      >
                        {createExact.name}
                      </button>
                    </div>
                  )}
                  {createPossible.length > 0 && (
                    <>
                      <p>Possible matches</p>
                      {createPossible.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className="composer-entity__match"
                          onClick={async () => {
                            if (await selectEntity(item)) setCreateOpen(false);
                          }}
                        >
                          {item.name}
                          {item.city ? ` · ${item.city}` : ""}
                        </button>
                      ))}
                      <label className="composer-entity__ack">
                        <input
                          type="checkbox"
                          checked={acknowledged}
                          onChange={(event) => setAcknowledged(event.target.checked)}
                        />{" "}
                        I checked these records; this is not a duplicate.
                      </label>
                    </>
                  )}
                </div>
                {createError && (
                  <p className="admin-banner admin-banner--error" role="alert">
                    {createError}
                  </p>
                )}
                <div className="composer-entity__actions">
                  <button
                    type="button"
                    className="admin-btn admin-btn--secondary"
                    onClick={dismissCreate}
                    disabled={saving}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="admin-btn admin-btn--primary"
                    disabled={
                      saving ||
                      !createSearchReady ||
                      Boolean(createExact) ||
                      (createPossible.length > 0 && !acknowledged)
                    }
                  >
                    {saving ? "Creating…" : `Save new ${LABELS[kind].toLowerCase()}`}
                  </button>
                </div>
              </form>
            </div>
          </div>,
          root
        )
      : null;

  const keyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown" && search.status === "done" && duplicateForQuery.length) {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % duplicateForQuery.length);
    } else if (event.key === "ArrowUp" && search.status === "done" && duplicateForQuery.length) {
      event.preventDefault();
      setActiveIndex((current) => (current <= 0 ? duplicateForQuery.length - 1 : current - 1));
    } else if (event.key === "Enter" && activeIndex >= 0 && duplicateForQuery[activeIndex]) {
      event.preventDefault();
      void selectEntity(duplicateForQuery[activeIndex]);
    } else if (event.key === "Escape") {
      setQuery("");
      setActiveIndex(-1);
    }
  };

  return (
    <div className="composer-entity">
      <label htmlFor={`${id}-search`} className="admin-field__label">
        {labelText}
      </label>
      {value ? (
        <div className="composer-entity__selected">
          <span>
            {value.name}
            {value.city ? ` · ${value.city}` : ""}
          </span>
          <button
            type="button"
            className="composer-entity__clear"
            aria-label={`Remove ${labelText.toLowerCase()}`}
            onClick={() => onSelect(null)}
            disabled={disabled}
          >
            Change
          </button>
        </div>
      ) : (
        <>
          <input
            id={`${id}-search`}
            ref={inputRef}
            className="admin-input"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={duplicateForQuery.length > 0}
            aria-controls={`${id}-results`}
            aria-activedescendant={activeIndex >= 0 ? `${id}-option-${activeIndex}` : undefined}
            aria-label={labelText}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(-1);
            }}
            onKeyDown={keyDown}
            autoComplete="off"
            disabled={disabled}
          />
          {duplicateForQuery.length > 0 && (
            <ul
              id={`${id}-results`}
              className="composer-entity__results"
              role="listbox"
              aria-label={`${labelText} results`}
            >
              {duplicateForQuery.map((item, index) => (
                <li
                  id={`${id}-option-${index}`}
                  key={item.id}
                  role="option"
                  aria-selected={activeIndex === index}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => void selectEntity(item)}
                >
                  {item.name}
                  {item.city ? ` · ${item.city}` : ""}
                  {item.address ? <small>{item.address}</small> : null}
                </li>
              ))}
            </ul>
          )}
          {search.query === query && search.status === "error" && (
            <div role="alert">
              <p className="composer-entity__error">{search.error}</p>
              <button
                type="button"
                className="composer-entity__create"
                onClick={() => setSearchAttempt((attempt) => attempt + 1)}
              >
                Try search again
              </button>
            </div>
          )}
          {canCreateFromQuery && (
            <button type="button" className="composer-entity__create" onClick={openCreate}>
              Create {LABELS[kind].toLowerCase()} “{query.trim()}”
            </button>
          )}
          {queryHasPossible && (
            <p className="composer-entity__hint">Review possible matches before creating.</p>
          )}
        </>
      )}
      {dialog}
    </div>
  );
}
