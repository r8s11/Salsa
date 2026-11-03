import { useLayoutEffect, useMemo, type ReactNode } from "react";
import { Navigate, useParams } from "react-router-dom";
import { useCity } from "../../../contexts/useCity";
import NotFoundPage from "../../../pages/NotFoundPage";
import { useDocumentMeta } from "../../../shared/seo/useDocumentMeta";
import { useMetroName, useMetros } from "../../metros/hooks/useMetros";
import { resolveMetroSlug } from "../../metros/model/metro";
import ItineraryView from "../components/ItineraryView";
import { usePublishedItinerary } from "../hooks/useItineraryQueries";
import { buildPublicItineraryUrl } from "../model/itinerarySharing";
import { buildSchedule } from "../model/schedule";
import { formatWeekRange, weekStartFor } from "../model/week";

/**
 * `/itineraries/:city/:weekStart`. City aliases and non-Monday dates collapse
 * onto the canonical week URL before anything loads.
 */
export default function ItineraryPage() {
  const { city = "", weekStart = "" } = useParams();
  const { metros, loading, error } = useMetros();

  if (loading) return <Status role="status">Loading itinerary…</Status>;
  if (error) return <Status role="alert">We couldn&apos;t load this itinerary. Please try again.</Status>;

  const slug = resolveMetroSlug(city, metros);
  const monday = weekStartFor(weekStart);
  if (!slug || !monday) return <NotFoundPage />;
  if (slug !== city || monday !== weekStart) {
    return <Navigate to={`/itineraries/${slug}/${monday}`} replace />;
  }
  return <PublishedItinerary city={slug} weekStart={monday} />;
}

/** Loading and error states, as on the event detail page. */
function Status({ role, children }: { role: "status" | "alert"; children: ReactNode }) {
  return (
    <div className="itinerary-status" role={role}>
      {children}
    </div>
  );
}

function PublishedItinerary({ city, weekStart }: { city: string; weekStart: string }) {
  const { setCity } = useCity();
  const metroName = useMetroName();
  const { itinerary, items, events, neighbours, loading, error } = usePublishedItinerary(city, weekStart);
  const cityName = metroName(city);
  const weekLabel = formatWeekRange(weekStart);
  const schedule = useMemo(
    () => (itinerary ? buildSchedule({ ...itinerary, items }, events) : null),
    [itinerary, items, events]
  );

  // Visiting a metro's itinerary is an explicit metro choice, as on /events/<metro>.
  useLayoutEffect(() => {
    setCity(city);
  }, [city, setCity]);

  useDocumentMeta({
    title: itinerary?.title ?? `Dancing in ${cityName}, ${weekLabel}`,
    description: itinerary?.description ?? `Where to dance in ${cityName}, ${weekLabel}.`,
    canonical: buildPublicItineraryUrl(city, weekStart),
    image: itinerary?.coverImageUrl ?? undefined,
  });

  if (loading) return <Status role="status">Loading itinerary…</Status>;
  if (error) return <Status role="alert">We couldn&apos;t load this itinerary. Please try again.</Status>;
  if (!itinerary || !schedule) return <NotFoundPage />;

  return <ItineraryView itinerary={itinerary} schedule={schedule} cityName={cityName} neighbours={neighbours} />;
}
