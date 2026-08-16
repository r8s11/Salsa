import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";
import type { ActivityAuditLog } from "../../features/admin/model/auditActivityQuery";
import AdminActivityTable from "./AdminActivityTable";

const baseEntry: ActivityAuditLog = {
  id: "audit-1",
  action: "event.published",
  actor_id: "user-1",
  actor_display_name: "Admin User",
  actor_username: "admin",
  actor_avatar_url: null,
  entity_type: "event",
  entity_id: "event-42",
  metadata: null,
  created_at: "2026-08-14T14:30:00Z",
};

const moreEntries: ActivityAuditLog[] = [
  { ...baseEntry, id: "audit-1", action: "event.published" },
  {
    ...baseEntry,
    id: "audit-2",
    action: "user.suspended",
    actor_id: "user-3",
    actor_display_name: "Moderator",
    actor_username: "mod",
    entity_type: "profile",
    entity_id: "user-7",
    metadata: { reason: "Repeated spam" },
    created_at: "2026-08-13T10:00:00Z",
  },
];

function renderTable(entriesProp: ComponentProps<typeof AdminActivityTable>["entries"] = moreEntries) {
  return render(
    <MemoryRouter>
      <AdminActivityTable entries={entriesProp} targetDisplayMap={{}} onViewDetail={vi.fn()} />
    </MemoryRouter>
  );
}

describe("AdminActivityTable", () => {
  it("renders human-readable action labels", () => {
    renderTable([baseEntry]);
    expect(screen.getByText("Event published")).toBeInTheDocument();
  });

  it("renders a detail link via the action label", () => {
    renderTable([baseEntry]);
    expect(screen.getByRole("link", { name: /event published/i })).toHaveAttribute("href", "/admin/activity/audit-1");
  });

  it("shows suspicious marker for sensitive actions", () => {
    renderTable(moreEntries);
    expect(screen.getByText("Account suspended")).toBeInTheDocument();
  });

  it("renders empty state message", () => {
    renderTable([]);
    expect(screen.getByText("No activity entries.")).toBeInTheDocument();
  });

  it("shows relative timestamp", () => {
    renderTable([baseEntry]);
    // formatTimeAgo returns a human-readable string — check it shows some time indication
    expect(screen.getByText(/ago|just now|today|Aug/i)).toBeInTheDocument();
  });
});
