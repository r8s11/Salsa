import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import AdminQualityBadge from "./AdminQualityBadge";

describe("AdminQualityBadge", () => {
  it("renders custom labels", () => {
    render(
      <AdminQualityBadge
        issues={["custom-issue"]}
        labelFor={(issue) => `Custom: ${issue}`}
        eventTitle="Test Event"
      />
    );
    expect(screen.getByText("Custom: custom-issue")).toBeDefined();
  });
});
