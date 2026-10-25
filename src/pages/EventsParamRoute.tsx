import { lazy, useLayoutEffect } from "react";
import { Navigate, useParams, useSearchParams } from "react-router-dom";
import HomePage from "./HomePage";
import { useCity } from "../contexts/useCity";
import { useMetros } from "../features/metros/hooks/useMetros";
import { resolveMetroSlug } from "../features/metros/model/metro";
import { normalizeSubLocation } from "../features/metros/model/sublocation";

const EventDetailPage = lazy(() => import("./EventDetailPage"));

const EVENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * `/events/:id` preserves legacy UUIDs and metro homes, and accepts event
 * slugs. Registered metro names and aliases retain routing priority.
 */
export default function EventsParamRoute() {
  const { id = "" } = useParams();
  return EVENT_ID.test(id) ? <EventDetailPage /> : <MetroHome segment={id} />;
}

function MetroHome({ segment }: { segment: string }) {
  const { metros, loading, error } = useMetros();
  const [searchParams] = useSearchParams();
  const slug = loading || error ? null : resolveMetroSlug(segment, metros);

  if (loading) return <HomePage />;
  if (!slug) return <EventDetailPage />;
  // Aliases (/events/nyc, /events/New-York) collapse onto one canonical URL.
  if (slug !== segment) {
    return <Navigate to={{ pathname: `/events/${slug}`, search: searchParams.toString() }} replace />;
  }
  return <CanonicalMetroHome slug={slug} />;
}

function CanonicalMetroHome({ slug }: { slug: string }) {
  const { setCity } = useCity();
  const [searchParams] = useSearchParams();
  const subLocation = normalizeSubLocation(slug, searchParams.get("borough"));

  // Visiting a metro URL is an explicit choice. Apply it before paint so the
  // previous metro's events never flash under this URL.
  useLayoutEffect(() => {
    setCity(slug, subLocation);
  }, [slug, subLocation, setCity]);

  return <HomePage />;
}
