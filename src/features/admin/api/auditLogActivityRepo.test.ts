import { describe, expect, it, vi } from "vitest";
import { fetchActivityLogs, fetchActivityLog } from "./auditLogActivityRepo";

// Mock supabase — we only care that the right RPC is called with the right params.
const mockRpc = vi.fn();

vi.mock("../../../lib/supabase", () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

describe("fetchActivityLogs", () => {
  it("calls admin_audit_log RPC with paginated filter params", async () => {
    mockRpc.mockResolvedValueOnce({
      data: [
        {
          id: "log-1",
          actor_id: "admin-1",
          actor_display_name: "Roosevelt",
          actor_username: "rooseveltsegura",
          actor_avatar_url: null,
          action: "event.approved",
          entity_type: "event",
          entity_id: "event-1",
          metadata: { title: "Salsa Night" },
          created_at: "2026-08-14T15:18:00Z",
        },
      ],
      error: null,
    });

    const result = await fetchActivityLogs({
      limit: 25,
      offset: 0,
      q: "salsa",
      category: ["events"],
      action: null,
      actor_id: null,
      entity_type: null,
      from: null,
      to: null,
    });

    expect(mockRpc).toHaveBeenCalledWith("admin_audit_log", {
      p_action: null,
      p_actor_id: null,
      p_category: ["events"],
      p_entity_type: null,
      p_from: null,
      p_limit: 25,
      p_offset: 0,
      p_q: "salsa",
      p_to: null,
    });
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].id).toBe("log-1");
  });

  it("returns empty entries when RPC returns null data", async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: null });
    const result = await fetchActivityLogs({
      limit: 25,
      offset: 0,
      q: null,
      category: null,
      action: null,
      actor_id: null,
      entity_type: null,
      from: null,
      to: null,
    });
    expect(result.entries).toEqual([]);
    expect(result.total).toBe(0);
  });

  it("throws when RPC returns an error", async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: "DB error" } });
    await expect(
      fetchActivityLogs({
        limit: 25,
        offset: 0,
        q: null,
        category: null,
        action: null,
        actor_id: null,
        entity_type: null,
        from: null,
        to: null,
      })
    ).rejects.toThrow("DB error");
  });
});

describe("fetchActivityLog", () => {
  it("queries admin_audit_log_detail and maps the enriched row", async () => {
    const fakeRow = {
      id: "log-1",
      actor_id: "admin-1",
      actor_display_name: "Admin User",
      actor_username: "admin",
      actor_avatar_url: null,
      action: "user.banned",
      entity_type: "profile",
      entity_id: "user-1",
      metadata: { reason: "spam" },
      created_at: "2026-08-14T14:00:00Z",
    };
    mockRpc.mockResolvedValueOnce({ data: [fakeRow], error: null });

    const result = await fetchActivityLog("log-1");

    expect(mockRpc).toHaveBeenCalledWith("admin_audit_log_detail", { p_id: "log-1" });
    expect(result).toEqual({
      id: "log-1",
      actor_id: "admin-1",
      actor_display_name: "Admin User",
      actor_username: "admin",
      actor_avatar_url: null,
      action: "user.banned",
      entity_type: "profile",
      entity_id: "user-1",
      metadata: { reason: "spam" },
      created_at: "2026-08-14T14:00:00Z",
    });
  });

  it("returns null when the entry does not exist", async () => {
    mockRpc.mockResolvedValueOnce({ data: [], error: null });
    const result = await fetchActivityLog("nonexistent");
    expect(result).toBeNull();
  });

  it("throws when the RPC returns an error", async () => {
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: "admin role required" } });
    await expect(fetchActivityLog("log-1")).rejects.toThrow("admin role required");
  });
});
