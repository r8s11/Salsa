import { lazy, useLayoutEffect } from "react";
import { Navigate, useParams } from "react-router-dom";
import HomePage from "./HomePage";
import { useCity } from "../contexts/useCity";
import { useMetros } from "../features/metros/hooks/useMetros";
import { resolveMetroSlug } from "../features/metros/model/metro";
import { useDocumentMeta } from "../shared/seo/useDocumentMeta";

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
  const name = metros.find((metro) => metro.slug === slug)?.name ?? slug;
  return <CanonicalMetroHome slug={slug} name={name} />;
}

function CanonicalMetroHome({ slug, name }: { slug: string; name: string }) {
  const { setCity } = useCity();

  // Visiting a metro URL is an explicit choice. Apply it before paint so the
  // previous metro's events never flash under this URL.
  useLayoutEffect(() => {
    setCity(slug);
  }, [slug, setCity]);

  useDocumentMeta({
    title: `Salsa & Bachata Events in ${name}`,
    description: `Salsa and bachata socials, classes, and workshops in ${name}, curated by Salsa Segura.`,
    canonical: `${window.location.origin}/events/${slug}`,
  });

  return <HomePage />;
}
