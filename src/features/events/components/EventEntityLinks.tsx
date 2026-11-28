import { Link } from "react-router-dom";
import { ENTITY_LABELS, entityHref } from "../../entities/model";
import { ENTITY_GLYPHS } from "../../entities/entityGlyphs";
import type { PublicEntityKind, PublicEntityRef, PublicEventEntities } from "../../entities/model";
import "./EventEntityLinks.css";

export default function EventEntityLinks({ entities, omit = [], onNavigate }: {
  entities?: PublicEventEntities | null;
  omit?: PublicEntityKind[];
  onNavigate?: () => void;
}) {
  if (!entities) return null;
  const refs = [entities.series, entities.organizer, entities.venue,
    ...(entities.schools ?? (entities.school ? [entities.school] : [])),
    ...(entities.instructors ?? []), ...(entities.djs ?? []), entities.city, ...(entities.styles ?? [])];
  const seen = new Set<string>();
  const linked = refs.filter((ref): ref is PublicEntityRef => {
    if (!ref || !ref.slug || omit.includes(ref.kind)) return false;
    const key = `${ref.kind}:${ref.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (!linked.length) return null;
  // Each link carries its kind as a glyph (named for screen readers), so a school,
  // venue and organizer sharing one name read as three different places.
  // A group, not a landmark: every card renders one, and repeated navs flood the landmark list.
  return <div className="event-entity-links" role="group" aria-label="Event people, places and styles">
    {linked.map((ref) => {
      const Glyph = ENTITY_GLYPHS[ref.kind];
      return <Link key={`${ref.kind}:${ref.id}`} to={entityHref(ref)} onClick={onNavigate}>
        <Glyph className="event-entity-links__glyph" size={14} aria-hidden="true" />
        <span className="event-entity-links__kind">{ENTITY_LABELS[ref.kind]}</span>{" "}
        <span className="event-entity-links__name">{ref.name}</span>
      </Link>;
    })}
  </div>;
}
