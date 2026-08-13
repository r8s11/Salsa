import { findVenueMatch, VenueMatch } from "../../../features/admin/model/venueMatching";
import { EventSubmission } from "../../../features/submissions/model/submissions";
import { DatabaseEvent } from "../../../features/events/model/types";

interface Props {
  submission: EventSubmission;
  existingEvents: DatabaseEvent[];
  onUseVenue: (venueName: string) => void;
}

export default function AdminVenueMatchPanel({ submission, existingEvents, onUseVenue }: Props) {
  const match = findVenueMatch(submission, existingEvents);

  return (
    <div className="admin-card">
      <h3 className="admin-text-lg font-semibold mb-4">Venue Matching</h3>
      {!match ? (
        <div className="text-sm text-gray-500">
          New venue — will be recorded as free text.
        </div>
      ) : (
        <div className="space-y-4">
          <div className={`admin-match-status ${match.match === 'exact' ? 'text-green-600' : 'text-yellow-600'}`}>
            {match.match === 'exact' ? '✓ Exact venue match found' : '⚠ Potential venue match found'}
          </div>
          <div className="bg-gray-50 p-3 rounded text-sm">
            <div className="font-medium text-gray-700">Existing venue:</div>
            <div>{match.existingEvent.location}</div>
            <div className="text-gray-500">{match.existingEvent.address}</div>
          </div>
          <button
            onClick={() => onUseVenue(match.existingEvent.location || "")}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded hover:bg-blue-700 transition"
          >
            Use Existing Venue
          </button>
        </div>
      )}
    </div>
  );
}
