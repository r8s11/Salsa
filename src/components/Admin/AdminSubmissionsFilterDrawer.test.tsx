import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import AdminSubmissionsFilterDrawer from "./AdminSubmissionsFilterDrawer";

describe("AdminSubmissionsFilterDrawer", () => {
  it("renders correctly when open", () => {
    const onClose = vi.fn();
    const onFiltersChange = vi.fn();
    render(
      <AdminSubmissionsFilterDrawer
        open={true}
        submissions={[]}
        filters={{ status: null, submitter_name: null }}
        onFiltersChange={onFiltersChange}
        onClose={onClose}
      />
    );
    expect(screen.getByText("Filters")).toBeInTheDocument();
  });
});
