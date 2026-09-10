import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AdminSubmissionStatusBadge from "./AdminSubmissionStatusBadge";

describe("AdminSubmissionStatusBadge", () => {
  it("renders pending status", () => {
    render(<AdminSubmissionStatusBadge status="pending" />);
    expect(screen.getByText("Pending")).toBeDefined();
  });

  it("renders approved status", () => {
    render(<AdminSubmissionStatusBadge status="approved" />);
    expect(screen.getByText("Approved")).toBeDefined();
  });
});
