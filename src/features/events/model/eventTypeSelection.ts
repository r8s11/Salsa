import { getEventTypes, isEventType, type EventType } from "./types";

/**
 * The two draft fields that together describe an event's categories.
 * `event_types` is the full ordered selection; `event_type` is its first
 * member (the primary, which picks the calendar color) or "" when empty.
 * They are always written together so they cannot disagree.
 */
export type EventTypeFields = {
  event_type: EventType | "";
  event_types: EventType[];
};

/** Valid, de-duplicated, order-preserving selection from arbitrary input. */
export function normalizeEventTypes(values: readonly unknown[]): EventType[] {
  return [...new Set(values.filter(isEventType))];
}

export function eventTypeFields(types: readonly EventType[]): EventTypeFields {
  const event_types = normalizeEventTypes(types);
  return { event_type: event_types[0] ?? "", event_types };
}

/** Selection of a draft-like value, ignoring any unsupported stored strings. */
export function selectedEventTypes(source: {
  event_type: EventType | "";
  event_types?: readonly EventType[];
}): EventType[] {
  return normalizeEventTypes(getEventTypes(source));
}

/**
 * Adds a type at the end of the selection, or removes it. The first selected
 * type is the primary, so removing it promotes the next one.
 */
export function toggleEventType(
  source: { event_type: EventType | ""; event_types?: readonly EventType[] },
  type: EventType
): EventTypeFields {
  const current = selectedEventTypes(source);
  return eventTypeFields(
    current.includes(type) ? current.filter((item) => item !== type) : [...current, type]
  );
}

/** Rebuilds both fields from any persisted/recovered record, tolerating a missing array. */
export function eventTypeFieldsFrom(source: {
  event_type?: unknown;
  event_types?: unknown;
}): EventTypeFields {
  const listed = normalizeEventTypes(Array.isArray(source.event_types) ? source.event_types : []);
  return eventTypeFields(listed.length ? listed : normalizeEventTypes([source.event_type]));
}

/**
 * Event-type part of every outgoing payload. The primary is always the first
 * selection so `event_type` and `event_types[0]` agree even if a draft was
 * hand-assembled with a stale primary.
 */
export function eventTypePayload(source: {
  event_type: EventType | "";
  event_types?: readonly EventType[];
}): { event_type: EventType; event_types: EventType[] } {
  const event_types = selectedEventTypes(source);
  if (event_types.length === 0) throw new Error("Choose at least one event type.");
  return { event_type: event_types[0], event_types };
}
