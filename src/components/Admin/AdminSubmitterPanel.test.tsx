import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AdminSubmitterPanel from "./AdminSubmitterPanel";
import { AdminUserRow } from "../../features/admin/model/types";

describe("AdminSubmitterPanel", () => {
  it("renders registered submitter", () => {
    const user: AdminUserRow = {
      user_id: "123",
      kind: "profile",
      display_name: "Maria Santos",
      username: "mariasalsa",
      role: "user",
      email: "maria@example.com",
      status: "active",
      contributions: 7,
      created_at: "2026-01-01",
      last_active_at: "2026-08-13",
    };
    render(
      <AdminSubmitterPanel
        submitter={{
          user,
          previousSubmissionsCount: 7,
        }}
      />
    );
    expect(screen.getByText("Maria Santos")).toBeDefined();
    expect(screen.getByText("@mariasalsa")).toBeDefined();
  });
});
