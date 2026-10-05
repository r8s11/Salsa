import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { useDocumentMeta } from "../../../shared/seo/useDocumentMeta";
import { canonicalUrl } from "../../../utils/seo";
import { useMetros } from "../../metros/hooks/useMetros";
import { ENTITY_LABELS, PUBLIC_ENTITY_KINDS, entityHref, type PublicEntityKind, type PublicEntityRef } from "../model";
import { useEntityDirectory } from "../hooks/useEntityDirectory";
import "./EntityDirectoryPage.css";

const PAGE_SIZE = 24;
const DIRECTORY_PATHS: Record<PublicEntityKind, string> = {
  event: "/calendar",
  series: "/series",
  organizer: "/organizers",
  venue: "/venues",
  school: "/schools",
  instructor: "/instructors",
  city: "/cities",
  style: "/styles",
};

type DirectoryCriteria = { query: string; city: string; kind?: PublicEntityKind; offset: number };
const ENTITY_COLLECTIONS: Record<PublicEntityKind, string> = {
  event: "events",
  series: "series",
  organizer: "organizers",
  venue: "venues",
  school: "schools",
  instructor: "instructors",
  city: "cities",
  style: "dance styles",
};

function EntityCard({ entity }: { entity: PublicEntityRef }) {
  return (
    <Link className="entity-directory__result-link" to={entityHref(entity)}>
      {entity.image_url && <img src={entity.image_url} alt="" loading="lazy" />}
      <span className="entity-directory__result-copy">
        <span className="entity-directory__result-kind">{ENTITY_LABELS[entity.kind]}</span>
        <h2 className="entity-directory__result-name">{entity.name}</h2>
        {entity.city && <span className="entity-directory__result-city">{entity.city.replace(/-/g, " ")}</span>}
        {entity.description && <span className="entity-directory__result-description">{entity.description}</span>}
      </span>
    </Link>
  );
}

export default function EntityDirectoryPage({ kind }: { kind?: PublicEntityKind }) {
  const [draftQuery, setDraftQuery] = useState("");
  const [draftCity, setDraftCity] = useState("");
  const [draftKind, setDraftKind] = useState<PublicEntityKind | "">(kind ?? "");
  const [criteria, setCriteria] = useState<DirectoryCriteria>({ query: "", city: "", kind, offset: 0 });
  const { metros } = useMetros();
  const path = kind ? DIRECTORY_PATHS[kind] : "/discover";
  const label = kind ? `${ENTITY_LABELS[kind]} directory` : "Discover dance communities";
  const { data = [], isPending, error, refetch } = useEntityDirectory({
    kind: criteria.kind,
    query: criteria.query,
    city: criteria.city,
    limit: PAGE_SIZE,
    offset: criteria.offset,
  });
  useDocumentMeta({
    title: label,
    description: kind
      ? `Browse approved ${ENTITY_COLLECTIONS[kind]} across Boston, New York, and other dance communities.`
      : "Search approved dance events, series, organizers, venues, schools, instructors, cities, and styles.",
    canonical: canonicalUrl(path),
    robots: "index, follow",
  });

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCriteria({ query: draftQuery.trim(), city: draftCity, kind: (draftKind || undefined) as PublicEntityKind | undefined, offset: 0 });
  }

  const resultLabel = kind ? ENTITY_COLLECTIONS[kind] : "results";

  return (
    <section className="entity-directory" aria-labelledby="entity-directory-title">
      <header className="entity-directory__intro">
        <h1 id="entity-directory-title">{label}</h1>
        <p>Find the people and places shaping salsa, bachata, and Latin dance near you.</p>
      </header>
      <form className="entity-directory__search" role="search" onSubmit={search}>
        <label>
          <span>Search</span>
          <input
            type="search"
            aria-label="Search"
            value={draftQuery}
            onChange={(event) => setDraftQuery(event.target.value)}
            placeholder="Name or description"
          />
        </label>
        {!kind && (
          <label>
            <span>Type</span>
            <select aria-label="Type" value={draftKind} onChange={(event) => setDraftKind(event.target.value as PublicEntityKind | "")}>
              <option value="">All kinds</option>
              {PUBLIC_ENTITY_KINDS.map((entityKind) => <option key={entityKind} value={entityKind}>{ENTITY_LABELS[entityKind]}</option>)}
            </select>
          </label>
        )}
        <label>
          <span>City</span>
          <select aria-label="City" value={draftCity} onChange={(event) => setDraftCity(event.target.value)}>
            <option value="">All cities</option>
            {metros.map((metro) => <option key={metro.slug} value={metro.slug}>{metro.name}</option>)}
          </select>
        </label>
        <button type="submit" className="ui-button ui-button--primary">Search</button>
      </form>
      <section className="entity-directory__results" aria-label={label} aria-live="polite" aria-busy={isPending}>
        {isPending ? (
          <p className="entity-directory__state" role="status">Loading {resultLabel}…</p>
        ) : error ? (
          <div className="entity-directory__state" role="alert">
            <p>We couldn’t load these {resultLabel}.</p>
            <button type="button" className="ui-button ui-button--secondary" onClick={() => void refetch()}>Try again</button>
          </div>
        ) : data.length === 0 ? (
          <p className="entity-directory__state">No {resultLabel} found. Try another name or city.</p>
        ) : (
          <>
            <ul className="entity-directory__grid">
              {data.map((entity) => <li key={`${entity.kind}:${entity.id}`}><EntityCard entity={entity} /></li>)}
            </ul>
            <nav className="entity-directory__pagination" aria-label="Directory pages">
              <button type="button" className="ui-button ui-button--secondary" disabled={criteria.offset === 0} onClick={() => setCriteria((current) => ({ ...current, offset: Math.max(0, current.offset - PAGE_SIZE) }))}>Previous</button>
              <span>Showing {criteria.offset + 1}–{criteria.offset + data.length}</span>
              <button type="button" className="ui-button ui-button--secondary" disabled={data.length < PAGE_SIZE} onClick={() => setCriteria((current) => ({ ...current, offset: current.offset + PAGE_SIZE }))}>Next</button>
            </nav>
          </>
        )}
      </section>
      {kind && <p className="entity-directory__all"><Link to="/discover">Search every category</Link></p>}
    </section>
  );
}
export { EntityDirectoryPage };
