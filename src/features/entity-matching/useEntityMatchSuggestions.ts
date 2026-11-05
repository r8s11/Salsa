import { useEffect, useState } from "react";
import type { EntityKind, EntityMatch } from "./entityReview";
import { searchEntityMatches } from "./entityReviewClient";

export const SUGGESTION_DELAY_MS = 350;
const MIN_QUERY_LENGTH = 2;

export type MatchSuggestions = {
  /** `idle`: nothing to look up; `loading` also covers the debounce wait. */
  status: "idle" | "loading" | "done" | "error";
  matches: EntityMatch[];
  query: string;
  retry: () => void;
};

type Settled = { matches: EntityMatch[] } | { error: true };

/**
 * Existing records whose names resemble what the person is typing. One request
 * per pause in typing (debounced), answers cached per query so retyping or
 * backspacing never asks twice, and an answer for an older query never shows
 * against newer text. `enabled: false` (signed-out visitors, or a field that is
 * already linked) skips the lookup entirely.
 */
export function useEntityMatchSuggestions(
  kind: EntityKind,
  text: string,
  { enabled = true }: { enabled?: boolean } = {}
): MatchSuggestions {
  const query = text.replace(/\s+/g, " ").trim();
  const key = `${kind}:${query.toLocaleLowerCase()}`;
  const active = enabled && query.length >= MIN_QUERY_LENGTH;
  const [settled, setSettled] = useState<Record<string, Settled>>({});
  const known = settled[key];

  useEffect(() => {
    if (!active || known) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      Promise.resolve()
        .then(() => searchEntityMatches(kind, query))
        .then(
          (matches) => {
            // Cache even when superseded: the same text may come back.
            const found = Array.isArray(matches) ? matches : [];
            setSettled((previous) => ({ ...previous, [key]: { matches: found } }));
          },
          () => {
            if (!cancelled) setSettled((previous) => ({ ...previous, [key]: { error: true } }));
          }
        );
    }, SUGGESTION_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [active, known, kind, query, key]);

  const retry = () =>
    setSettled((previous) => {
      const next = { ...previous };
      delete next[key];
      return next;
    });

  if (!active) return { status: "idle", matches: [], query, retry };
  if (!known) return { status: "loading", matches: [], query, retry };
  if ("error" in known) return { status: "error", matches: [], query, retry };
  return { status: "done", matches: known.matches, query, retry };
}
