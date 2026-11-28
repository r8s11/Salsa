import { useQueries } from "@tanstack/react-query";
import { fetchEntityDirectory } from "../entitiesRepo";
import type { DirectorySearch } from "../hooks/useEntityDirectory";
import { ENTITY_COLLECTIONS, type PublicEntityKind } from "../model";
import { EntityCard, InstructorCard } from "./EntityDirectoryResults";

// "All kinds" results read as sections in this order: places and people
// first, then the nights themselves, then the broad taxonomy. Each kind is
// fetched on its own so one busy kind (weekly events) cannot crowd out the rest.
const KIND_ORDER: PublicEntityKind[] = ["school", "venue", "organizer", "instructor", "dj", "series", "event", "city", "style"];
const PREVIEW = 6;

type Props = {
  label: string;
  search: DirectorySearch;
  onSeeAll: (kind: PublicEntityKind) => void;
};

export function EntityDirectorySections({ label, search, onSeeAll }: Props) {
  const results = useQueries({
    queries: KIND_ORDER.map((kind) => ({
      queryKey: ["public-entity-directory", kind, search.query, search.city || null, search.borough || null, PREVIEW + 1, 0],
      // One extra row says whether "See all" leads anywhere.
      queryFn: () => fetchEntityDirectory({ ...search, kind, limit: PREVIEW + 1, offset: 0 }),
    })),
  });
  const isPending = results.some((result) => result.isPending);
  const failed = results.some((result) => result.error);
  const sections = KIND_ORDER
    .map((kind, index) => ({ kind, rows: results[index].data ?? [] }))
    .filter((section) => section.rows.length > 0);
  const retry = () => results.forEach((result) => { if (result.error) void result.refetch(); });

  return (
    <section className="entity-directory__results" aria-label={label} aria-live="polite" aria-busy={isPending}>
      {isPending ? (
        <>
          <p className="entity-directory__loading" role="status">Loading results…</p>
          <ul className="entity-directory__grid" aria-hidden="true">
            {Array.from({ length: 6 }, (_, index) => <li key={index} className="entity-directory__skeleton" />)}
          </ul>
        </>
      ) : failed && sections.length === 0 ? (
        <div className="entity-directory__state" role="alert">
          <p>We couldn’t load these results.</p>
          <button type="button" className="ui-button ui-button--secondary" onClick={retry}>Try again</button>
        </div>
      ) : sections.length === 0 ? (
        <p className="entity-directory__state">No results found. Try another name or city.</p>
      ) : (
        <div className="entity-directory__borough-groups entity-directory__kind-groups">
          {failed && (
            <div className="entity-directory__state" role="alert">
              <p>Some categories didn’t load.</p>
              <button type="button" className="ui-button ui-button--secondary" onClick={retry}>Try again</button>
            </div>
          )}
          {sections.map(({ kind, rows }) => {
            const teachers = kind === "instructor";
            const more = rows.length > PREVIEW;
            return (
              <section key={kind} aria-labelledby={`directory-section-${kind}`}>
                <div className="entity-directory__section-head">
                  <h2 id={`directory-section-${kind}`}>{ENTITY_COLLECTIONS[kind][0].toUpperCase() + ENTITY_COLLECTIONS[kind].slice(1)}</h2>
                  {more && (
                    <button type="button" className="ui-button ui-button--ghost" onClick={() => onSeeAll(kind)}>
                      See all {ENTITY_COLLECTIONS[kind]}
                    </button>
                  )}
                </div>
                <ul className={teachers ? "entity-directory__roster" : "entity-directory__grid"}>
                  {rows.slice(0, PREVIEW).map((entity) => (
                    <li key={`${entity.kind}:${entity.id}`}>
                      {teachers ? <InstructorCard entity={entity} heading="h3" /> : <EntityCard entity={entity} heading="h3" />}
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </section>
  );
}
