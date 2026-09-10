import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AdminOrganizerRequestsToolbar from "./AdminOrganizerRequestsToolbar";

function renderToolbar() {
  render(
    <AdminOrganizerRequestsToolbar
      filters={{ q: "", type: [], accountStatus: [], from: null, to: null }}
      onFiltersChange={vi.fn()}
      sort={{ key: "requested", dir: "desc" }}
      onSortChange={vi.fn()}
      drawerFilterCount={0}
      onOpenDrawer={vi.fn()}
    />
  );
}

describe("AdminOrganizerRequestsToolbar", () => {
  it("uses a concise applicant and brand search prompt", () => {
    renderToolbar();

    expect(screen.getByPlaceholderText("Search applicants or brands")).toHaveAccessibleName(
      "Search organizer requests"
    );
  });
});
