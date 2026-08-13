import { render, screen, fireEvent } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import AdminVenueMatchPanel from "./AdminVenueMatchPanel";
import { EventSubmission } from "../../../features/submissions/model/submissions";
import { DatabaseEvent } from "../../../features/events/model/types";

describe("AdminVenueMatchPanel", () => {
  const mockSubmission = {
    submitted_data: { location: "Havana Club" },
  } as EventSubmission;

  const mockExistingEvent = {
    location: "havana club",
    address: "123 Street",
  } as DatabaseEvent;

  it("renders new venue when no match found", () => {
    render(<AdminVenueMatchPanel submission={{ location: "New Place" } as EventSubmission} existingEvents={[]} onUseVenue={() => {}} />);
    expect(screen.getByText(/New venue — will be recorded as free text/)).toBeDefined();
  });

  it("renders exact match and action button", () => {
    const handleUseVenue = vi.fn();
    render(<AdminVenueMatchPanel submission={mockSubmission} existingEvents={[mockExistingEvent]} onUseVenue={handleUseVenue} />);
    
    expect(screen.getByText(/Exact venue match found/)).toBeDefined();
    expect(screen.getByText("havana club")).toBeDefined();
    
    const button = screen.getByText(/Use Existing Venue/);
    fireEvent.click(button);
    expect(handleUseVenue).toHaveBeenCalledWith("havana club");
  });
});
