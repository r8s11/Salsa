import { Link, useParams } from "react-router-dom";
import NotFoundPage from "./NotFoundPage";
import { useDocumentMeta } from "../shared/seo/useDocumentMeta";
import { canonicalUrl } from "../utils/seo";
import { useEntityDetail } from "../features/entities/hooks/useEntityDetail";
import { InstructorProfile } from "../features/entities/components/InstructorProfile";
import { SchoolProfile } from "../features/entities/components/SchoolProfile";
import { entityExternalLinks } from "../features/entities/externalLinks";
import { entityLocation, formatEventDate } from "../features/entities/format";
import { ENTITY_LABELS, entityHref, type EventSummary, type PublicEntityKind, type PublicEntityRef } from "../features/entities/model";
import { EntityClaimControl } from "../features/workspaces/components/public/EntityClaimControl";
import "./PublicEntityPage.css";

function EventList({ title, events }: { title: string; events: EventSummary[] }) {
  return (
    <section className="public-entity-page__events" aria-labelledby={`entity-events-${title.toLowerCase()}`}>
      <h2 id={`entity-events-${title.toLowerCase()}`}>{title}</h2>
      {events.length === 0 ? (
        <p className="public-entity-page__empty">No {title.toLowerCase()} events listed.</p>
      ) : (
        <ul>
          {events.map((event) => (
            <li key={event.id}>
              <Link className="public-entity-page__event" to={entityHref({ kind: "event", slug: event.slug })}>
                {event.image_url && <img src={event.image_url} alt="" loading="lazy" />}
                <span className="public-entity-page__event-copy">
                  <strong>{event.title}</strong>
                  <span>{formatEventDate(event.event_date)}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function EntityLinks({ entities }: { entities: PublicEntityRef[] }) {
  return (
    <ul className="public-entity-page__related-list">
      {entities.map((entity) => (
        <li key={`${entity.kind}:${entity.id}`}>
          <Link to={entityHref(entity)}>{entity.name}<span>{ENTITY_LABELS[entity.kind]}</span></Link>
        </li>
      ))}
    </ul>
  );
}

export default function PublicEntityPage({ kind }: { kind: PublicEntityKind }) {
  const { slug = "" } = useParams<{ slug: string }>();
  const { data, isPending, error, refetch } = useEntityDetail(kind, slug);
  const entity = data?.entity;
  useDocumentMeta({
    title: entity?.name ?? ENTITY_LABELS[kind],
    description: entity?.description ?? `Find ${ENTITY_LABELS[kind].toLowerCase()} information and related dance events on Salsa Segura.`,
    canonical: canonicalUrl(entityHref(entity ?? { kind, slug })),
    robots: entity ? "index, follow" : "noindex, follow",
    image: entity?.image_url,
  });

  if (!slug) return <NotFoundPage />;
  if (isPending) {
    return <div className="public-entity-page" role="status">Loading {ENTITY_LABELS[kind].toLowerCase()}…</div>;
  }
  if (error) {
    return (
      <section className="public-entity-page" role="alert">
        <h1>Couldn’t load this {ENTITY_LABELS[kind].toLowerCase()}</h1>
        <p>Check your connection and try again.</p>
        <button type="button" className="ui-button ui-button--secondary" onClick={() => void refetch()}>Try again</button>
      </section>
    );
  }
  if (!data || !entity) return <NotFoundPage />;

  if (kind === "school") return <SchoolProfile detail={data} />;
  if (kind === "instructor") return <InstructorProfile detail={data} />;

  const { website, instagram } = entityExternalLinks(entity);
  const location = entityLocation(entity);

  return (
    <article className="public-entity-page" aria-labelledby="public-entity-title">
      {entity.image_url && <img className="public-entity-page__hero" src={entity.image_url} alt="" />}
      <header className="public-entity-page__intro">
        <h1 id="public-entity-title">{entity.name}</h1>
        <p className="public-entity-page__kind">{ENTITY_LABELS[kind]}</p>
        {location && <p className="public-entity-page__location">{location}</p>}
        {entity.description && <p className="public-entity-page__description">{entity.description}</p>}
        {(website || instagram) && (
          <nav className="public-entity-page__external" aria-label={`${entity.name} external links`}>
            {website && <a href={website} target="_blank" rel="noopener noreferrer">Website</a>}
            {instagram && <a href={instagram} target="_blank" rel="noopener noreferrer">Instagram</a>}
          </nav>
        )}
        {entity.origin === "flyer" && <p className="public-entity-page__note">Added from an event flyer after review. Business details have not been independently verified.</p>}
      </header>
      <div className="public-entity-page__body">
        <div className="public-entity-page__event-groups">
          <EventList title="Upcoming" events={data.upcoming} />
          <EventList title="Past" events={data.past} />
        </div>
        {data.related.length > 0 && (
          <aside className="public-entity-page__related" aria-labelledby="public-entity-related-title">
            <h2 id="public-entity-related-title">Related</h2>
            <EntityLinks entities={data.related} />
          </aside>
        )}
      </div>
      <footer className="public-entity-page__footer">
        {kind === "venue" && <EntityClaimControl kind={kind} entity={entity} />}
        <Link className="public-entity-page__browse" to="/discover">Discover dance communities</Link>
      </footer>
    </article>
  );
}
