import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import AdminSubmissionQualityPanel from "./AdminSubmissionQualityPanel";
import { QualityGap } from "../../../features/admin/model/quality";

describe("AdminSubmissionQualityPanel", () => {
  it("renders 'All information provided' when there are no gaps", () => {
    render(<AdminSubmissionQualityPanel gaps={[]} />);
    expect(screen.getByText(/All information provided/i)).toBeInTheDocument();
  });

  it("renders issues grouped by tier", () => {
    const gaps: QualityGap[] = [
      { issue: "title", tier: "required" },
      { issue: "location", tier: "recommended" },
      { issue: "host", tier: "optional" },
    ];
    render(<AdminSubmissionQualityPanel gaps={gaps} />);

    expect(screen.getByText(/Required/i)).toBeInTheDocument();
    expect(screen.getByText(/Event title/i)).toBeInTheDocument();
    
    expect(screen.getByText(/Recommended/i)).toBeInTheDocument();
    expect(screen.getByText(/Venue\/location/i)).toBeInTheDocument();
    
    expect(screen.getByText(/Optional/i)).toBeInTheDocument();
    expect(screen.getByText(/Organizer\/Host/i)).toBeInTheDocument();
  });
});
