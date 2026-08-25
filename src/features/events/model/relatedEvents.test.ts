import { DatabaseEvent, City } from './types';
import { RelatedEventsSelection, selectRelatedEvents } from './relatedEvents';

// Factory for a complete DatabaseEvent with sensible defaults
const makeEvent = (overrides: Partial<DatabaseEvent> = {}): DatabaseEvent => ({
  id: 'default-id',
  title: 'Default Event',
  description: null,
  event_type: 'social',
  event_date: '2026-08-24T12:00:00.000Z', // today at noon UTC
  event_time: null,
  location: null,
  address: null,
  price_type: 'free',
  price_amount: null,
  rsvp_link: null,
  image_url: null,
  submitter_name: null,
  submitter_email: null,
  submitter_id: null,
  status: 'approved',
  source_type: 'user_submission',
  taxonomy_term_ids: [],
  taxonomy_terms: [],
  updated_at: '2026-08-24T12:00:00.000Z',
  cancellation_reason: null,
  city: 'boston' as City,
  created_at: '2026-08-24T12:00:00.000Z',
  host: null,
  recurrence: null,
  gallery: null,
  contact_email: null,
  contact_instagram: null,
  contact_website: null,
  venue_id: null,
  ...overrides,
});

describe('selectRelatedEvents', () => {
  const current = makeEvent({ id: 'current', city: 'boston' as City, event_date: '2026-08-24T12:00:00.000Z' });

  it('selects up to three later same-city events inside seven days', () => {
    const sameDay = makeEvent({ id: 'sameDay', city: 'boston' as City, event_date: '2026-08-24T18:00:00.000Z' });
    const withinWeek = makeEvent({ id: 'withinWeek', city: 'boston' as City, event_date: '2026-08-30T12:00:00.000Z' });
    const beyondWeek = makeEvent({ id: 'beyondWeek', city: 'boston' as City, event_date: '2026-09-01T12:00:00.000Z' });
    const otherCity = makeEvent({ id: 'otherCity', city: 'new-york-city' as City, event_date: '2026-08-25T12:00:00.000Z' });

    const selection = selectRelatedEvents(current, [current, sameDay, withinWeek, beyondWeek, otherCity]);

    expect(selection.events.map((event) => event.id)).toEqual([sameDay.id, withinWeek.id]);
    expect(selection.hasStrictWindowEvents).toBe(true);
  });

  it('backfills chronological later events after strict-window results', () => {
    // strict: within 7 days, lateThird: later than lateSecond but we want chronological order so lateSecond then lateThird
    const strict = makeEvent({ id: 'strict', city: 'boston' as City, event_date: '2026-08-25T12:00:00.000Z' });
    const lateSecond = makeEvent({ id: 'lateSecond', city: 'boston' as City, event_date: '2026-08-26T12:00:00.000Z' });
    const lateThird = makeEvent({ id: 'lateThird', city: 'boston' as City, event_date: '2026-08-27T12:00:00.000Z' });
    const invalidDate = makeEvent({ id: 'invalidDate', city: 'boston' as City, event_date: 'invalid-date' as unknown as string });
    const cancelled = makeEvent({ id: 'cancelled', city: 'boston' as City, status: 'cancelled', event_date: '2026-08-28T12:00:00.000Z' });

    const selection = selectRelatedEvents(current, [strict, lateThird, lateSecond, invalidDate, cancelled]);

    // Note: The candidates array order is [strict, lateThird, lateSecond, invalidDate, cancelled]
    // After filtering and sorting by event_date, we should get: strict, lateSecond, lateThird
    expect(selection.events.map((event) => event.id)).toEqual([strict.id, lateSecond.id, lateThird.id]);
    expect(selection.hasStrictWindowEvents).toBe(true);
  });

  it('returns empty selection when no other approved future same-city event exists', () => {
    const past = makeEvent({ id: 'past', city: 'boston' as City, event_date: '2026-08-23T12:00:00.000Z' });
    const otherCity = makeEvent({ id: 'otherCity', city: 'new-york-city' as City, event_date: '2026-08-25T12:00:00.000Z' });
    const cancelled = makeEvent({ id: 'cancelled', city: 'boston' as City, status: 'cancelled', event_date: '2026-08-25T12:00:00.000Z' });

    const selection = selectRelatedEvents(current, [current, past, otherCity, cancelled]);

    expect(selection.events).toEqual([]);
    expect(selection.hasStrictWindowEvents).toBe(false);
  });

  it('excludes current event from candidates', () => {
    const sameDay = makeEvent({ id: 'sameDay', city: 'boston' as City, event_date: '2026-08-24T18:00:00.000Z' });
    const selection = selectRelatedEvents(current, [current, sameDay]);
    expect(selection.events.map((e) => e.id)).toEqual([sameDay.id]);
  });

  it('only considers approved events', () => {
    const pending = makeEvent({ id: 'pending', city: 'boston' as City, status: 'pending', event_date: '2026-08-25T12:00:00.000Z' });
    const rejected = makeEvent({ id: 'rejected', city: 'boston' as City, status: 'rejected', event_date: '2026-08-25T12:00:00.000Z' });
    const archived = makeEvent({ id: 'archived', city: 'boston' as City, status: 'archived', event_date: '2026-08-25T12:00:00.000Z' });
    const draft = makeEvent({ id: 'draft', city: 'boston' as City, status: 'draft', event_date: '2026-08-25T12:00:00.000Z' });
    const approved = makeEvent({ id: 'approved', city: 'boston' as City, status: 'approved', event_date: '2026-08-25T12:00:00.000Z' });

    const selection = selectRelatedEvents(current, [current, pending, rejected, archived, draft, approved]);
    expect(selection.events.map((e) => e.id)).toEqual([approved.id]);
  });

  it('only considers future events (strictly later than current)', () => {
    const sameTime = makeEvent({ id: 'sameTime', city: 'boston' as City, event_date: '2026-08-24T12:00:00.000Z' });
    const oneSecondLater = makeEvent({ id: 'oneSecondLater', city: 'boston' as City, event_date: '2026-08-24T12:00:01.000Z' });
    const selection = selectRelatedEvents(current, [current, sameTime, oneSecondLater]);
    expect(selection.events.map((e) => e.id)).toEqual([oneSecondLater.id]);
  });

  it('limits to three events', () => {
    const events = Array.from({ length: 5 }, (_, i) =>
      makeEvent({ id: `event${i}`, city: 'boston' as City, event_date: new Date(Date.parse(current.event_date) + (i + 1) * 3600000).toISOString() })
    );
    const selection = selectRelatedEvents(current, events);
    expect(selection.events.length).toBe(Math.min(3, events.length));
    expect(selection.hasStrictWindowEvents).toBe(true); // all within 7 days
  });

  it('hasStrictWindowEvents is false when no events within 7 days', () => {
    const justOutside = makeEvent({ id: 'justOutside', city: 'boston' as City, event_date: new Date(Date.parse(current.event_date) + 8 * 24 * 3600000).toISOString() }); // 8 days later
    const selection = selectRelatedEvents(current, [justOutside]);
    expect(selection.events.length).toBe(1);
    expect(selection.hasStrictWindowEvents).toBe(false);
  });

  it('handles invalid event_date gracefully', () => {
    const invalid = makeEvent({ id: 'invalid', city: 'boston' as City, event_date: 'not-a-date' as unknown as string });
    const valid = makeEvent({ id: 'valid', city: 'boston' as City, event_date: '2026-08-25T12:00:00.000Z' });
    const selection = selectRelatedEvents(current, [invalid, valid]);
    expect(selection.events.map((e) => e.id)).toEqual([valid.id]);
  });
});