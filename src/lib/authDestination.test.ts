import { describe, expect, it } from "vitest";
import { isSafeInternalPath, resolveAuthorizedDestination } from "./authDestination";

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
