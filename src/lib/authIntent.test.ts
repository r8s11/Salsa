import { describe, expect, it, beforeEach } from "vitest";
import { consumeAuthIntent, setAuthIntent } from "./authIntent";

describe("authIntent", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });

  it("round-trips a signup intent with an email", () => {
    setAuthIntent("signup", "user@example.com");
    expect(consumeAuthIntent()).toEqual({ kind: "signup", email: "user@example.com" });
  });

  it("round-trips a recovery intent without an email", () => {
    setAuthIntent("recovery");
    expect(consumeAuthIntent()).toEqual({ kind: "recovery", email: undefined });
  });

  it("clears the hint after it is consumed once", () => {
    setAuthIntent("recovery", "user@example.com");
    consumeAuthIntent();
    expect(consumeAuthIntent()).toBeNull();
  });

  it("returns null when no intent was recorded", () => {
    expect(consumeAuthIntent()).toBeNull();
  });

  it("ignores malformed stored data instead of throwing", () => {
    window.sessionStorage.setItem("salsasegura-auth-intent", "not json");
    expect(consumeAuthIntent()).toBeNull();
  });

  it("rejects an unknown intent kind", () => {
    window.sessionStorage.setItem("salsasegura-auth-intent", JSON.stringify({ kind: "founder" }));
    expect(consumeAuthIntent()).toBeNull();
  });
});
