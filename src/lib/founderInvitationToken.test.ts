import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  setFounderInvitationToken,
  getFounderInvitationToken,
  clearFounderInvitationToken,
} from "./founderInvitationToken";

const VALID_TOKEN = "a".repeat(64);
const INVALID_TOKEN = "not-a-token";

describe("founderInvitationToken", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  afterEach(() => {
    window.sessionStorage.clear();
  });

  describe("setFounderInvitationToken", () => {
    it("stores a valid 64-hex token", () => {
      setFounderInvitationToken(VALID_TOKEN);
      expect(window.sessionStorage.getItem("salsasegura-founder-invitation-token")).toBe(VALID_TOKEN);
    });
  });

  describe("getFounderInvitationToken", () => {
    it("returns a stored valid token", () => {
      setFounderInvitationToken(VALID_TOKEN);
      expect(getFounderInvitationToken()).toBe(VALID_TOKEN);
    });

    it("returns null when nothing is stored", () => {
      expect(getFounderInvitationToken()).toBeNull();
    });

    it("returns null for a malformed stored value (defensive)", () => {
      window.sessionStorage.setItem("salsasegura-founder-invitation-token", INVALID_TOKEN);
      expect(getFounderInvitationToken()).toBeNull();
    });

    it("returns null for an empty stored value", () => {
      window.sessionStorage.setItem("salsasegura-founder-invitation-token", "");
      expect(getFounderInvitationToken()).toBeNull();
    });
  });

  describe("clearFounderInvitationToken", () => {
    it("removes a stored token", () => {
      setFounderInvitationToken(VALID_TOKEN);
      clearFounderInvitationToken();
      expect(window.sessionStorage.getItem("salsasegura-founder-invitation-token")).toBeNull();
    });

    it("does not throw when nothing is stored", () => {
      expect(() => clearFounderInvitationToken()).not.toThrow();
    });
  });

  describe("sessionStorage unavailability", () => {
    it("all operations are best-effort and never throw", () => {
      const throwingStorage = {
        getItem: () => { throw new Error("unavailable"); },
        setItem: () => { throw new Error("unavailable"); },
        removeItem: () => { throw new Error("unavailable"); },
      };
      const original = window.sessionStorage;
    vi.spyOn(window, "sessionStorage", "get").mockReturnValue(throwingStorage as unknown as Storage);

      expect(() => setFounderInvitationToken(VALID_TOKEN)).not.toThrow();
      expect(() => getFounderInvitationToken()).not.toThrow();
      expect(getFounderInvitationToken()).toBeNull();
      expect(() => clearFounderInvitationToken()).not.toThrow();

      vi.spyOn(window, "sessionStorage", "get").mockReturnValue(original);
    });
  });
});
