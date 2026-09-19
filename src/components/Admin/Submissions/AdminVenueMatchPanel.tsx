import { findVenueMatch } from "../../../features/admin/model/venueMatching";
import type { EventSubmission } from "../../../features/admin/model/submissions";
import type { DatabaseEvent } from "../../../features/events/model/types";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import "./AdminVenueMatchPanel.css";

interface Props {
  submission: EventSubmission;
  existingEvents: DatabaseEvent[];
  onUseVenue: (venueName: string) => void;
}

export default function AdminVenueMatchPanel({ submission, existingEvents, onUseVenue }: Props) {
  const match = findVenueMatch(submission, existingEvents);

  return (
    <div className="admin-card admin-venue-match-panel">
      <h3 className="admin-venue-match-panel__heading">Venue Matching</h3>
      {!match ? (
        <div className="admin-venue-match-panel__no-match">
          New venue — will be recorded as free text.
        </div>
      ) : (
        <>
          <div
            className={`admin-venue-match-panel__status admin-venue-match-panel__status--${match.match}`}
            role="status"
          >
            {match.match === "exact" ? (
              <>
                <CheckCircle2 size={16} aria-hidden="true" />
                <span>Exact venue match found</span>
              </>
            ) : (
              <>
                <AlertTriangle size={16} aria-hidden="true" />
                <span>Potential venue match found</span>
              </>
            )}
          </div>
          <div className="admin-venue-match-panel__existing">
            <div className="admin-venue-match-panel__existing-label">Existing venue:</div>
            <div>{match.existingEvent.location}</div>
            <div className="admin-venue-match-panel__existing-address">
              {match.existingEvent.address}
            </div>
          </div>
          <button
            type="button"
            className="admin-btn admin-btn--primary admin-btn--sm"
            onClick={() => onUseVenue(match.existingEvent.location || "")}
          >
            Use Existing Venue
          </button>
        </>
      )}
    </div>
  );
}
