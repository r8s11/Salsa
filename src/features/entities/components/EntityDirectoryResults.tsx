import { Link } from "react-router-dom";
import type { EntityDirectory } from "../hooks/useEntityDirectory";
import { ENTITY_LABELS, entityHref, type PublicEntityRef } from "../model";
import { InstructorPortrait } from "./InstructorPortrait";

function InstructorCard({ entity }: { entity: PublicEntityRef }) {
  return (
    <Link className="entity-directory__teacher" to={entityHref(entity)}>
      <InstructorPortrait name={entity.name} imageUrl={entity.image_url} />
      <h2 className="entity-directory__teacher-name">{entity.name}</h2>
      {entity.city && <span className="entity-directory__teacher-city">{entity.city.replace(/-/g, " ")}</span>}
    </Link>
  );
}

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

type Props = {
  label: string;
  resultLabel: string;
  directory: EntityDirectory;
};

export function EntityDirectoryResults({ label, resultLabel, directory }: Props) {
  const { entities: data, isPending, error, offset, pageSize, retry, setOffset } = directory;
  const roster = data.length > 0 && data.every((entity) => entity.kind === "instructor");
  return (
    <section className="entity-directory__results" aria-label={label} aria-live="polite" aria-busy={isPending}>
      {isPending ? (
        <>
          <p className="entity-directory__loading" role="status">Loading {resultLabel}…</p>
          <ul className="entity-directory__grid" aria-hidden="true">
            {Array.from({ length: 6 }, (_, index) => <li key={index} className="entity-directory__skeleton" />)}
          </ul>
        </>
      ) : error ? (
        <div className="entity-directory__state" role="alert">
          <p>We couldn’t load these {resultLabel}.</p>
          <button type="button" className="ui-button ui-button--secondary" onClick={retry}>Try again</button>
        </div>
      ) : data.length === 0 ? (
        <p className="entity-directory__state">No {resultLabel} found. Try another name or city.</p>
      ) : (
        <>
          <ul className={roster ? "entity-directory__roster" : "entity-directory__grid"}>
            {data.map((entity) => (
              <li key={`${entity.kind}:${entity.id}`}>{roster ? <InstructorCard entity={entity} /> : <EntityCard entity={entity} />}</li>
            ))}
          </ul>
          <nav className="entity-directory__pagination" aria-label="Directory pages">
            <button type="button" className="ui-button ui-button--secondary" disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - pageSize))}>Previous</button>
            <span>Showing {offset + 1}–{offset + data.length}</span>
            <button type="button" className="ui-button ui-button--secondary" disabled={data.length < pageSize} onClick={() => setOffset(offset + pageSize)}>Next</button>
          </nav>
        </>
      )}
    </section>
  );
}
