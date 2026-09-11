import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  checkAccountDeletionEligibility,
  deleteCurrentAccount,
  type DeletionEligibility,
} from "./accountDeletion";

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("../../../lib/supabase", () => ({
  supabase: { functions: { invoke: mocks.invoke } },
}));

describe("account deletion client", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("requests server-backed eligibility without sending a target account id", async () => {
    const expected: DeletionEligibility = { outcome: "eligible" };
    mocks.invoke.mockResolvedValue({ data: expected, error: null });

    await expect(checkAccountDeletionEligibility()).resolves.toEqual(expected);
    expect(mocks.invoke).toHaveBeenCalledWith("delete-account", { body: { action: "eligibility" } });
  });

  it("returns a server-confirmed deletion only after the trusted request succeeds", async () => {
    mocks.invoke.mockResolvedValue({ data: { outcome: "deleted" }, error: null });

    await expect(deleteCurrentAccount()).resolves.toEqual({ outcome: "deleted" });
    expect(mocks.invoke).toHaveBeenCalledWith("delete-account", { body: { action: "delete" } });
  });

  it("fails closed when the response is missing or malformed", async () => {
    mocks.invoke.mockResolvedValue({ data: { outcome: "deleted" }, error: null });

    await expect(checkAccountDeletionEligibility()).rejects.toThrow(
      "We couldn't check whether account deletion is available. Please try again."
    );
  });
});
