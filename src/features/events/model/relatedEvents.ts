import type { DatabaseEvent } from './types';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function eventTime(value: string): number | null {
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : time;
}

export interface RelatedEventsSelection {
  events: DatabaseEvent[];
  hasStrictWindowEvents: boolean;
}

export function selectRelatedEvents(
  current: Pick<DatabaseEvent, 'id' | 'city' | 'event_date'>,
  candidates: readonly DatabaseEvent[]
): RelatedEventsSelection {
  const currentTime = eventTime(current.event_date);
  if (currentTime === null) return { events: [], hasStrictWindowEvents: false };

  const future = candidates
    .filter((event) => {
      const time = eventTime(event.event_date);
      return event.id !== current.id && event.status === 'approved' && event.city === current.city && time !== null && time > currentTime;
    });

  const strict = future.filter((event) => Date.parse(event.event_date) <= currentTime + SEVEN_DAYS_MS);
  const beyond = future.filter((event) => Date.parse(event.event_date) > currentTime + SEVEN_DAYS_MS);

  const sortedStrict = strict.sort((a, b) => Date.parse(a.event_date) - Date.parse(b.event_date));
  const sortedBeyond = beyond.sort((a, b) => Date.parse(a.event_date) - Date.parse(b.event_date));

  const strictTake = sortedStrict.slice(0, 3);
  const beyondTake = sortedBeyond.slice(0, 3 - strictTake.length);
  const events = [...strictTake, ...beyondTake];
  const hasStrictWindowEvents = strictTake.length > 0;

  return {
    events,
    hasStrictWindowEvents,
  };
}