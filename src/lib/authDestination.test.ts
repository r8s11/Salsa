import { describe, expect, it } from "vitest";
import { isSafeInternalPath, resolveAuthorizedDestination, resolveCallbackDestination } from "./authDestination";

describe("resolveAuthorizedDestination", () => {
  it("returns /host for organizer", () => {
    expect(resolveAuthorizedDestination("organizer")).toBe("/host");
  });

  it("returns /admin for admin", () => {
    expect(resolveAuthorizedDestination("admin")).toBe("/admin");
  });

  it("returns /admin for moderator", () => {
    expect(resolveAuthorizedDestination("moderator")).toBe("/admin");
  });

  it("returns /profile for null role", () => {
    expect(resolveAuthorizedDestination(null)).toBe("/profile");
  });
});

describe("resolveCallbackDestination", () => {
  it("prefers a safe internal next path over the role default", () => {
    expect(resolveCallbackDestination("organizer", "/founders/accept")).toBe("/founders/accept");
  });

  it("falls back to the role default when next is missing", () => {
    expect(resolveCallbackDestination("admin", undefined)).toBe("/admin");
  });

  it("falls back to the role default when next is an external URL", () => {
    expect(resolveCallbackDestination(null, "https://evil.com")).toBe("/profile");
  });

  it("falls back to the role default when next is protocol-relative", () => {
    expect(resolveCallbackDestination("organizer", "//evil.com")).toBe("/host");
  });
});

describe("isSafeInternalPath", () => {
  const cases: Array<[unknown, boolean]> = [
    ["/host", true],
    ["/host/events", true],
    ["//evil.com", false],
    ["https://evil.com", false],
    ["javascript:alert(1)", false],
    [123, false],
    [undefined, false],
    [null, false],
    ["", false],
    ["relative/path", false],
    ["\\\\evil.com", false],
  ];

  it.each(cases)("isSafeInternalPath(%p) === %p", (value, expected) => {
    expect(isSafeInternalPath(value)).toBe(expected);
  });
});
