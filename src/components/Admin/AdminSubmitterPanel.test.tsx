import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { AdminUserRow } from "../../features/admin/model/usersQuery";
import AdminSubmitterPanel from "./AdminSubmitterPanel";

describe("AdminSubmitterPanel", () => {
  it("renders registered submitter", () => {
    const user: AdminUserRow = {
      kind: "profile",
      id: "123",
      user_id: "123",
      email: "maria@example.com",
      display_name: "Maria Santos",
      username: "mariasalsa",
      avatar_url: null,
      role: "user",
      status: "active",
      status_reason: null,
      created_at: "2026-01-01",
      last_active_at: "2026-08-13",
      contributions: 7,
      pending_count: 0,
      email_confirmed_at: "2026-01-01",
      approved_count: 7,
    };

    render(
      <AdminSubmitterPanel submitter={{ user, previousSubmissionsCount: 7 }} />,
    );

    expect(screen.getByText("Maria Santos")).toBeDefined();
    expect(screen.getByText("@mariasalsa")).toBeDefined();
  });
});
