import { lazy, useLayoutEffect } from "react";
import { Navigate, useParams } from "react-router-dom";
import HomePage from "./HomePage";
import { useCity } from "../contexts/useCity";
import { useMetros } from "../features/metros/hooks/useMetros";
import { resolveMetroSlug } from "../features/metros/model/metro";

const EventDetailPage = lazy(() => import("./EventDetailPage"));
const NotFoundPage = lazy(() => import("./NotFoundPage"));

const EVENT_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * `/events/:id` carries two kinds of page: an event (UUID) and a metro home
 * (`/events/new-york-city`). Event ids are UUIDs and metro slugs never are,
 * so the segment's shape decides.
 */
export default function EventsParamRoute() {
  const { id = "" } = useParams();
  return EVENT_ID.test(id) ? <EventDetailPage /> : <MetroHome segment={id} />;
}

function MetroHome({ segment }: { segment: string }) {
  const { metros, loading, error } = useMetros();
  const slug = loading || error ? null : resolveMetroSlug(segment, metros);

  if (loading) return <HomePage />;
  if (!slug) return <NotFoundPage />;
  // Aliases (/events/nyc, /events/New-York) collapse onto one canonical URL.
  if (slug !== segment) return <Navigate to={`/events/${slug}`} replace />;
  return <CanonicalMetroHome slug={slug} />;
}

function CanonicalMetroHome({ slug }: { slug: string }) {
  const { setCity } = useCity();

  // Visiting a metro URL is an explicit choice. Apply it before paint so the
  // previous metro's events never flash under this URL.
  useLayoutEffect(() => {
    setCity(slug);
  }, [slug, setCity]);


  return <HomePage />;
}
