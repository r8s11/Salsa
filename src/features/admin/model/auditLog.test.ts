import { describe, expect, it } from "vitest";
import type { AdminUserRow } from "./usersQuery";
import { auditLogLabelFor, actorLabelFor, latestActionEntry, type AuditLogRow } from "./auditLog";

function makeEntry(overrides: Partial<AuditLogRow> = {}): AuditLogRow {
  return {
    id: "log-1",
    actor_id: "admin-1",
    action: "user.role_changed",
    entity_type: "profile",
    entity_id: "user-1",
    metadata: { from_role: "user", to_role: "moderator" },
    created_at: "2026-08-11T00:00:00.000Z",
    ...overrides,
  };
}

function makeUser(overrides: Partial<AdminUserRow> = {}): AdminUserRow {
  return {
    kind: "profile",
    id: "admin-1",
    user_id: "admin-1",
    email: "admin@salsa.test",
    display_name: "Roosevelt Segura",
    username: "rooseveltsegura",
    avatar_url: null,
    role: "admin",
    status: "active",
    status_reason: null,
    created_at: "2026-01-01T00:00:00.000Z",
    last_active_at: "2026-08-01T00:00:00.000Z",
    contributions: 0,
    pending_count: 0,
    email_confirmed_at: "2026-01-01T00:00:00.000Z",
    approved_count: 0,
    ...overrides,
  };
}

describe("auditLogLabelFor", () => {
  it("role_changed reads the target role from metadata", () => {
    const entry = makeEntry({ action: "user.role_changed", metadata: { to_role: "moderator" } });
    expect(auditLogLabelFor(entry)).toBe("Role changed to Moderator");
  });

  it("flagged includes the reason when present", () => {
    const entry = makeEntry({ action: "user.flagged", metadata: { reason: "Spam" } });
    expect(auditLogLabelFor(entry)).toBe("Account flagged — Spam");
  });

  it("flagged omits the dash when there is no reason", () => {
    const entry = makeEntry({ action: "user.flagged", metadata: {} });
    expect(auditLogLabelFor(entry)).toBe("Account flagged");
  });

  it("unflagged, restored, suspended, banned each have fixed or reason-aware copy", () => {
    expect(auditLogLabelFor(makeEntry({ action: "user.unflagged", metadata: {} }))).toBe(
      "Flag removed"
    );
    expect(auditLogLabelFor(makeEntry({ action: "user.restored", metadata: {} }))).toBe(
      "Access restored"
    );
    expect(
      auditLogLabelFor(
        makeEntry({
          action: "user.suspended",
          metadata: { reason: "Repeated inaccurate submissions" },
        })
      )
    ).toBe("Account suspended — Repeated inaccurate submissions");
    expect(
      auditLogLabelFor(makeEntry({ action: "user.banned", metadata: { reason: "Harassment" } }))
    ).toBe("Account banned — Harassment");
  });

  it("falls back to the raw action string for anything unrecognized", () => {
    expect(auditLogLabelFor(makeEntry({ action: "event.created", metadata: {} }))).toBe(
      "event.created"
    );
  });
});

describe("actorLabelFor", () => {
  it("resolves to @username when the actor is in the users list and has a username", () => {
    const users = [makeUser({ user_id: "admin-1", username: "rooseveltsegura" })];
    expect(actorLabelFor("admin-1", users)).toBe("@rooseveltsegura");
  });

  it("falls back to displayNameFor when the actor has no username", () => {
    const users = [
      makeUser({ user_id: "admin-1", username: null, display_name: "Roosevelt Segura" }),
    ];
    expect(actorLabelFor("admin-1", users)).toBe("Roosevelt Segura");
  });

  it("returns 'System' for a null actor id", () => {
    expect(actorLabelFor(null, [])).toBe("System");
  });

  it("returns 'Unknown admin' when the actor id doesn't match anyone in the list", () => {
    expect(actorLabelFor("nobody", [makeUser({ user_id: "admin-1" })])).toBe("Unknown admin");
  });
});

describe("latestActionEntry", () => {
  it("returns the first entry whose action is in the given list, given entries are already newest-first", () => {
    const entries = [
      makeEntry({
        id: "log-2",
        action: "user.role_changed",
        created_at: "2026-08-11T00:00:00.000Z",
      }),
      makeEntry({ id: "log-1", action: "user.suspended", created_at: "2026-08-10T00:00:00.000Z" }),
    ];
    expect(latestActionEntry(entries, ["user.suspended", "user.banned"])?.id).toBe("log-1");
  });

  it("returns null when nothing matches", () => {
    const entries = [makeEntry({ action: "user.role_changed" })];
    expect(latestActionEntry(entries, ["user.banned"])).toBeNull();
  });
});
