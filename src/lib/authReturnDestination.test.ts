import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { setAuthReturnDestination, consumeAuthReturnDestination } from "./authReturnDestination";

describe("authReturnDestination", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  afterEach(() => {
    window.sessionStorage.clear();
  });

  describe("setAuthReturnDestination", () => {
    it("stores a safe internal path", () => {
      setAuthReturnDestination("/founders/accept");
      expect(window.sessionStorage.getItem("salsasegura-auth-return-destination")).toBe("/founders/accept");
    });

    it("refuses to store an external URL", () => {
      setAuthReturnDestination("https://evil.example");
      expect(window.sessionStorage.getItem("salsasegura-auth-return-destination")).toBeNull();
    });

    it("refuses to store a protocol-relative URL", () => {
      setAuthReturnDestination("//evil.example");
      expect(window.sessionStorage.getItem("salsasegura-auth-return-destination")).toBeNull();
    });

    it("refuses to store a non-path value", () => {
      setAuthReturnDestination("not-a-path");
      expect(window.sessionStorage.getItem("salsasegura-auth-return-destination")).toBeNull();
    });
  });

  describe("consumeAuthReturnDestination", () => {
    it("returns and clears a stored safe path", () => {
      setAuthReturnDestination("/founders/accept");
      expect(consumeAuthReturnDestination()).toBe("/founders/accept");
      expect(window.sessionStorage.getItem("salsasegura-auth-return-destination")).toBeNull();
    });

    it("returns null when nothing is stored", () => {
      expect(consumeAuthReturnDestination()).toBeNull();
    });

    it("returns null and clears an unsafe stored value", () => {
      window.sessionStorage.setItem("salsasegura-auth-return-destination", "https://evil.example");
      expect(consumeAuthReturnDestination()).toBeNull();
      expect(window.sessionStorage.getItem("salsasegura-auth-return-destination")).toBeNull();
    });

    it("only returns the destination once (single consumption)", () => {
      setAuthReturnDestination("/founders/accept");
      expect(consumeAuthReturnDestination()).toBe("/founders/accept");
      expect(consumeAuthReturnDestination()).toBeNull();
    });
  });
});
