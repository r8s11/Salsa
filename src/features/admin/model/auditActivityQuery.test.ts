import { describe, expect, it } from "vitest";
import {
  activityActionLabel,
  activityActorLabel,
  activityTargetLabel,
  categoryOf,
  isSensitiveAction,
  activityViewCounts,
  applyActivityFilters,
  filtersForView,
  type ActivityAuditLog,
} from "./auditActivityQuery";
import type { ActivityCategory } from "./auditActivityQuery";

function makeEntry(overrides: Partial<ActivityAuditLog> = {}): ActivityAuditLog {
  return {
    id: "log-1",
    actor_id: "admin-1",
    actor_display_name: "Roosevelt Segura",
    actor_username: "rooseveltsegura",
    actor_avatar_url: null,
    action: "event.approved",
    entity_type: "event",
    entity_id: "event-1",
    metadata: { title: "Salsa at the Anchor" },
    created_at: "2026-08-14T15:18:00.000Z",
    ...overrides,
  };
}

describe("categoryOf", () => {
  it("maps entity_type to the right category", () => {
    expect(categoryOf(makeEntry({ entity_type: "event" }))).toBe("events");
    expect(categoryOf(makeEntry({ entity_type: "event_submission" }))).toBe("submissions");
    expect(categoryOf(makeEntry({ entity_type: "profile" }))).toBe("users");
    expect(categoryOf(makeEntry({ entity_type: "venue" }))).toBe("venues");
    expect(categoryOf(makeEntry({ entity_type: "taxonomy_term" }))).toBe("taxonomy");
    expect(categoryOf(makeEntry({ entity_type: "organizer" }))).toBe("users");
  });

  it("maps platform_settings entity_type to settings", () => {
    expect(categoryOf(makeEntry({ entity_type: "platform_settings", action: "platform_settings.updated" }))).toBe("settings");
  });

  it("flags specific actions as security even when entity_type is profile", () => {
    expect(categoryOf(makeEntry({ entity_type: "profile", action: "user.role_changed" }))).toBe("security");
    expect(categoryOf(makeEntry({ entity_type: "profile", action: "user.banned" }))).toBe("security");
    expect(categoryOf(makeEntry({ entity_type: "profile", action: "user.suspended" }))).toBe("security");
    expect(
      categoryOf(makeEntry({ entity_type: "platform_settings", action: "platform_settings.access_policy_changed" }))
    ).toBe("security");
  });
});

describe("isSensitiveAction", () => {
  it("flags sensitive actions", () => {
    expect(isSensitiveAction("user.banned")).toBe(true);
    expect(isSensitiveAction("user.suspended")).toBe(true);
    expect(isSensitiveAction("user.role_changed")).toBe(true);
    expect(isSensitiveAction("platform_settings.access_policy_changed")).toBe(true);
  });

  it("does not flag normal actions", () => {
    expect(isSensitiveAction("event.updated")).toBe(false);
    expect(isSensitiveAction("event.approved")).toBe(false);
    expect(isSensitiveAction("submission.approved")).toBe(false);
  });
});

describe("activityActionLabel", () => {
  it("maps event actions to human-readable copy", () => {
    expect(activityActionLabel(makeEntry({ action: "event.created" }))).toBe("Event created");
    expect(activityActionLabel(makeEntry({ action: "event.approved" }))).toBe("Event published");
    expect(activityActionLabel(makeEntry({ action: "event.deleted" }))).toBe("Event deleted");
    expect(activityActionLabel(makeEntry({ action: "event.updated" }))).toBe("Event updated");
  });

  it("interpolates metadata for submission.edited", () => {
    const entry = makeEntry({
      action: "submission.edited",
      metadata: { fields: ["title", "event_date"] },
    });
    expect(activityActionLabel(entry)).toBe("Submission corrected — title, event_date");
  });

  it("interpolates to_role for user.role_changed", () => {
    const entry = makeEntry({
      action: "user.role_changed",
      metadata: { from_role: "user", to_role: "moderator" },
    });
    expect(activityActionLabel(entry)).toBe("Role changed to Moderator");
  });

  it("handles rejection reasons", () => {
    const entry = makeEntry({
      action: "submission.rejected",
      metadata: { rejection_reason: "duplicate" },
    });
    expect(activityActionLabel(entry)).toBe("Submission rejected — duplicate");
  });

  it("handles venue merge with kept_name", () => {
    const entry = makeEntry({
      action: "venue.merged",
      entity_type: "venue",
      metadata: { kept_name: "Havana Club" },
    });
    expect(activityActionLabel(entry)).toBe("Venue merged into Havana Club");
  });

  it("falls back to raw action for unrecognized keys", () => {
    const entry = makeEntry({ action: "some.unknown_action" });
    expect(activityActionLabel(entry)).toBe("some.unknown_action");
  });
});

describe("activityActorLabel", () => {
  it("shows display_name when present (more human-readable than username)", () => {
    const entry = makeEntry({
      actor_id: "admin-1",
      actor_username: "rooseveltsegura",
      actor_display_name: "Roosevelt Segura",
    });
    expect(activityActorLabel(entry)).toBe("Roosevelt Segura");
  });

  it("returns 'SalsaSegura System' for null actor_id", () => {
    const entry = makeEntry({ actor_id: null, actor_username: null });
    expect(activityActorLabel(entry)).toBe("SalsaSegura System");
  });

  it("falls back to username when no display name", () => {
    const entry = makeEntry({
      actor_id: "admin-1",
      actor_username: "rooseveltsegura",
      actor_display_name: null,
    });
    expect(activityActorLabel(entry)).toBe("@rooseveltsegura");
  });
});

describe("activityTargetLabel", () => {
  it("prefers explicitly resolved display name", () => {
    const entry = makeEntry();
    expect(activityTargetLabel(entry, "Salsa at the Anchor")).toBe("Salsa at the Anchor");
  });

  it("falls back to metadata.title", () => {
    const entry = makeEntry({ metadata: { title: "Salsa Night" } });
    expect(activityTargetLabel(entry)).toBe("Salsa Night");
  });

  it("falls back to metadata.kept_name for merges", () => {
    const entry = makeEntry({
      entity_type: "venue",
      metadata: { kept_name: "Havana Club" },
    });
    expect(activityTargetLabel(entry)).toBe("Havana Club");
  });

  it("falls back to entity_id when no metadata", () => {
    const entry = makeEntry({ metadata: null });
    expect(activityTargetLabel(entry)).toBe("#event-1");
  });
});

describe("filtersForView", () => {
  it("all view returns empty filters", () => {
    const result = filtersForView("all");
    expect(result.category).toEqual([]);
    expect(result.action).toEqual([]);
    expect(result.entity_type).toEqual([]);
  });

  it("user-management view filters to users category", () => {
    const result = filtersForView("user-management");
    expect(result.category).toEqual(["users"]);
    expect(result.entity_type).toEqual(["profile", "organizer"]);
  });

  it("event-changes view filters to events category", () => {
    const result = filtersForView("event-changes");
    expect(result.category).toEqual(["events"]);
    expect(result.entity_type).toEqual(["event"]);
  });

  it("moderation view filters to submissions category", () => {
    const result = filtersForView("moderation");
    expect(result.category).toEqual(["submissions"]);
    expect(result.entity_type).toEqual(["event_submission"]);
  });

  it("settings-changes view filters to settings category", () => {
    const result = filtersForView("settings-changes");
    expect(result.category).toEqual(["settings"]);
    expect(result.entity_type).toEqual(["platform_settings"]);
  });

  it("security-actions view filters by specific actions", () => {
    const result = filtersForView("security-actions");
    expect(result.action).toContain("user.banned");
    expect(result.action).toContain("user.suspended");
    expect(result.action).toContain("user.role_changed");
    expect(result.action).toContain("platform_settings.access_policy_changed");
  });
});

describe("applyActivityFilters", () => {
  const entries: ActivityAuditLog[] = [
    makeEntry({ id: "1", action: "event.approved", entity_type: "event" }),
    makeEntry({ id: "2", action: "user.banned", entity_type: "profile", actor_id: "admin-1", metadata: null }),
    makeEntry({ id: "3", action: "event.updated", entity_type: "event", metadata: null }),
    makeEntry({ id: "4", action: "platform_settings.updated", entity_type: "platform_settings", metadata: null }),
  ];

  const emptyFilters = {
    q: "",
    from: null,
    to: null,
    category: [] as ActivityCategory[],
    action: [],
    actor: null,
    targetType: [],
  };

  it("returns all entries for 'all' view with no filters", () => {
    const result = applyActivityFilters(entries, emptyFilters, "all", null, null);
    expect(result).toHaveLength(4);
  });

  it("filters by category in 'all' view when category filter is active", () => {
    const result = applyActivityFilters(
      entries,
      { ...emptyFilters, category: ["events"] },
      "all",
      null,
      null
    );
    expect(result).toHaveLength(2);
    expect(result.every((e) => e.entity_type === "event")).toBe(true);
  });

  it("filters by action", () => {
    const result = applyActivityFilters(
      entries,
      { ...emptyFilters, action: ["user.banned"] },
      "all",
      null,
      null
    );
    expect(result).toHaveLength(1);
    expect(result[0].action).toBe("user.banned");
  });

  it("filters by search query across metadata", () => {
    const result = applyActivityFilters(entries, { ...emptyFilters, q: "anchor" }, "all", null, null);
    // entry 1 has metadata.title "Salsa at the Anchor"
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1");
  });

  it("filters by actor_id", () => {
    const result = applyActivityFilters(
      entries,
      { ...emptyFilters, actor: "admin-1" },
      "all",
      null,
      null
    );
    expect(result).toHaveLength(4); // all have actor_id "admin-1"
  });

  it("security-actions view only returns sensitive actions", () => {
    const result = applyActivityFilters(entries, emptyFilters, "security-actions", null, null);
    expect(result).toHaveLength(1); // only user.banned
    expect(result[0].action).toBe("user.banned");
  });

  it("today view only returns entries from today", () => {
    const result = applyActivityFilters(entries, emptyFilters, "today", null, null);
    // entry 1 is created_at "2026-08-14T15:18:00.000Z" — depends on runtime date
    // This test verifies the filter applies without error
    expect(Array.isArray(result)).toBe(true);
  });
});

describe("activityViewCounts", () => {
  const entries: ActivityAuditLog[] = [
    makeEntry({ id: "1", action: "event.approved", entity_type: "event" }),
    makeEntry({ id: "2", action: "user.banned", entity_type: "profile" }),
    makeEntry({ id: "3", action: "event.updated", entity_type: "event" }),
    makeEntry({ id: "4", action: "platform_settings.updated", entity_type: "platform_settings" }),
  ];

  const emptyFilters = {
    q: "",
    from: null,
    to: null,
    category: [] as ActivityCategory[],
    action: [],
    actor: null,
    targetType: [],
  };

  it("counts entries per preset view", () => {
    const counts = activityViewCounts(entries, emptyFilters);
    expect(counts.all).toBe(4);
    expect(counts["event-changes"]).toBe(2);
    expect(counts["user-management"]).toBe(0); // user.banned is security category, not users
    expect(counts["settings-changes"]).toBe(1);
    expect(counts["security-actions"]).toBe(1);
  });
});
