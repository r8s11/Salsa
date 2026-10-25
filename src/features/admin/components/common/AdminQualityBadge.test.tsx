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

  it("uses a concise trigger label without hiding the quality issue details", () => {
    render(
      <AdminQualityBadge
        issues={["missing-organizer"]}
        labelFor={() => "Missing organizer"}
        eventTitle="Test Event"
        triggerLabel="Needs organizer"
      />
    );

    expect(
      screen.getByRole("button", { name: "1 quality issue: Missing organizer" })
    ).toHaveTextContent("Needs organizer");
  });
});
