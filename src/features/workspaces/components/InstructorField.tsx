import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import type { PublicEntityRef } from "../../entities/model";
import { ARTIST_SEARCH_MIN_LENGTH, useArtistSearch } from "../hooks/useArtistSearch";
import WorkspaceField from "./WorkspaceField";
import "./InstructorField.css";

/** What the form stores: a linked artist (`id` set) or a plain display name (`id` empty). */
export type InstructorValue = { id: string; name: string };

type InstructorFieldProps = {
  value: InstructorValue;
  onChange: (next: InstructorValue) => void;
  error?: string;
};

const SEARCH_DELAY_MS = 250;

function artistMeta(artist: PublicEntityRef): string {
  const place = [artist.city, artist.state_region].filter(Boolean).join(", ");
  const about = artist.description?.trim();
  const snippet = about ? (about.length > 80 ? `${about.slice(0, 79)}…` : about) : "";
  return [place || "No city listed", snippet].filter(Boolean).join(" · ");
}

/**
 * The Instructor control of a school offering. It is in exactly one of two
 * states, and only an explicit action moves it between them:
 *
 * - linked: the offering points at an artist's page. The name is read-only and
 *   "Unlink" is the way out (the name is kept as plain text to edit or clear).
 * - plain text: the typed name is just a display name. Matching results from the
 *   artist directory are offered while typing, but nothing links until one is
 *   picked, and typing never creates an artist.
 */
export default function InstructorField({ value, onChange, error }: InstructorFieldProps) {
  const listId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const linked = value.id !== "";

  // Search only once the user has typed; opening a form must not fire requests.
  const [armed, setArmed] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [settledTerm, setSettledTerm] = useState("");

  const term = value.name.trim();
  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setSettledTerm(term), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [armed, term]);

  const searching = armed && !linked && term.length >= ARTIST_SEARCH_MIN_LENGTH;
  const search = useArtistSearch(settledTerm, searching && settledTerm === term);
  const settled = settledTerm === term;
  const results = search.data ?? [];
  const showList = searching && open && settled && !search.isError && results.length > 0;

  const choose = (artist: PublicEntityRef) => {
    onChange({ id: artist.id, name: artist.name });
    setArmed(false);
    setOpen(false);
    setActive(-1);
  };

  const unlink = () => {
    onChange({ id: "", name: value.name });
    setArmed(false);
    inputRef.current?.focus();
  };

  const type = (name: string) => {
    onChange({ id: "", name });
    setArmed(true);
    setOpen(true);
    setActive(-1);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (linked) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      if (results.length === 0 || !searching || !settled) return;
      event.preventDefault();
      if (!showList) {
        setOpen(true);
        setActive(event.key === "ArrowDown" ? 0 : results.length - 1);
        return;
      }
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActive((index) => (index + step + results.length) % results.length);
    } else if (event.key === "Enter" && showList && active >= 0) {
      event.preventDefault();
      choose(results[active]);
    } else if (event.key === "Escape" && showList) {
      // Closes the results, not the whole form.
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      setActive(-1);
    }
  };

  let status: { text: string; role: "status" | "alert" } | null = null;
  if (searching && open) {
    if (search.isError) {
      status = { text: "Couldn’t search artists right now. You can still save this as a plain name.", role: "alert" };
    } else if (!settled || search.isFetching) {
      status = { text: "Searching artists…", role: "status" };
    } else if (results.length === 0) {
      status = {
        text: `No artist matches “${term}”. It will be saved as a plain name, with no link.`,
        role: "status",
      };
    }
  }

  return (
    <WorkspaceField
      label="Instructor"
      error={error}
      hint={
        linked
          ? "Linked to this artist’s page. Unlink to use a plain name instead."
          : "Search to link an artist’s page, or just type a name to show without a link."
      }
    >
      {(control) => (
        <div
          ref={wrapRef}
          className="instructor-field"
          onBlur={(event) => {
            if (!wrapRef.current?.contains(event.relatedTarget)) setOpen(false);
          }}
        >
          <div className="instructor-field__row">
            <input
              {...control}
              ref={inputRef}
              className="admin-input"
              autoComplete="off"
              value={linked ? value.name || "Linked artist" : value.name}
              readOnly={linked}
              onChange={(event) => type(event.target.value)}
              onKeyDown={onKeyDown}
              {...(linked
                ? {}
                : {
                    role: "combobox",
                    "aria-autocomplete": "list" as const,
                    "aria-expanded": showList,
                    "aria-controls": listId,
                    "aria-activedescendant": showList && active >= 0 ? `${listId}-${active}` : undefined,
                  })}
            />
            {linked && (
              <button
                type="button"
                className="desk__action"
                aria-label={`Unlink ${value.name || "artist"}`}
                onClick={unlink}
              >
                Unlink
              </button>
            )}
          </div>
          {linked && <p className="instructor-field__linked">Linked artist</p>}
          {status && (
            <p className="instructor-field__status" role={status.role}>
              {status.text}
              {search.isError && (
                <>
                  {" "}
                  <button type="button" className="desk__action" onClick={() => void search.refetch()}>
                    Try again
                  </button>
                </>
              )}
            </p>
          )}
          <ul
            id={listId}
            className="instructor-field__results"
            role="listbox"
            aria-label="Matching artists"
            hidden={!showList}
          >
            {showList &&
              results.map((artist, index) => (
                <li
                  key={artist.id}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={index === active}
                  className="instructor-field__option"
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(artist)}
                >
                  <span className="instructor-field__name">{artist.name}</span>
                  <span className="instructor-field__meta">{artistMeta(artist)}</span>
                </li>
              ))}
          </ul>
        </div>
      )}
    </WorkspaceField>
  );
}
