import { useQueries, type UseQueryResult } from "@tanstack/react-query";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useCity } from "../../../contexts/useCity";
import { useMetros } from "../../metros/hooks/useMetros";
import { metroLabelFromSlug, resolveMetroSlug, type Metro } from "../../metros/model/metro";
import { fetchEntityDirectory } from "../entitiesRepo";
import { ENTITY_COLLECTIONS, ENTITY_DIRECTORY_PATHS, entityHref, type PublicEntityKind, type PublicEntityRef } from "../model";
import "./DiscoverHub.css";

// One directory page per kind: the RPC's ceiling, enough to pick a city's share client-side.
const PAGE = 50;

type SceneKind = "school" | "venue" | "instructor" | "organizer" | "series";
const SCENE_KINDS: SceneKind[] = ["school", "venue", "instructor", "organizer", "series"];
const EVERYWHERE_KINDS: PublicEntityKind[] = [...SCENE_KINDS, "style"];

type Shelf = { entities: PublicEntityRef[]; pending: boolean; failed: boolean; retry: () => void };
type DirectoryResult = UseQueryResult<PublicEntityRef[]>;

function directoryQuery(kind: PublicEntityKind, city: string | null) {
  return {
    queryKey: ["public-entity-directory", kind, "", city, PAGE, 0],
    queryFn: () => fetchEntityDirectory({ kind, city: city ?? undefined, limit: PAGE }),
  };
}

// Photographed entries lead so the first row reads as faces and rooms, then alphabetical.
function photoFirst(a: PublicEntityRef, b: PublicEntityRef) {
  return Number(Boolean(b.image_url)) - Number(Boolean(a.image_url)) || a.name.localeCompare(b.name);
}

/**
 * A city's share of one kind. The server's city filter matches entities that
 * host or teach nights in the metro; the free-text `city` column ("Cambridge",
 * "Brooklyn") is folded into the metro client-side, so a studio with nothing
 * on the calendar yet still shows up in its own scene.
 */
function toShelf(everywhere: DirectoryResult, nearby: DirectoryResult | undefined, metro: string | null, metros: Metro[]): Shelf {
  const retry = () => {
    void everywhere.refetch();
    void nearby?.refetch();
  };
  if (!metro || !nearby) {
    return { entities: [...(everywhere.data ?? [])].sort(photoFirst), pending: everywhere.isPending, failed: Boolean(everywhere.error), retry };
  }
  const local = new Map<string, PublicEntityRef>();
  for (const entity of nearby.data ?? []) local.set(entity.id, entity);
  for (const entity of everywhere.data ?? []) {
    if (resolveMetroSlug(entity.city, metros) === metro) local.set(entity.id, entity);
  }
  return {
    entities: [...local.values()].sort(photoFirst),
    pending: everywhere.isPending || nearby.isPending,
    failed: Boolean(everywhere.error || nearby.error),
    retry,
  };
}

function cityName(value: string | null | undefined) {
  return value ? value.replace(/-/g, " ") : null;
}

function stagger(index: number) {
  return { "--i": index } as CSSProperties;
}

function usePhoto(url: string | null) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  return { src: url && url !== failedUrl ? url : null, onError: () => setFailedUrl(url) };
}

function SchoolCard({ entity }: { entity: PublicEntityRef }) {
  const photo = usePhoto(entity.image_url);
  const where = [entity.address, cityName(entity.city)].filter(Boolean).join(" · ");
  return (
    <Link className={photo.src ? "discover-school" : "discover-school discover-school--text"} to={entityHref(entity)}>
      {photo.src && (
        <span className="discover-school__media">
          <img src={photo.src} alt="" loading="lazy" decoding="async" onError={photo.onError} />
        </span>
      )}
      <span className="discover-school__name">{entity.name}</span>
      {where && <span className="discover-school__where">{where}</span>}
      {entity.description && <span className="discover-school__desc">{entity.description}</span>}
    </Link>
  );
}

function VenueRow({ entity }: { entity: PublicEntityRef }) {
  const where = [entity.address, cityName(entity.city)].filter(Boolean).join(" · ");
  return (
    <Link className="discover-venue" to={entityHref(entity)}>
      <span className="discover-venue__name">{entity.name}</span>
      {where && <span className="discover-venue__where">{where}</span>}
      <ArrowUpRight className="discover-venue__arrow" aria-hidden="true" size={20} />
    </Link>
  );
}

function ArtistCard({ entity }: { entity: PublicEntityRef }) {
  const photo = usePhoto(entity.image_url);
  const where = cityName(entity.city);
  return (
    <Link className={photo.src ? "discover-artist" : "discover-artist discover-artist--text"} to={entityHref(entity)}>
      {photo.src && (
        <span className="discover-artist__photo">
          <img src={photo.src} alt="" loading="lazy" decoding="async" onError={photo.onError} />
        </span>
      )}
      <span className="discover-artist__name">{entity.name}</span>
      {entity.description && <span className="discover-artist__line">{entity.description}</span>}
      {where && <span className="discover-artist__city">{where}</span>}
    </Link>
  );
}

function CompactRow({ entity }: { entity: PublicEntityRef }) {
  const where = cityName(entity.city);
  return (
    <Link className="discover-compact__item" to={entityHref(entity)}>
      <span className="discover-compact__name">{entity.name}</span>
      {where && <span className="discover-compact__city">{where}</span>}
    </Link>
  );
}

type Layout = "schools" | "venues" | "artists" | "compact";

const SKELETON_COUNT: Record<Layout, number> = { schools: 3, venues: 4, artists: 4, compact: 3 };

type ChapterProps = {
  kind: SceneKind;
  eyebrow: string;
  title: string;
  note: string;
  layout: Layout;
  limit: number;
  shelf: Shelf;
  metroName: string | null;
  choosing: boolean;
  onShowEverywhere: () => void;
  children: (entities: PublicEntityRef[]) => ReactNode;
};

function Chapter({ kind, eyebrow, title, note, layout, limit, shelf, metroName, choosing, onShowEverywhere, children }: ChapterProps) {
  const collection = ENTITY_COLLECTIONS[kind];
  const pending = choosing || shelf.pending;
  const empty = !pending && !shelf.failed && shelf.entities.length === 0;
  // With no city chosen an empty kind has nothing to say; inside a city, its absence is the news.
  if (empty && !metroName) return null;
  const headingId = `discover-${kind}`;
  return (
    <section className={`discover-chapter discover-chapter--${layout}`} aria-labelledby={headingId} aria-busy={pending}>
      <header className="discover-chapter__head">
        <p className="discover-chapter__eyebrow">{eyebrow}</p>
        <h3 id={headingId} className="discover-chapter__title">{title}</h3>
        <p className="discover-chapter__note">{note}</p>
        <Link className="discover-chapter__all" to={ENTITY_DIRECTORY_PATHS[kind]}>
          All {collection}
          <ArrowRight aria-hidden="true" size={16} />
        </Link>
      </header>
      {pending ? (
        <>
          <p className="discover-visually-hidden" role="status">Loading {collection}…</p>
          <ul className={`discover-skeletons discover-skeletons--${layout}`} aria-hidden="true">
            {Array.from({ length: SKELETON_COUNT[layout] }, (_, index) => <li key={index} className="discover-skeleton" />)}
          </ul>
        </>
      ) : shelf.failed ? (
        <div className="discover-chapter__state" role="alert">
          <p>We couldn’t load {collection}.</p>
          <button type="button" className="ui-button ui-button--secondary" onClick={shelf.retry}>Try again</button>
        </div>
      ) : empty ? (
        <div className="discover-chapter__state discover-chapter__state--empty">
          <p>No {collection} listed in {metroName} yet.</p>
          <button type="button" className="ui-button ui-button--ghost" onClick={onShowEverywhere}>See {collection} in every city</button>
        </div>
      ) : (
        children(shelf.entities.slice(0, limit))
      )}
    </section>
  );
}

export function DiscoverHub() {
  const { city, resolving, setCity } = useCity();
  const { metros } = useMetros();
  const [everywhereChosen, setEverywhereChosen] = useState(false);
  const metro = everywhereChosen ? null : city;
  const choosing = !everywhereChosen && resolving;

  const everywhere = useQueries({ queries: EVERYWHERE_KINDS.map((kind) => directoryQuery(kind, null)) });
  const nearby = useQueries({ queries: metro ? SCENE_KINDS.map((kind) => directoryQuery(kind, metro)) : [] });

  const settled = everywhere.every((query) => !query.isPending);
  if (settled && everywhere.every((query) => !query.error && (query.data?.length ?? 0) === 0)) {
    return (
      <p className="discover-hub__empty">
        Nothing is listed in the directory yet. The <Link to="/calendar">calendar</Link> has every approved night.
      </p>
    );
  }

  const shelves = Object.fromEntries(
    SCENE_KINDS.map((kind, index) => [kind, toShelf(everywhere[index], nearby[index], metro, metros)]),
  ) as Record<SceneKind, Shelf>;
  const styles = everywhere[EVERYWHERE_KINDS.indexOf("style")];
  const metroName = metro ? (metros.find((entry) => entry.slug === metro)?.name ?? metroLabelFromSlug(metro)) : null;
  const showEverywhere = () => setEverywhereChosen(true);
  const shared = { metroName, choosing, onShowEverywhere: showEverywhere };

  function chooseMetro(slug: string) {
    setEverywhereChosen(false);
    setCity(slug);
  }

  return (
    <div className="discover-hub">
      <section className="discover-scene" aria-labelledby="discover-scene-title">
        <header className="discover-scene__head">
          <p className="discover-scene__eyebrow">The scene in</p>
          <h2 id="discover-scene-title" className="discover-scene__title" aria-live="polite">
            {choosing ? "Finding your city…" : (metroName ?? "Every city")}
          </h2>
          {metro && metroName && (
            <Link className="discover-scene__nights" to={entityHref({ kind: "city", slug: metro })}>
              Upcoming nights in {metroName}
              <ArrowUpRight aria-hidden="true" size={16} />
            </Link>
          )}
        </header>
        {metros.length > 0 && (
          <div className="discover-scene__picker" role="group" aria-label="Show the scene for a city">
            {metros.map((entry) => (
              <button key={entry.slug} type="button" className="discover-chip" aria-pressed={entry.slug === metro} onClick={() => chooseMetro(entry.slug)}>
                {entry.name}
              </button>
            ))}
            <button type="button" className="discover-chip" aria-pressed={!metro && !choosing} onClick={showEverywhere}>
              Every city
            </button>
          </div>
        )}

        <div className="discover-scene__chapters" key={choosing ? "choosing" : (metro ?? "everywhere")}>
          <Chapter kind="school" eyebrow="Learn" title="Schools" note="Studios with classes, levels, and bootcamps." layout="schools" limit={6} shelf={shelves.school} {...shared}>
            {(entities) => (
              <ul className="discover-schools">
                {entities.map((entity, index) => <li key={entity.id} style={stagger(index)}><SchoolCard entity={entity} /></li>)}
              </ul>
            )}
          </Chapter>

          <Chapter kind="venue" eyebrow="Dance" title="Venues" note="The rooms where the socials happen." layout="venues" limit={8} shelf={shelves.venue} {...shared}>
            {(entities) => (
              <ol className="discover-venues">
                {entities.map((entity, index) => <li key={entity.id} style={stagger(index)}><VenueRow entity={entity} /></li>)}
              </ol>
            )}
          </Chapter>

          <Chapter kind="instructor" eyebrow="Meet" title="Artists" note="The teachers and performers behind the classes." layout="artists" limit={10} shelf={shelves.instructor} {...shared}>
            {(entities) => (
              <ul className="discover-artists">
                {entities.map((entity, index) => <li key={entity.id} style={stagger(index)}><ArtistCard entity={entity} /></li>)}
              </ul>
            )}
          </Chapter>

          <div className="discover-scene__hosts">
            <Chapter kind="organizer" eyebrow="Host" title="Organizers" note="The people who put the nights on." layout="compact" limit={6} shelf={shelves.organizer} {...shared}>
              {(entities) => (
                <ul className="discover-compact">
                  {entities.map((entity) => <li key={entity.id}><CompactRow entity={entity} /></li>)}
                </ul>
              )}
            </Chapter>
            <Chapter kind="series" eyebrow="Return" title="Series" note="Nights that come back." layout="compact" limit={6} shelf={shelves.series} {...shared}>
              {(entities) => (
                <ul className="discover-compact">
                  {entities.map((entity) => <li key={entity.id}><CompactRow entity={entity} /></li>)}
                </ul>
              )}
            </Chapter>
          </div>
        </div>
      </section>

      {(styles.isPending || styles.error || (styles.data?.length ?? 0) > 0) && (
        <section className="discover-styles" aria-labelledby="discover-styles-title" aria-busy={styles.isPending}>
          <header className="discover-styles__head">
            <h2 id="discover-styles-title" className="discover-styles__title">Browse by style</h2>
            <Link className="discover-chapter__all" to={ENTITY_DIRECTORY_PATHS.style}>
              All dance styles
              <ArrowRight aria-hidden="true" size={16} />
            </Link>
          </header>
          {styles.isPending ? (
            <ul className="discover-skeletons discover-skeletons--pills" aria-hidden="true">
              {Array.from({ length: 6 }, (_, index) => <li key={index} className="discover-skeleton" />)}
            </ul>
          ) : styles.error ? (
            <div className="discover-chapter__state" role="alert">
              <p>We couldn’t load dance styles.</p>
              <button type="button" className="ui-button ui-button--secondary" onClick={() => void styles.refetch()}>Try again</button>
            </div>
          ) : (
            <ul className="discover-pills">
              {styles.data?.map((entity) => <li key={entity.id}><Link className="discover-pill" to={entityHref(entity)}>{entity.name}</Link></li>)}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
