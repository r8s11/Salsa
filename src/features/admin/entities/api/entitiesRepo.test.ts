import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveAdminEntity } from "./entitiesRepo";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock("../../../../lib/supabase", () => ({ supabase: { rpc } }));

beforeEach(() => rpc.mockReset());

describe("saveAdminEntity", () => {
  it("turns a duplicate organizer into an actionable message", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "23505", message: "duplicate key value" } });
    await expect(saveAdminEntity("organizer", null, { name: " Rob — Boston " })).rejects.toThrow(
      "An organizer named Rob — Boston already exists. Assign to it instead of creating another."
    );
  });

  it("keeps the database message for other failures", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "22023", message: "Invalid slug" } });
    await expect(saveAdminEntity("organizer", null, { name: "X" })).rejects.toThrow(
      "Failed to save organizer: Invalid slug"
    );
  });
});
