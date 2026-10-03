import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { supabase } from "../lib/supabase";
import NotFoundPage from "./NotFoundPage";
import { useDocumentMeta } from "../shared/seo/useDocumentMeta";
import { canonicalUrl } from "../utils/seo";
import "./PublicEntityPage.css";

type Kind = "venue" | "organizer" | "instructor" | "school";
type PublicEntity = {
  id: string;
  name: string;
  slug: string;
  address?: string | null;
  city?: string | null;
  state_region?: string | null;
  country?: string | null;
  website?: string | null;
  instagram?: string | null;
  origin?: string | null;
};
const ROUTES: Record<Kind, string> = { venue: "v", organizer: "o", instructor: "i", school: "s" };
const LABELS: Record<Kind, string> = {
  venue: "Venue",
  organizer: "Organizer",
  instructor: "Instructor",
  school: "School",
};

export default function PublicEntityPage({ kind }: { kind: Kind }) {
  const { slug = "" } = useParams<{ slug: string }>();
  const { data, isPending, error, refetch } = useQuery({
    queryKey: ["public-entity", kind, slug],
    queryFn: async (): Promise<PublicEntity | null> => {
      const result = await supabase.rpc("public_flyer_entity", { p_kind: kind, p_slug: slug });
      if (result.error) throw new Error("Entity lookup failed.");
      return result.data as PublicEntity | null;
    },
    enabled: Boolean(slug),
  });
  useDocumentMeta({
    title: data?.name ?? LABELS[kind],
    description: data
      ? `${data.name} on Salsa Segura.`
      : `Find ${LABELS[kind].toLowerCase()} information on Salsa Segura.`,
    canonical: canonicalUrl(`/${ROUTES[kind]}/${encodeURIComponent(slug)}`),
    robots: "noindex, follow",
  });
  if (!slug) return <NotFoundPage />;
  if (isPending)
    return (
      <div className="public-entity-page" role="status">
        Loading {LABELS[kind].toLowerCase()}…
      </div>
    );
  if (error)
    return (
      <div className="public-entity-page" role="alert">
        <p>We couldn’t load this {LABELS[kind].toLowerCase()}.</p>
        <button
          type="button"
          className="ui-button ui-button--secondary"
          onClick={() => void refetch()}
        >
          Try again
        </button>
      </div>
    );
  if (!data) return <NotFoundPage />;
  const website = data.website && /^https?:\/\//i.test(data.website) ? data.website : null;
  const handle = data.instagram
    ?.replace(/^https?:\/\/(?:www\.)?instagram\.com\//i, "")
    .replace(/^@/, "")
    .replace(/\/$/, "");
  const instagram =
    handle && /^[a-z0-9._]+$/i.test(handle) ? `https://www.instagram.com/${handle}/` : null;
  const location = [data.address, data.city, data.state_region, data.country]
    .filter(Boolean)
    .join(", ");
  return (
    <article className="public-entity-page" aria-labelledby="public-entity-title">
      <h1 id="public-entity-title">{data.name}</h1>
      <p>{LABELS[kind]}</p>
      {location && <p>{location}</p>}
      {(website || instagram) && (
        <nav aria-label={`${data.name} external links`}>
          {website && (
            <a href={website} target="_blank" rel="noopener noreferrer">
              Website
            </a>
          )}
          {instagram && (
            <a href={instagram} target="_blank" rel="noopener noreferrer">
              Instagram
            </a>
          )}
        </nav>
      )}
      {data.origin === "flyer" && (
        <p className="public-entity-page__note">
          Added from an event flyer after review. Business details have not been independently
          verified.
        </p>
      )}
      <Link to="/calendar">Find dance events</Link>
    </article>
  );
}
