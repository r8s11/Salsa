/**
 * Filling event fields from an existing record the person just chose. Pure:
 * the person's own text always wins. A field is only filled when it is empty;
 * a typed value that differs from the record is kept and reported, never
 * replaced. The one exception is a field the choice itself names (the venue
 * name when a venue is picked), which follows the choice and is reported with
 * its previous value so it can be undone.
 */

export type PrefillProposal<F extends string> = {
  field: F;
  label: string;
  value: string | null | undefined;
  /** The chosen record names this field; it follows the choice. */
  follows?: boolean;
};

export type PrefillChange<F extends string> = {
  field: F;
  label: string;
  previous: string;
  next: string;
};

export type RecordPrefill<F extends string> = {
  /** What the record was, for the notice ("Linked to …"). */
  recordName: string;
  /** Fields that changed. */
  filled: PrefillChange<F>[];
  /** Fields left as typed although the record says something else. */
  kept: PrefillChange<F>[];
};

const same = (left: string, right: string) =>
  left.normalize("NFKC").replace(/\s+/g, " ").trim().toLocaleLowerCase() ===
  right.normalize("NFKC").replace(/\s+/g, " ").trim().toLocaleLowerCase();

export function prefillFromRecord<D extends Record<F, string>, F extends keyof D & string>(
  draft: D,
  recordName: string,
  proposals: readonly PrefillProposal<F>[]
): { draft: D; prefill: RecordPrefill<F> } {
  const next = { ...draft };
  const filled: PrefillChange<F>[] = [];
  const kept: PrefillChange<F>[] = [];
  for (const { field, label, value, follows } of proposals) {
    const proposed = (value ?? "").trim();
    if (!proposed) continue;
    const current = draft[field] ?? "";
    if (same(current, proposed)) continue;
    if (current.trim() === "" || follows) {
      next[field] = proposed as D[F];
      filled.push({ field, label, previous: current, next: proposed });
    } else {
      kept.push({ field, label, previous: current, next: proposed });
    }
  }
  return { draft: next, prefill: { recordName, filled, kept } };
}

/**
 * Reverts what a prefill filled. A field the person has edited since keeps
 * their edit: undo only puts back values that are still exactly as filled.
 */
export function undoPrefill<D extends Record<F, string>, F extends keyof D & string>(
  draft: D,
  prefill: RecordPrefill<F>
): D {
  const next = { ...draft };
  for (const change of prefill.filled) {
    if ((draft[change.field] ?? "") === change.next) next[change.field] = change.previous as D[F];
  }
  return next;
}

/**
 * Takes a record's value for one kept field, after the person asked for it.
 * The change moves from `kept` to `filled`, so a later undo reverts it too.
 */
export function acceptKeptValue<D extends Record<F, string>, F extends keyof D & string>(
  draft: D,
  prefill: RecordPrefill<F>,
  field: F
): { draft: D; prefill: RecordPrefill<F> } {
  const change = prefill.kept.find((entry) => entry.field === field);
  if (!change) return { draft, prefill };
  const previous = draft[field] ?? "";
  return {
    draft: { ...draft, [field]: change.next },
    prefill: {
      ...prefill,
      filled: [...prefill.filled, { ...change, previous }],
      kept: prefill.kept.filter((entry) => entry.field !== field),
    },
  };
}
