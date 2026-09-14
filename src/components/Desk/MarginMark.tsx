/**
 * Copy-desk proof marks. The hanging margin of every listing carries one,
 * so a column of marks reads vertically as the state of the whole week
 * before a single word is read.
 *
 * Drawn as geometry rather than glyphs: these are marks, not characters,
 * and they must hold their weight against agate type at 13px.
 */

import { DESK_STATE_LABEL, type DeskState } from "./deskModel";

interface MarginMarkProps {
  state: DeskState;
  /**
   * Marks are redundant with adjacent text on most rows. Keep them out of
   * the accessibility tree there, and label them only where the mark is the
   * sole carrier of state.
   */
  labelled?: boolean;
}

export default function MarginMark({ state, labelled = false }: MarginMarkProps) {
  const label = DESK_STATE_LABEL[state];

  return (
    <svg
      className="desk-mark"
      width="14"
      height="14"
      viewBox="0 0 14 14"
      role={labelled ? "img" : undefined}
      aria-label={labelled ? label : undefined}
      aria-hidden={labelled ? undefined : true}
      style={{ color: `var(--desk-${state})` }}
      focusable="false"
    >
      {state === "unset" && (
        /* An open ring: the entry is still to be resolved. */
        <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.75" />
      )}
      {state === "set" && (
        /* Set: the mark closes. */
        <circle cx="7" cy="7" r="4.5" fill="currentColor" />
      )}
      {state === "killed" && (
        /* The spike: a struck entry. */
        <path d="M2.5 11.5 11.5 2.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      )}
      {state === "standing" && (
        /* Standing type: held, not yet sent up. */
        <rect
          x="2.75"
          y="2.75"
          width="8.5"
          height="8.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
        />
      )}
      {state === "tonight" && (
        /* Running tonight: closed mark inside a ring. */
        <>
          <circle cx="7" cy="7" r="6" fill="none" stroke="currentColor" strokeWidth="1.25" />
          <circle cx="7" cy="7" r="2.75" fill="currentColor" />
        </>
      )}
    </svg>
  );
}
