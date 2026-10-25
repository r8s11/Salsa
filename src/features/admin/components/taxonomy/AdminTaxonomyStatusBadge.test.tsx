import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AdminTaxonomyStatusBadge from "./AdminTaxonomyStatusBadge";

describe("AdminTaxonomyStatusBadge", () => {
  it("names archived status in text", () => {
    render(<AdminTaxonomyStatusBadge status="archived" />);
    expect(screen.getByText("Archived")).toBeVisible();
  });
});
