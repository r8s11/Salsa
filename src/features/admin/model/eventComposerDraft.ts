import type { AdminEventForm } from "./adminEventForm";
import { buildAdminFormFromEvent } from "./adminEventForm";
import { normalizeSubLocation } from "../../metros/model/sublocation";
import type { DatabaseEvent } from "../../events/model/types";
import { readStoredEntityReview } from "../../entity-matching/entityReviewState";
import { eventTypeFields, eventTypeFieldsFrom, selectedEventTypes } from "../../events/model/eventTypeSelection";

export type ComposerIntent = "draft" | "save" | "publish";
export type ComposerSaved = {
  id: string;
  status: DatabaseEvent["status"];
  publicUrl?: string;
  publicationError?: string;
};
export type ComposerRecovery = {
  version: 1;
  form: AdminEventForm;
  saved: ComposerSaved | null;
  edited: (keyof AdminEventForm)[];
};

export function readComposerRecovery(
  raw: string | null,
  initial: AdminEventForm
): ComposerRecovery | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    if (value?.version !== 1 || !value.form || !Array.isArray(value.edited)) return null;
    const form = { ...initial };
    for (const key of Object.keys(initial) as (keyof AdminEventForm)[]) {
      if (
        key === "entity_review" ||
        key === "event_type" ||
        key === "event_types" ||
        key === "sublocation"
      )
        continue;
      const field = value.form[key];
      if (Array.isArray(initial[key])) {
        if (!Array.isArray(field) || !field.every((item) => typeof item === "string")) return null;
      } else if (typeof field !== typeof initial[key]) return null;
      Object.assign(form, { [key]: field });
    }
    // Drafts saved before boroughs existed have none; a stale or non-NYC borough is dropped.
    const { sublocation } = value.form;
    if (sublocation !== undefined && typeof sublocation !== "string") return null;
    form.sublocation = normalizeSubLocation(form.city, sublocation) ?? "";
    // Drafts saved before multi-select carry only the primary; a missing list is not corruption.
    const { event_type, event_types } = value.form;
    if (event_type !== undefined && typeof event_type !== "string") return null;
    if (event_types !== undefined && !Array.isArray(event_types)) return null;
    Object.assign(form, eventTypeFieldsFrom({ event_type, event_types }));
    const review = readStoredEntityReview(value.form.entity_review);
    if (review) form.entity_review = review;
    const saved =
      value.saved &&
      typeof value.saved.id === "string" &&
      ["draft", "pending", "approved", "rejected", "cancelled", "archived"].includes(
        value.saved.status
      )
        ? ({ id: value.saved.id, status: value.saved.status } as ComposerSaved)
        : null;
    return {
      version: 1,
      form,
      saved,
      edited: value.edited.filter((key: string) => key in initial || key === "event_types"),
    };
  } catch {
    return null;
  }
}

type SeriesDefaults = {
  id: string;
  name: string;
  description?: string | null;
  image_url?: string | null;
  city?: string | null;
  venue_id?: string | null;
};

/** Series fills untouched gaps only. A date is never copied from an earlier occurrence. */
export function applySeriesToComposer(
  form: AdminEventForm,
  series: SeriesDefaults,
  source: DatabaseEvent | undefined,
  edited: ReadonlySet<keyof AdminEventForm>
): AdminEventForm {
  const previous = source ? buildAdminFormFromEvent(source) : null;
  const preserveVenue =
    Boolean(form.venue_id || form.location) || edited.has("venue_id") || edited.has("location");
  const reuseSourceVenue = !series.venue_id || series.venue_id === previous?.venue_id;
  const defaults: Partial<AdminEventForm> = {
    ...(previous ?? {}),
    title: previous?.title || series.name,
    description: series.description || previous?.description || "",
    image_url: series.image_url || previous?.image_url || "",
    city: series.city || previous?.city || form.city,
    venue_id: series.venue_id || previous?.venue_id || "",
    location: reuseSourceVenue ? previous?.location || "" : "",
    address: reuseSourceVenue ? previous?.address || "" : "",
  };
  if (defaults.entity_review && (preserveVenue || !reuseSourceVenue)) {
    defaults.entity_review = {
      ...defaults.entity_review,
      venue: form.entity_review?.venue ?? null,
    };
  }
  const next = { ...form, series_id: series.id };
  for (const key of Object.keys(defaults) as (keyof AdminEventForm)[]) {
    if (key === "event_type" || key === "event_types") continue;
    if (preserveVenue && ["venue_id", "location", "address"].includes(key)) continue;
    if (
      ["event_date", "series_id", "recurrence", "submitter_name", "submitter_email"].includes(
        key
      ) ||
      edited.has(key)
    )
      continue;
    const empty = !form[key] || (Array.isArray(form[key]) && form[key].length === 0);
    if (empty || key === "city") Object.assign(next, { [key]: defaults[key] });
  }
  // A borough only survives while the resolved city is still NYC.
  next.sublocation = normalizeSubLocation(next.city, next.sublocation) ?? "";
  // The primary and the full selection travel together: a deliberate (even empty)
  // selection is kept, otherwise the source occurrence supplies both.
  const typesEdited = edited.has("event_type") || edited.has("event_types");
  const ownTypes = selectedEventTypes(form);
  const sourceTypes = previous ? selectedEventTypes(previous) : [];
  Object.assign(
    next,
    eventTypeFields(!typesEdited && ownTypes.length === 0 ? sourceTypes : ownTypes)
  );
  return next;
}
