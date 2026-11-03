import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import { fetchApprovedEventsByIds } from "../../events/api/eventsRepo";
import ItineraryView from "../../itineraries/components/ItineraryView";
import { adminItineraryKey, useItineraryDraft } from "../../itineraries/hooks/useItineraryQueries";
import { buildSchedule } from "../../itineraries/model/schedule";
import { useMetroName } from "../../metros/hooks/useMetros";

/** `/admin/itineraries/:id/preview`: the public page component with the stored draft. */
export default function AdminItineraryPreviewPage() {
  const { id = "" } = useParams();
  const metroName = useMetroName();
  const { itinerary, draft, loading, error } = useItineraryDraft(id);
  const ids = useMemo(() => draft?.items.map((item) => item.eventId) ?? [], [draft]);
  const events = useQuery({
    queryKey: [...adminItineraryKey(id), "events", ids],
    queryFn: () => fetchApprovedEventsByIds(ids),
    enabled: draft !== null,
  });
  const schedule = useMemo(
    () => (draft && events.data ? buildSchedule(draft, new Map(events.data.map((event) => [event.id, event]))) : null),
    [draft, events.data]
  );

  if (loading || events.isLoading) {
    return (
      <p className="admin-banner" role="status">
        Loading preview…
      </p>
    );
  }
  if (error || events.error || !itinerary || !schedule) {
    return (
      <p className="admin-banner admin-banner--error" role="alert">
        {error ?? events.error?.message ?? "This itinerary doesn't exist."}{" "}
        <Link to="/admin/itineraries">Back to itineraries</Link>
      </p>
    );
  }

  return (
    <div className="itinerary-preview">
      <Link
        to={itinerary.status === "archived" ? "/admin/itineraries" : `/admin/itineraries/${itinerary.id}`}
        className="admin-btn admin-btn--ghost admin-btn--sm"
      >
        <ArrowLeft size={16} aria-hidden="true" />
        {itinerary.status === "archived" ? "Back to itineraries" : "Back to the editor"}
      </Link>
      <ItineraryView
        itinerary={itinerary}
        schedule={schedule}
        cityName={metroName(itinerary.city)}
        draft={itinerary.status !== "published"}
      />
    </div>
  );
}
