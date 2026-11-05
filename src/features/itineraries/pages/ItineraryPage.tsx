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
import type { Itinerary } from "../model/types";
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
  const schedule = useMemo(
    () => (itinerary ? buildSchedule({ ...itinerary, items }, events) : null),
    [itinerary, items, events]
  );

  // Visiting a metro's itinerary is an explicit metro choice, as on /events/<metro>.
  useLayoutEffect(() => {
    setCity(city);
  }, [city, setCity]);

  if (loading) return <Status role="status">Loading itinerary…</Status>;
  if (error) return <Status role="alert">We couldn&apos;t load this itinerary. Please try again.</Status>;
  if (!itinerary || !schedule) return <NotFoundPage />;

  return (
    <>
      <ItineraryMeta itinerary={itinerary} cityName={cityName} />
      <ItineraryView itinerary={itinerary} schedule={schedule} cityName={cityName} neighbours={neighbours} />
    </>
  );
}

/** Mounted only for a published week, so NotFoundPage owns missing-week metadata. */
function ItineraryMeta({ itinerary, cityName }: { itinerary: Itinerary; cityName: string }) {
  useDocumentMeta({
    title: itinerary.title,
    description:
      itinerary.description ?? `Where to dance in ${cityName}, ${formatWeekRange(itinerary.weekStart)}.`,
    canonical: buildPublicItineraryUrl(itinerary.city, itinerary.weekStart),
    image: itinerary.coverImageUrl ?? undefined,
  });
  return null;
}
