import { describe, expect, it } from "vitest";
import { buildWeeklyReport, fetchEventViews, saltPeriod, UNAVAILABLE_REASONS } from "./repeat-dancers.mjs";

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const at = (createdAt, n) => ({ sessionId: id(n), createdAt });
const ms = (iso) => Date.parse(iso);
const byWeek = (report) => Object.fromEntries(report.weeks.map((week) => [week.week, week]));

// October 2026 (UTC salt month), New York ISO weeks, EDT until 2026-11-01 06:00Z:
//   W40 Sep 28 04:00Z - Oct 5 04:00Z   (starts before the salt month)
//   W41 Oct  5 04:00Z - Oct 12 04:00Z  (prior week W40 is outside the salt month)
//   W42 Oct 12 04:00Z - Oct 19 04:00Z
//   W43 Oct 19 04:00Z - Oct 26 04:00Z
//   W44 Oct 26 04:00Z - Nov  2 05:00Z  (crosses the salt month end)
const AFTER_OCTOBER = ms("2026-11-05T00:00:00Z");

describe("buildWeeklyReport", () => {
  it("counts consecutive-week returning dancers on New York weeks, and marks unobservable weeks unavailable", () => {
    const report = buildWeeklyReport(
      [
        // Sunday 23:30 New York is still W42 although UTC already says Monday.
        at("2026-10-19T03:30:00Z", 1), // A: W42
        at("2026-10-26T03:30:00Z", 1), // A: W43 -> returning
        at("2026-10-19T04:30:00Z", 2), // B: Monday 00:30 New York, new in W43
        at("2026-10-13T12:00:00Z", 3), // C: W42, twice in the same week
        at("2026-10-13T15:00:00Z", 3),
        at("2026-10-06T12:00:00Z", 4), // D: W41 then W43, skipped W42 -> not consecutive
        at("2026-10-21T12:00:00Z", 4),
      ],
      { month: "2026-10", now: AFTER_OCTOBER },
    );
    const weeks = byWeek(report);

    expect(report.weeks.map((week) => week.week)).toEqual(["2026-W40", "2026-W41", "2026-W42", "2026-W43", "2026-W44"]);
    expect(weeks["2026-W40"]).toMatchObject({ status: "unavailable", reason: UNAVAILABLE_REASONS.spansBoundary, dancers: null, returning: null, rate: null });
    expect(weeks["2026-W41"]).toMatchObject({ status: "unavailable", reason: UNAVAILABLE_REASONS.priorOutside, dancers: null, returning: null, rate: null });
    expect(weeks["2026-W44"]).toMatchObject({ status: "unavailable", reason: UNAVAILABLE_REASONS.spansBoundary, dancers: null });

    // W42: A and C active; only D was active in W41, so zero is a real zero.
    expect(weeks["2026-W42"]).toMatchObject({ status: "usable", reason: null, dancers: 2, priorWeekDancers: 1, returning: 0, rate: 0 });
    // W43: A, B, D active; only A was also active in W42.
    expect(weeks["2026-W43"]).toMatchObject({ status: "usable", dancers: 3, priorWeekDancers: 2, returning: 1, rate: 0.333 });
    expect(report.summary).toEqual({ usableWeeks: 2, unavailableWeeks: 3, pooled: { dancers: 5, returning: 1, rate: 0.2 } });
  });

  it("reports matched, exact observation windows for the week and its prior week", () => {
    const week = byWeek(buildWeeklyReport([], { month: "2026-10", now: AFTER_OCTOBER }))["2026-W43"];
    expect(week).toMatchObject({
      startAt: "2026-10-19T04:00:00Z",
      endAt: "2026-10-26T04:00:00Z",
      priorWeek: "2026-W42",
      priorStartAt: "2026-10-12T04:00:00Z",
      priorEndAt: "2026-10-19T04:00:00Z",
    });
    expect(buildWeeklyReport([], { month: "2026-10", now: AFTER_OCTOBER }).saltPeriod).toEqual({
      month: "2026-10", startAt: "2026-10-01T00:00:00Z", endAt: "2026-11-01T00:00:00Z",
    });
  });

  it("lists a usable week with no events as zero dancers with an undefined rate, not as missing or a zero rate", () => {
    const report = buildWeeklyReport([at("2026-10-13T12:00:00Z", 3)], { month: "2026-10", now: AFTER_OCTOBER });
    const weeks = byWeek(report);
    expect(weeks["2026-W43"]).toMatchObject({ status: "usable", dancers: 0, returning: 0, rate: null, priorWeekDancers: 1 });
    expect(weeks["2026-W42"]).toMatchObject({ status: "usable", dancers: 1, returning: 0, rate: 0 });
    // Pooled rate ignores the empty week's undefined rate but keeps its zero denominator.
    expect(report.summary.pooled).toEqual({ dancers: 1, returning: 0, rate: 0 });
  });

  it("never reports a week as complete before it has ended, down to the millisecond", () => {
    const events = [at("2026-10-13T12:00:00Z", 3), at("2026-10-20T12:00:00Z", 3)];
    const weekEnd = ms("2026-10-19T04:00:00Z"); // end of W42
    const closed = byWeek(buildWeeklyReport(events, { month: "2026-10", now: weekEnd }));
    expect(closed["2026-W42"].status).toBe("usable");
    expect(closed["2026-W43"]).toMatchObject({ status: "unavailable", reason: UNAVAILABLE_REASONS.open, dancers: null, returning: null, rate: null });

    const open = byWeek(buildWeeklyReport(events, { month: "2026-10", now: weekEnd - 1 }));
    expect(open["2026-W42"]).toMatchObject({ status: "unavailable", reason: UNAVAILABLE_REASONS.open, dancers: null });
  });

  it("keeps a week unavailable while open even when it already has events, so a partial week cannot read as full retention", () => {
    const week = byWeek(
      buildWeeklyReport([at("2026-10-14T12:00:00Z", 1), at("2026-10-20T12:00:00Z", 1)], {
        month: "2026-10",
        now: ms("2026-10-21T00:00:00Z"),
      }),
    )["2026-W43"];
    expect(week).toMatchObject({ status: "unavailable", reason: UNAVAILABLE_REASONS.open, returning: null, rate: null });
  });

  it("marks every week unavailable when the event list is incomplete", () => {
    const report = buildWeeklyReport([at("2026-10-13T12:00:00Z", 1), at("2026-10-20T12:00:00Z", 1)], {
      month: "2026-10", now: AFTER_OCTOBER, complete: false,
    });
    expect(report.complete).toBe(false);
    expect(report.weeks.every((week) => week.status === "unavailable" && week.reason === UNAVAILABLE_REASONS.incomplete)).toBe(true);
    expect(report.weeks.every((week) => week.dancers === null && week.returning === null && week.rate === null)).toBe(true);
    expect(report.summary).toEqual({ usableWeeks: 0, unavailableWeeks: 5, pooled: null });
  });

  it("handles the salt-month boundary: the first two and last weeks are unavailable, and DST does not shift the week edges", () => {
    // November 2026 starts on a UTC Sunday inside W44; DST ends Nov 1 06:00Z.
    const report = buildWeeklyReport(
      [
        at("2026-11-01T00:30:00Z", 9), // first instant bucket of the salt month, still W44
        at("2026-11-09T04:30:00Z", 1), // Sunday 23:30 EST -> W45
        at("2026-11-09T05:30:00Z", 1), // Monday 00:30 EST -> W46: X returns
        at("2026-11-09T05:30:00Z", 2), // Y: new in W46
        at("2026-11-30T04:59:00Z", 3), // Sunday 23:59 EST -> W48
      ],
      { month: "2026-11", now: ms("2026-12-10T00:00:00Z") },
    );
    const weeks = byWeek(report);
    expect(report.weeks.map((week) => [week.week, week.status, week.reason])).toEqual([
      ["2026-W44", "unavailable", UNAVAILABLE_REASONS.spansBoundary],
      ["2026-W45", "unavailable", UNAVAILABLE_REASONS.priorOutside],
      ["2026-W46", "usable", null],
      ["2026-W47", "usable", null],
      ["2026-W48", "usable", null],
      ["2026-W49", "unavailable", UNAVAILABLE_REASONS.spansBoundary],
    ]);
    expect(weeks["2026-W45"].startAt).toBe("2026-11-02T05:00:00Z");
    expect(weeks["2026-W46"]).toMatchObject({ startAt: "2026-11-09T05:00:00Z", priorStartAt: "2026-11-02T05:00:00Z", dancers: 2, priorWeekDancers: 1, returning: 1, rate: 0.5 });
    expect(weeks["2026-W47"]).toMatchObject({ dancers: 0, returning: 0, rate: null, priorWeekDancers: 2 });
    expect(weeks["2026-W48"]).toMatchObject({ dancers: 1, returning: 0, rate: 0, priorWeekDancers: 0 });
  });

  it("treats the same session id in different letter case as one dancer", () => {
    const lower = "abcdefab-cdef-4abc-8abc-abcdefabcdef";
    const report = buildWeeklyReport(
      [{ sessionId: lower.toUpperCase(), createdAt: "2026-10-13T12:00:00Z" }, { sessionId: lower, createdAt: "2026-10-14T12:00:00Z" }],
      { month: "2026-10", now: AFTER_OCTOBER },
    );
    expect(byWeek(report)["2026-W42"].dancers).toBe(1);
  });

  it("emits aggregates only, with no session ids", () => {
    const report = buildWeeklyReport([at("2026-10-13T12:00:00Z", 77), at("2026-10-20T12:00:00Z", 77)], { month: "2026-10", now: AFTER_OCTOBER });
    expect(JSON.stringify(report)).not.toContain(id(77));
    expect(JSON.stringify(report)).not.toMatch(/sessionId/);
  });

  it("validates input without echoing the offending value", () => {
    const run = (event) => () => buildWeeklyReport([event], { month: "2026-10", now: AFTER_OCTOBER });
    expect(run({ sessionId: "visitor@example.com", createdAt: "2026-10-13T12:00:00Z" })).toThrow(/invalid sessionId/);
    const message = (() => { try { run({ sessionId: "visitor@example.com", createdAt: "2026-10-13T12:00:00Z" })(); } catch (error) { return error.message; } return ""; })();
    expect(message).not.toContain("example.com");
    expect(run({ createdAt: "2026-10-13T12:00:00Z" })).toThrow(/invalid sessionId/);
    expect(run({ sessionId: id(1), createdAt: "yesterday" })).toThrow(/invalid createdAt/);
    expect(run({ sessionId: id(1), createdAt: "2026-10-13T12:00:00" })).toThrow(/invalid createdAt/);
    expect(run({ sessionId: id(1), createdAt: 1760000000000 })).toThrow(/invalid createdAt/);
    expect(run(null)).toThrow(/invalid sessionId/);
    expect(() => buildWeeklyReport([], { month: "2026-13", now: AFTER_OCTOBER })).toThrow(/YYYY-MM/);
    expect(() => buildWeeklyReport([], { month: "2026-1", now: AFTER_OCTOBER })).toThrow(/YYYY-MM/);
    expect(() => buildWeeklyReport([], { month: "2026-10", now: Number.NaN })).toThrow(/now/);
  });
});

describe("saltPeriod", () => {
  it("is the UTC calendar month, not the New York month", () => {
    expect(saltPeriod("2026-10")).toEqual({ startMs: ms("2026-10-01T00:00:00Z"), endMs: ms("2026-11-01T00:00:00Z") });
    expect(saltPeriod("2026-12").endMs).toBe(ms("2027-01-01T00:00:00Z"));
  });
});

describe("fetchEventViews", () => {
  const WEBSITE_ID = "ee0f876a-ecb5-4200-a91a-3aa2f933db70";
  const row = (n, createdAt, eventName = "event-view:boston") => ({
    createdAt, sessionId: id(n), eventName, urlPath: "/private/path", visitId: "secret-visit", eventId: "e",
  });

  function fakeFetch(pages, { ok = true, status = 200, text } = {}) {
    const calls = [];
    const fetchImpl = async (url, init) => {
      calls.push({ url: new URL(url), init });
      const page = Number(new URL(url).searchParams.get("page"));
      return { ok, status, json: async () => pages[page - 1] ?? { data: [], count: pages[0]?.count ?? 0 }, text: async () => text };
    };
    return { fetchImpl, calls };
  }
  const base = (fetchImpl, extra = {}) => ({
    apiKey: "secret-key", websiteId: WEBSITE_ID, month: "2026-10", metro: "boston", now: AFTER_OCTOBER, fetchImpl, sleep: async () => {}, ...extra,
  });

  it("uses the official events contract, paginates, keeps only id and time, and sends Bearer auth", async () => {
    const { fetchImpl, calls } = fakeFetch([
      { count: 4, data: [row(1, "2026-10-13T12:00:00.000Z"), row(2, "2026-10-14T12:00:00.000Z")] },
      { count: 4, data: [row(3, "2026-10-15T12:00:00.000Z"), row(4, "2026-10-16T12:00:00.000Z", "event-view:nyc")] },
    ]);
    const result = await fetchEventViews(base(fetchImpl));

    expect(calls).toHaveLength(2);
    expect(calls[0].url.origin + calls[0].url.pathname).toBe(`https://api.umami.is/v1/websites/${WEBSITE_ID}/events`);
    expect(Object.fromEntries(calls[0].url.searchParams)).toEqual({
      event: "event-view:boston", eventType: "2", page: "1", pageSize: "500",
      startAt: String(ms("2026-10-01T00:00:00Z")),
      // Umami's endAt is inclusive, so the last millisecond of the salt month.
      endAt: String(ms("2026-11-01T00:00:00Z") - 1),
    });
    expect(calls[1].url.searchParams.get("page")).toBe("2");
    expect(calls[0].init.headers.Authorization).toBe("Bearer secret-key");
    expect(result.complete).toBe(true);
    // The other metro's row is dropped; payload fields never leave the fetcher.
    expect(result.events).toEqual([
      { sessionId: id(1), createdAt: "2026-10-13T12:00:00.000Z" },
      { sessionId: id(2), createdAt: "2026-10-14T12:00:00.000Z" },
      { sessionId: id(3), createdAt: "2026-10-15T12:00:00.000Z" },
    ]);
  });

  it("freezes endAt at the observation time while the month is still running", async () => {
    const now = ms("2026-10-20T10:00:00.000Z");
    const { fetchImpl, calls } = fakeFetch([{ count: 0, data: [] }]);
    const result = await fetchEventViews(base(fetchImpl, { now }));
    expect(calls[0].url.searchParams.get("endAt")).toBe(String(now));
    expect(result).toEqual({ events: [], complete: true });
  });

  it("makes no request for a month that has not started", async () => {
    const { fetchImpl, calls } = fakeFetch([]);
    const result = await fetchEventViews(base(fetchImpl, { now: ms("2026-09-30T00:00:00Z") }));
    expect(calls).toHaveLength(0);
    expect(result).toEqual({ events: [], complete: true });
  });

  it("marks the result incomplete when Umami says the list is capped, and stops paging", async () => {
    const { fetchImpl, calls } = fakeFetch([{ count: 10000, isCapped: true, data: [row(1, "2026-10-13T12:00:00.000Z")] }]);
    const result = await fetchEventViews(base(fetchImpl));
    expect(result.complete).toBe(false);
    expect(calls).toHaveLength(1);
  });

  it("marks the result incomplete when pages run dry before the reported count", async () => {
    const { fetchImpl } = fakeFetch([{ count: 1000, data: [row(1, "2026-10-13T12:00:00.000Z")] }, { count: 1000, data: [] }]);
    const result = await fetchEventViews(base(fetchImpl));
    expect(result.complete).toBe(false);
  });

  it("feeds an incomplete fetch into a report with no usable weeks", async () => {
    const { fetchImpl } = fakeFetch([{ count: 1000, isCapped: true, data: [row(1, "2026-10-13T12:00:00.000Z")] }]);
    const { events, complete } = await fetchEventViews(base(fetchImpl));
    expect(buildWeeklyReport(events, { month: "2026-10", now: AFTER_OCTOBER, complete }).summary.usableWeeks).toBe(0);
  });

  it("fails on HTTP errors without echoing the response body or the API key", async () => {
    const { fetchImpl } = fakeFetch([], { ok: false, status: 401, text: "payload with visitor details" });
    const error = await fetchEventViews(base(fetchImpl)).catch((caught) => caught);
    expect(error.message).toBe("Umami events query failed (401).");
    expect(error.message).not.toMatch(/secret-key|visitor/);
  });

  it("rejects malformed responses and bad arguments", async () => {
    await expect(fetchEventViews(base(fakeFetch([{ data: "nope", count: 1 }]).fetchImpl))).rejects.toThrow(/unexpected response/);
    await expect(fetchEventViews(base(fakeFetch([{ data: [], count: "1" }]).fetchImpl))).rejects.toThrow(/unexpected response/);
    await expect(fetchEventViews(base(fakeFetch([]).fetchImpl, { apiKey: "" }))).rejects.toThrow(/apiKey/);
    await expect(fetchEventViews(base(fakeFetch([]).fetchImpl, { websiteId: "not-a-uuid" }))).rejects.toThrow(/websiteId/);
    await expect(fetchEventViews(base(fakeFetch([]).fetchImpl, { metro: "Boston&x=1" }))).rejects.toThrow(/metro/);
    await expect(fetchEventViews(base(fakeFetch([]).fetchImpl, { month: "2026-13" }))).rejects.toThrow(/YYYY-MM/);
  });
});
