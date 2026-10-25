import { describe, it, expect } from "vitest";
import {
  shortEventCode,
  normalizeShortEventCode,
  shortCodeIdRange,
  buildShortEventUrl,
  shortEventLabel,
} from "./shortLink";

const uuidWithValidCode = "1234abcd-1234-1234-1234-123456789012";
const uuidWithPartialCode = "1234-1234-1234-1234-123456789012";
const nonHexId = "event-abc-def";
const shortId = "abcdef12";

describe("shortEventCode", () => {
  it("extracts 8 hex chars from a UUID, stripping dashes and lowercasing", () => {
    const result = shortEventCode(uuidWithValidCode);
    expect(result).toBe("1234abcd");
  });

  it("handles a UUID whose id stays hex after dashes are stripped", () => {
    const result = shortEventCode(uuidWithPartialCode);
    expect(result).toBe("12341234");
  });

  it("returns null for non-hex event IDs", () => {
    const result = shortEventCode(nonHexId);
    expect(result).toBeNull();
  });
});

describe("normalizeShortEventCode", () => {
  it("normalizes a raw short code string", () => {
    const result = normalizeShortEventCode(shortId);
    expect(result).toBe(shortId);
  });

  it("returns null for non-hex input", () => {
    const result = normalizeShortEventCode("GGGGGGGG");
    expect(result).toBeNull();
  });

  it("returns null for empty string", () => {
    const result = normalizeShortEventCode("");
    expect(result).toBeNull();
  });

  it("returns null for undefined", () => {
    const result = normalizeShortEventCode(undefined);
    expect(result).toBeNull();
  });
});

describe("shortCodeIdRange", () => {
  it("returns inclusive UUID bounds for a code", () => {
    const result = shortCodeIdRange(shortId);
    expect(result.from).toBe(`${shortId}-0000-0000-0000-000000000000`);
    expect(result.to).toBe(`${shortId}-ffff-ffff-ffff-ffffffffffff`);
  });
});

describe("buildShortEventUrl", () => {
  it("builds /e/<code> URL for a UUID with valid code", () => {
    const result = buildShortEventUrl(uuidWithValidCode);
    expect(result).toContain("/e/1234abcd");
  });

  it("falls back to /events/<id> when code is null", () => {
    const result = buildShortEventUrl(nonHexId);
    expect(result).toContain("/events/event-abc-def");
  });

  it("uses explicit origin when provided", () => {
    const result = buildShortEventUrl(uuidWithValidCode, "https://example.com");
    expect(result).toContain("https://example.com/e/1234abcd");
  });
});

describe("shortEventLabel", () => {
  it("returns host and pathname without scheme", () => {
    const result = shortEventLabel(uuidWithValidCode);
    expect(result).not.toContain("http");
    expect(result).not.toContain("https");
    expect(result).toContain("/e/1234abcd");
  });

  it("falls back to full /events/<id> when code is null", () => {
    const result = shortEventLabel(nonHexId);
    expect(result).toContain("/events/event-abc-def");
  });
});
