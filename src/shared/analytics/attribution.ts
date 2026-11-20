// First-touch attribution for this tab, held in memory only (no cookie or
// browser storage). It is persisted server-side only when the visitor signs up
// (profiles.first_touch) or submits an event (event_submissions.first_touch).
// Only campaign parameters, the referring host and the landing path are kept:
// never the full referrer URL or other query parameters, which can carry PII.

import { hasPrivacySignal } from "./privacySignal";

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
const MAX_LENGTH = 100;

export type FirstTouch = Partial<Record<(typeof UTM_KEYS)[number], string>> & {
  referrer_host?: string;
  landing_path: string;
  captured_at: string;
};

function clean(value: string | null): string | undefined {
  const trimmed = value?.trim().slice(0, MAX_LENGTH);
  return trimmed || undefined;
}

function externalHost(referrer: string, siteHost: string): string | undefined {
  try {
    const host = new URL(referrer).host;
    return host && host !== siteHost ? clean(host) : undefined;
  } catch {
    return undefined;
  }
}

export function parseFirstTouch(url: URL, referrer: string, now = new Date()): FirstTouch | null {
  const touch: Partial<FirstTouch> = {};
  for (const key of UTM_KEYS) {
    const value = clean(url.searchParams.get(key));
    if (value) touch[key] = value;
  }
  const referrerHost = externalHost(referrer, url.host);
  if (referrerHost) touch.referrer_host = referrerHost;
  if (Object.keys(touch).length === 0) return null;
  return {
    ...touch,
    landing_path: url.pathname.slice(0, MAX_LENGTH),
    captured_at: now.toISOString(),
  };
}

/** PostHog property names for a first touch (`first_utm_source`, ...). */
export function firstTouchProperties(touch: FirstTouch | null): Record<string, string> {
  return Object.fromEntries(Object.entries(touch ?? {}).map(([key, value]) => [`first_${key}`, value]));
}

let current: FirstTouch | null = null;

/**
 * Read the landing URL once at startup, before routing can rewrite it.
 * Nothing is kept when the browser sends Do Not Track or Global Privacy Control.
 */
export function captureFirstTouch(): FirstTouch | null {
  current = hasPrivacySignal() ? null : parseFirstTouch(new URL(window.location.href), document.referrer);
  return current;
}

export function getFirstTouch(): FirstTouch | null {
  return current;
}
