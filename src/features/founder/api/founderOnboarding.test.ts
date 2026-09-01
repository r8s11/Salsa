import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  fetchFounderOnboardingState,
  provisionFounderOrganization,
  requestFounderWelcomeEmail,
} from "./founderOnboarding";

const { rpc, invoke, refreshSession } = vi.hoisted(() => ({
  rpc: vi.fn(),
  invoke: vi.fn(),
  refreshSession: vi.fn(),
}));

vi.mock("../../../lib/supabase", () => ({
  supabase: {
    rpc,
    functions: { invoke },
    auth: { refreshSession },
  },
}));

describe("founderOnboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    refreshSession.mockResolvedValue({ data: { session: null, user: null }, error: null });
  });

  describe("fetchFounderOnboardingState", () => {
    it("calls founder_onboarding_state with no arguments", async () => {
      rpc.mockResolvedValueOnce({ data: { state: "not_founder" }, error: null });
      await fetchFounderOnboardingState();
      expect(rpc).toHaveBeenCalledWith("founder_onboarding_state");
      expect(rpc).toHaveBeenCalledTimes(1);
    });

    it("returns the provisioned state exactly as the RPC returned it", async () => {
      rpc.mockResolvedValueOnce({
        data: { state: "provisioned", organizerId: "org-1", organizationName: "Riverside Salsa Co", role: "owner" },
        error: null,
      });
      const result = await fetchFounderOnboardingState();
      expect(result).toEqual({
        state: "provisioned",
        organizerId: "org-1",
        organizationName: "Riverside Salsa Co",
        role: "owner",
      });
    });

    it("returns accepted_not_provisioned as-is", async () => {
      rpc.mockResolvedValueOnce({
        data: { state: "accepted_not_provisioned", founderRequestId: "req-1", organizationName: "Co" },
        error: null,
      });
      const result = await fetchFounderOnboardingState();
      expect(result.state).toBe("accepted_not_provisioned");
    });

    it("throws on an RPC error", async () => {
      rpc.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
      await expect(fetchFounderOnboardingState()).rejects.toThrow("boom");
    });

    it("throws when the RPC returns malformed data", async () => {
      rpc.mockResolvedValueOnce({ data: { nonsense: true }, error: null });
      await expect(fetchFounderOnboardingState()).rejects.toThrow();
    });

    it("throws when the RPC returns null data with no error", async () => {
      rpc.mockResolvedValueOnce({ data: null, error: null });
      await expect(fetchFounderOnboardingState()).rejects.toThrow();
    });
  });

  describe("provisionFounderOrganization", () => {
    it("calls provision_founder_organization with no arguments", async () => {
      rpc.mockResolvedValueOnce({
        data: { organizerId: "org-1", organizationName: "Co", role: "owner" },
        error: null,
      });
      await provisionFounderOrganization();
      expect(rpc).toHaveBeenCalledWith("provision_founder_organization");
      expect(rpc).toHaveBeenCalledTimes(1);
    });

    it("returns the organizer id, name, and role", async () => {
      rpc.mockResolvedValueOnce({
        data: { organizerId: "org-9", organizationName: "Havana Club Boston", role: "owner" },
        error: null,
      });
      const result = await provisionFounderOrganization();
      expect(result).toEqual({ organizerId: "org-9", organizationName: "Havana Club Boston", role: "owner" });
    });

    it("refreshes the session after a successful provision, so isOrganizer reflects the new role immediately", async () => {
      rpc.mockResolvedValueOnce({
        data: { organizerId: "org-1", organizationName: "Co", role: "owner" },
        error: null,
      });
      await provisionFounderOrganization();
      expect(refreshSession).toHaveBeenCalledTimes(1);
    });

    it("throws on an RPC error", async () => {
      rpc.mockResolvedValueOnce({ data: null, error: { message: "no accepted invitation" } });
      await expect(provisionFounderOrganization()).rejects.toThrow("no accepted invitation");
    });

    it("does not refresh the session when provisioning itself fails", async () => {
      rpc.mockResolvedValueOnce({ data: null, error: { message: "no accepted invitation" } });
      await expect(provisionFounderOrganization()).rejects.toThrow();
      expect(refreshSession).not.toHaveBeenCalled();
    });

    it("still returns the provisioned result when the session refresh itself fails", async () => {
      rpc.mockResolvedValueOnce({
        data: { organizerId: "org-1", organizationName: "Co", role: "owner" },
        error: null,
      });
      refreshSession.mockRejectedValueOnce(new Error("refresh failed"));
      const result = await provisionFounderOrganization();
      expect(result).toEqual({ organizerId: "org-1", organizationName: "Co", role: "owner" });
    });

    it("throws when the RPC returns no organizerId", async () => {
      rpc.mockResolvedValueOnce({ data: {}, error: null });
      await expect(provisionFounderOrganization()).rejects.toThrow();
    });
  });

  describe("requestFounderWelcomeEmail", () => {
    it("invokes send-founder-welcome-email with an empty body", async () => {
      invoke.mockResolvedValueOnce({ data: { success: true }, error: null });
      await requestFounderWelcomeEmail();
      expect(invoke).toHaveBeenCalledWith("send-founder-welcome-email", { body: {} });
    });

    it("never throws when the function returns an error", async () => {
      invoke.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
      await expect(requestFounderWelcomeEmail()).resolves.toBeUndefined();
    });

    it("never throws when invoke itself rejects", async () => {
      invoke.mockRejectedValueOnce(new Error("network down"));
      await expect(requestFounderWelcomeEmail()).resolves.toBeUndefined();
    });
  });
});
