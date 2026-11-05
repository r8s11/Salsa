/**
 * Recurring coverage, as returned by `admin_coverage_score`. A recurring
 * night is a linked series, or the same title at the same venue on the same
 * New York weekday. It is tracked once it occurred at least
 * `minimumOccurrences` times in the lookback window, and listed when an
 * approved occurrence falls between today and the horizon.
 */
export interface CoverageGap {
  key: string;
  title: string;
  place: string | null;
  seriesSlug: string | null;
  lastAt: string;
  recentOccurrences: number;
}

export interface MetroCoverage {
  slug: string | null;
  name: string | null;
  tracked: number;
  listed: number;
  gaps: CoverageGap[];
}

export interface Coverage {
  asOf: string;
  lookbackDays: number;
  horizonDays: number;
  minimumOccurrences: number;
  tracked: number;
  listed: number;
  metros: MetroCoverage[];
}

type Raw = Record<string, unknown>;
const record = (value: unknown): Raw | null =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Raw) : null;
const count = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const instant = (value: unknown): value is string => typeof value === "string" && Number.isFinite(Date.parse(value));
const optionalText = (value: unknown): value is string | null => value === null || typeof value === "string";

function parseGap(raw: unknown): CoverageGap | null {
  const r = record(raw);
  if (!r || typeof r.key !== "string" || typeof r.title !== "string" || !optionalText(r.place)
    || !optionalText(r.series_slug) || !instant(r.last_at) || !count(r.recent_occurrences)) return null;
  return { key: r.key, title: r.title, place: r.place, seriesSlug: r.series_slug, lastAt: r.last_at, recentOccurrences: r.recent_occurrences };
}

function parseMetro(raw: unknown): MetroCoverage | null {
  const r = record(raw);
  if (!r || !optionalText(r.slug) || !optionalText(r.name) || !count(r.tracked) || !count(r.listed)
    || r.listed > r.tracked || !Array.isArray(r.gaps)) return null;
  const gaps = r.gaps.map(parseGap);
  if (gaps.some((gap) => gap === null) || gaps.length > r.tracked - r.listed) return null;
  return { slug: r.slug, name: r.name, tracked: r.tracked, listed: r.listed, gaps: gaps as CoverageGap[] };
}

/** Malformed responses are rejected whole; a partial parse would misstate the score. */
export function parseCoverage(raw: unknown): Coverage {
  const r = record(raw);
  const metros = r && Array.isArray(r.metros) ? r.metros.map(parseMetro) : null;
  if (!r || !metros || metros.some((metro) => metro === null) || !instant(r.as_of)
    || !count(r.lookback_days) || !count(r.horizon_days) || !count(r.minimum_occurrences)
    || !count(r.tracked) || !count(r.listed) || r.listed > r.tracked
    || metros.reduce((sum, metro) => sum + (metro?.tracked ?? 0), 0) !== r.tracked
    || metros.reduce((sum, metro) => sum + (metro?.listed ?? 0), 0) !== r.listed) {
    throw new Error("Unable to load recurring coverage. Please try again.");
  }
  return {
    asOf: r.as_of, lookbackDays: r.lookback_days, horizonDays: r.horizon_days,
    minimumOccurrences: r.minimum_occurrences, tracked: r.tracked, listed: r.listed,
    metros: metros as MetroCoverage[],
  };
}

/** Whole-percent score, or null when nothing is tracked (no score, not 0%). */
export function coveragePercent(listed: number, tracked: number): number | null {
  return tracked === 0 ? null : Math.round((listed / tracked) * 100);
}

/** The weekday a gap usually falls on, from its last listed occurrence. */
export function usualNight(lastAt: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", weekday: "long" }).format(new Date(lastAt));
}
