// Weekly returning dancers, from cookieless Umami data.
//
// A dancer is an Umami visitor (session) who opened at least one event in the
// metro: the `event-view:<metro>` custom event sent by recordEventTouch.
//
// Definition (consecutive weekly retention). For a completed week W:
//   denominator = dancers active in W
//   returning   = dancers active in W that were also active in the week before W
//   rate        = returning / denominator (null when nobody was active in W)
// Weeks are ISO weeks (Monday 00:00 to next Monday 00:00) in America/New_York.
//
// Cookieless limitation: Umami derives the anonymous visitor ID from a salt that
// rotates monthly, so one person gets a new ID every month. Return can only be
// observed between two weeks that sit inside the same salt period. We assume the
// boundary is the UTC calendar month. That is NOT verified for Umami Cloud, so a
// week that crosses the UTC month boundary is treated as unobservable rather than
// guessed. The `<YYYY-MM>` argument is therefore a UTC salt month.
//
// A week is only reported as usable when ALL hold; otherwise its counts are null
// (unavailable), never zero:
//   - the data for the salt month is complete (not capped, fully paginated)
//   - the week lies entirely inside the salt month
//   - the prior week lies entirely inside the salt month (so the first week of
//     every salt month, and the week after it, are unavailable)
//   - the week has ended as of the observation time
// A usable week with no events is reported honestly as `dancers: 0`.
//
// Output holds aggregates only: no session IDs, no event payloads, no PII.
// Nothing here writes cookies, localStorage, or any persistent identifier.
//
// Usage: UMAMI_API_KEY=... node scripts/repeat-dancers.mjs 2026-10 boston
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Temporal } from "temporal-polyfill";

const TIME_ZONE = "America/New_York";
// Public site ID from the Umami tag in index.html.
const DEFAULT_WEBSITE_ID = "ee0f876a-ecb5-4200-a91a-3aa2f933db70";
const DEFAULT_API_URL = "https://api.umami.is/v1";
const PAGE_SIZE = 500;
const MAX_PAGES = 1000;
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
const METRO_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const UNAVAILABLE_REASONS = Object.freeze({
  incomplete: "data_incomplete",
  spansBoundary: "week_spans_salt_boundary",
  priorOutside: "prior_week_outside_salt_period",
  open: "week_open",
});

function weekId(date) {
  return `${date.yearOfWeek}-W${String(date.weekOfYear).padStart(2, "0")}`;
}

function assertMonth(month) {
  if (typeof month !== "string" || !MONTH_PATTERN.test(month)) {
    throw new Error("month must be YYYY-MM.");
  }
}

/** UTC calendar month [startMs, endMs) — the assumed Umami salt period. */
export function saltPeriod(month) {
  assertMonth(month);
  const first = Temporal.PlainYearMonth.from(month);
  const at = (yearMonth) => yearMonth.toPlainDate({ day: 1 }).toZonedDateTime("UTC").epochMilliseconds;
  return { startMs: at(first), endMs: at(first.add({ months: 1 })) };
}

/**
 * New York ISO weeks as [startMs, endMs) covering [startMs, endMs) of the period,
 * plus the one week before the first, so every reported week has its prior week.
 */
function enumerateWeeks(periodStartMs, periodEndMs, timeZone) {
  const first = Temporal.Instant.fromEpochMilliseconds(periodStartMs).toZonedDateTimeISO(timeZone).toPlainDate();
  let date = first.subtract({ days: first.dayOfWeek - 1 + 7 });
  const weeks = [];
  for (;;) {
    const next = date.add({ days: 7 });
    const startMs = date.toZonedDateTime(timeZone).epochMilliseconds;
    if (startMs >= periodEndMs) break;
    weeks.push({ id: weekId(date), startMs, endMs: next.toZonedDateTime(timeZone).epochMilliseconds });
    date = next;
  }
  return weeks;
}

function parseEvent(event, index, periodStartMs, periodEndMs) {
  if (!event || typeof event !== "object" || typeof event.sessionId !== "string" || !UUID_PATTERN.test(event.sessionId)) {
    throw new Error(`Event ${index} has an invalid sessionId.`);
  }
  let ms;
  try {
    if (typeof event.createdAt !== "string") throw new TypeError("not a string");
    ms = Temporal.Instant.from(event.createdAt).epochMilliseconds;
  } catch {
    throw new Error(`Event ${index} has an invalid createdAt timestamp.`);
  }
  if (ms < periodStartMs || ms >= periodEndMs) {
    throw new Error(`Event ${index} lies outside the requested salt month.`);
  }
  return { sessionId: event.sessionId.toLowerCase(), ms };
}

const rate = (count, total) => (total === 0 ? null : Number((count / total).toFixed(3)));

/**
 * @param {{ sessionId: string, createdAt: string }[]} events `event-view:<metro>` events inside the UTC month
 * @param {{ month: string, now: number, complete?: boolean, timeZone?: string }} options
 *   `now` is epoch milliseconds: the end of the observation window.
 *   `complete: false` marks the event list as truncated or partially fetched.
 */
export function buildWeeklyReport(events, { month, now, complete = true, timeZone = TIME_ZONE }) {
  if (!Number.isFinite(now)) throw new Error("now must be epoch milliseconds.");
  const { startMs: periodStartMs, endMs: periodEndMs } = saltPeriod(month);
  const weeks = enumerateWeeks(periodStartMs, periodEndMs, timeZone);

  const sessionsByWeek = new Map(weeks.map((week) => [week.id, new Set()]));
  events.forEach((event, index) => {
    const { sessionId, ms } = parseEvent(event, index, periodStartMs, periodEndMs);
    const week = weeks.find((candidate) => ms >= candidate.startMs && ms < candidate.endMs);
    sessionsByWeek.get(week.id).add(sessionId);
  });

  const iso = (ms) => Temporal.Instant.fromEpochMilliseconds(ms).toString();
  const inPeriod = (week) => week.startMs >= periodStartMs && week.endMs <= periodEndMs;
  const report = [];
  let pooledDancers = 0;
  let pooledReturning = 0;

  for (let index = 1; index < weeks.length; index += 1) {
    const week = weeks[index];
    const prior = weeks[index - 1];
    const entry = {
      week: week.id,
      startAt: iso(week.startMs),
      endAt: iso(week.endMs),
      priorWeek: prior.id,
      priorStartAt: iso(prior.startMs),
      priorEndAt: iso(prior.endMs),
    };
    let reason = null;
    if (!complete) reason = UNAVAILABLE_REASONS.incomplete;
    else if (!inPeriod(week)) reason = UNAVAILABLE_REASONS.spansBoundary;
    else if (!inPeriod(prior)) reason = UNAVAILABLE_REASONS.priorOutside;
    else if (week.endMs > now) reason = UNAVAILABLE_REASONS.open;

    if (reason) {
      report.push({ ...entry, status: "unavailable", reason, priorWeekDancers: null, dancers: null, returning: null, rate: null });
      continue;
    }
    const current = sessionsByWeek.get(week.id);
    const previous = sessionsByWeek.get(prior.id);
    let returning = 0;
    for (const sessionId of current) if (previous.has(sessionId)) returning += 1;
    pooledDancers += current.size;
    pooledReturning += returning;
    report.push({
      ...entry,
      status: "usable",
      reason: null,
      priorWeekDancers: previous.size,
      dancers: current.size,
      returning,
      rate: rate(returning, current.size),
    });
  }

  const usableWeeks = report.filter((week) => week.status === "usable").length;
  return {
    saltPeriod: { month, startAt: iso(periodStartMs), endAt: iso(periodEndMs) },
    observedThrough: iso(Math.min(now, periodEndMs)),
    complete,
    weeks: report,
    summary: {
      usableWeeks,
      unavailableWeeks: report.length - usableWeeks,
      // Person-weeks pooled over usable weeks only; null when no week is usable.
      pooled: usableWeeks === 0 ? null : { dancers: pooledDancers, returning: pooledReturning, rate: rate(pooledReturning, pooledDancers) },
    },
  };
}

/**
 * Fetch `event-view:<metro>` events for one UTC salt month, observed up to `now`.
 * `complete` is false when Umami reports a capped result or pagination could not
 * reach the reported count; the events are then a partial sample.
 */
export async function fetchEventViews({
  apiUrl = DEFAULT_API_URL,
  apiKey,
  websiteId = DEFAULT_WEBSITE_ID,
  month,
  metro,
  now,
  fetchImpl = fetch,
  sleep = (ms) => new Promise((done) => setTimeout(done, ms)),
}) {
  if (!apiKey) throw new Error("apiKey is required.");
  if (!UUID_PATTERN.test(websiteId)) throw new Error("websiteId must be a UUID.");
  if (typeof metro !== "string" || !METRO_PATTERN.test(metro)) throw new Error("metro must be a lowercase slug.");
  if (!Number.isFinite(now)) throw new Error("now must be epoch milliseconds.");
  const { startMs, endMs } = saltPeriod(month);
  // Umami's endAt is inclusive, and a fixed upper bound keeps pages stable while
  // new events arrive during pagination.
  const startAt = startMs;
  const endAt = Math.min(endMs - 1, Math.floor(now));
  if (endAt < startAt) return { events: [], complete: true };

  const eventName = `event-view:${metro}`;
  const base = `${apiUrl.replace(/\/$/, "")}/websites/${websiteId}/events`;
  const events = [];
  let fetched = 0;
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const url = new URL(base);
    url.search = new URLSearchParams({
      event: eventName, eventType: "2", page: String(page), pageSize: String(PAGE_SIZE),
      startAt: String(startAt), endAt: String(endAt),
    }).toString();
    const response = await fetchImpl(url, { headers: { Accept: "application/json", Authorization: `Bearer ${apiKey}` } });
    // The response body is deliberately not echoed: it may carry event payloads.
    if (!response.ok) throw new Error(`Umami events query failed (${response.status}).`);
    const body = await response.json();
    if (!body || !Array.isArray(body.data) || !Number.isInteger(body.count) || body.count < 0) {
      throw new Error("Umami events query returned an unexpected response.");
    }
    if (body.isCapped === true) return { events, complete: false };
    fetched += body.data.length;
    events.push(...body.data.filter((event) => event && event.eventName === eventName).map(({ sessionId, createdAt }) => ({ sessionId, createdAt })));
    if (fetched >= body.count) return { events, complete: true };
    if (body.data.length === 0) return { events, complete: false };
    // Umami Cloud allows 50 calls per 15 seconds per key.
    await sleep(350);
  }
  return { events, complete: false };
}

async function main() {
  for (const envFile of [".env", ".env.local"]) {
    if (existsSync(envFile)) process.loadEnvFile(envFile);
  }
  const [month, metro] = process.argv.slice(2);
  if (!MONTH_PATTERN.test(month ?? "") || !METRO_PATTERN.test(metro ?? "")) {
    console.error("Usage: node scripts/repeat-dancers.mjs <YYYY-MM (UTC salt month)> <metro-slug>");
    process.exit(2);
  }
  const apiKey = process.env.UMAMI_API_KEY;
  if (!apiKey) {
    console.error("UMAMI_API_KEY is required (Umami Cloud: Settings > API keys).");
    process.exit(2);
  }
  const now = Date.now();
  const { events, complete } = await fetchEventViews({
    apiUrl: process.env.UMAMI_API_URL ?? DEFAULT_API_URL,
    apiKey,
    websiteId: process.env.UMAMI_WEBSITE_ID ?? DEFAULT_WEBSITE_ID,
    month,
    metro,
    now,
  });
  console.log(JSON.stringify({
    metro,
    ...buildWeeklyReport(events, { month, now, complete }),
    notes: [
      "Weeks are New York ISO weeks; a returning dancer was active in the week and in the week before it.",
      "Cookieless: Umami visitor IDs reset every salt period (assumed UTC calendar month), so return across months is not measurable.",
      "unavailable weeks have null counts: they are not zero.",
    ],
  }, null, 2));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  await main();
}
