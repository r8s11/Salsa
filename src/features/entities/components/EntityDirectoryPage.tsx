import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useDocumentMeta } from "../../../shared/seo/useDocumentMeta";
import { canonicalUrl } from "../../../utils/seo";
import { ENTITY_COLLECTIONS, ENTITY_DIRECTORY_PATHS, ENTITY_LABELS, type PublicEntityKind } from "../model";
import { useEntityDirectory } from "../hooks/useEntityDirectory";
import { DiscoverHub } from "./DiscoverHub";
import { EntityDirectoryResults } from "./EntityDirectoryResults";
import { EntityDirectorySearch } from "./EntityDirectorySearch";
import "./EntityDirectoryPage.css";

export default function EntityDirectoryPage({ kind }: { kind?: PublicEntityKind }) {
  const path = kind ? ENTITY_DIRECTORY_PATHS[kind] : "/discover";
  const label = kind ? `${ENTITY_LABELS[kind]} directory` : "Discover dance communities";
  const resultLabel = kind ? ENTITY_COLLECTIONS[kind] : "results";
  const directory = useEntityDirectory(kind);
  const [searchKey, setSearchKey] = useState(0);
  const sectionRef = useRef<HTMLElement>(null);
  useDocumentMeta({
    title: label,
    description: kind
      ? `Browse approved ${ENTITY_COLLECTIONS[kind]} across Boston, New York, and other dance communities.`
      : "Search approved dance events, series, organizers, venues, schools, instructors, cities, and styles.",
    canonical: canonicalUrl(path),
    robots: "index, follow",
  });

  function backToHub() {
    directory.clearSearch();
    setSearchKey((key) => key + 1);
    requestAnimationFrame(() => sectionRef.current?.querySelector<HTMLInputElement>("input[type=search]")?.focus());
  }

  return (
    <section ref={sectionRef} className={kind ? "entity-directory" : "entity-directory entity-directory--main"} aria-labelledby="entity-directory-title">
      <header className="entity-directory__intro">
        {kind ? (
          <>
            <h1 id="entity-directory-title">{label}</h1>
            <p>
              {kind === "instructor"
                ? "The teachers behind the classes, workshops, and socials."
                : "Find the people and places shaping salsa, bachata, and Latin dance near you."}
            </p>
          </>
        ) : (
          <>
            <h1 id="entity-directory-title">Who makes the night<span className="entity-directory__dot" aria-hidden="true">.</span></h1>
            <p>
              Schools to learn at, rooms to dance in, and the artists who teach and perform in your city.
              Looking for tonight? <Link to="/calendar">Open the calendar</Link>.
            </p>
          </>
        )}
      </header>
      <EntityDirectorySearch key={searchKey} kind={kind} onSearch={directory.submitSearch} />
      {directory.active ? (
        <>
          {!kind && (
            <p className="entity-directory__back">
              <button type="button" className="ui-button ui-button--ghost" onClick={backToHub}>Back to every directory</button>
            </p>
          )}
          <EntityDirectoryResults label={label} resultLabel={resultLabel} directory={directory} />
        </>
      ) : (
        <DiscoverHub />
      )}
      {kind && <p className="entity-directory__all"><Link to="/discover">Search every category</Link></p>}
    </section>
  );
}
export { EntityDirectoryPage };
