import { afterEach, describe, expect, it, vi } from "vitest";
import { captureFirstTouch, firstTouchProperties, getFirstTouch, parseFirstTouch } from "./attribution";

const NOW = new Date("2026-05-01T12:00:00.000Z");
const SITE = "www.salsasegura.com";

describe("parseFirstTouch", () => {
  it("keeps UTM parameters, the external referrer host and the landing path", () => {
    expect(
      parseFirstTouch(
        new URL("https://www.salsasegura.com/events/boston?utm_source=instagram&utm_medium=organic_social&utm_campaign=boston_rsvp_202605&utm_content=reel1&utm_term=bachata&email=x@y.z"),
        "https://l.instagram.com/some/path?u=secret",
        NOW
      )
    ).toEqual({
      utm_source: "instagram",
      utm_medium: "organic_social",
      utm_campaign: "boston_rsvp_202605",
      utm_content: "reel1",
      utm_term: "bachata",
      referrer_host: "l.instagram.com",
      landing_path: "/events/boston",
      captured_at: "2026-05-01T12:00:00.000Z",
    });
  });

  it("records an external referrer without UTM parameters", () => {
    expect(parseFirstTouch(new URL(`https://${SITE}/`), "https://www.google.com/", NOW)).toEqual({
      referrer_host: "www.google.com",
      landing_path: "/",
      captured_at: NOW.toISOString(),
    });
  });

  it("returns null for direct and internal visits", () => {
    expect(parseFirstTouch(new URL(`https://${SITE}/calendar`), "", NOW)).toBeNull();
    expect(parseFirstTouch(new URL(`https://${SITE}/calendar`), `https://${SITE}/`, NOW)).toBeNull();
    expect(parseFirstTouch(new URL(`https://${SITE}/calendar`), "not a url", NOW)).toBeNull();
  });

  it("trims, drops blank values and caps length", () => {
    const touch = parseFirstTouch(
      new URL(`https://${SITE}/?utm_source=%20tiktok%20&utm_medium=&utm_campaign=${"x".repeat(300)}`),
      "",
      NOW
    );
    expect(touch?.utm_source).toBe("tiktok");
    expect(touch).not.toHaveProperty("utm_medium");
    expect(touch?.utm_campaign).toHaveLength(100);
  });
});

describe("firstTouchProperties", () => {
  it("prefixes fields for PostHog super/person properties", () => {
    expect(
      firstTouchProperties({ utm_source: "instagram", landing_path: "/", captured_at: NOW.toISOString() })
    ).toEqual({
      first_utm_source: "instagram",
      first_landing_path: "/",
      first_captured_at: NOW.toISOString(),
    });
    expect(firstTouchProperties(null)).toEqual({});
  });
});

describe("captureFirstTouch", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    window.history.replaceState(null, "", "/");
  });

  it("captures the landing URL once per page load", () => {
    window.history.replaceState(null, "", "/submit?utm_source=instagram");
    expect(captureFirstTouch()).toMatchObject({ utm_source: "instagram", landing_path: "/submit" });
    expect(getFirstTouch()).toMatchObject({ utm_source: "instagram" });
  });

  it("records nothing when the browser sends Global Privacy Control or Do Not Track", () => {
    window.history.replaceState(null, "", "/submit?utm_source=instagram");
    vi.stubGlobal("navigator", { ...navigator, globalPrivacyControl: true });
    expect(captureFirstTouch()).toBeNull();
    vi.stubGlobal("navigator", { ...navigator, globalPrivacyControl: false, doNotTrack: "1" });
    expect(captureFirstTouch()).toBeNull();
    expect(getFirstTouch()).toBeNull();
  });
});
