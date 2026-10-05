import { Link } from "react-router-dom";
import { entityHref } from "../../entities/model";
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
    ...(entities.instructors ?? []), entities.city, ...(entities.styles ?? [])];
  const seen = new Set<string>();
  const linked = refs.filter((ref): ref is PublicEntityRef => {
    if (!ref || !ref.slug || omit.includes(ref.kind)) return false;
    const key = `${ref.kind}:${ref.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (!linked.length) return null;
  return <nav className="event-entity-links" aria-label="Event people, places and styles">
    {linked.map((ref) => <Link key={`${ref.kind}:${ref.id}`} to={entityHref(ref)} onClick={onNavigate}>
      {ref.name}
    </Link>)}
  </nav>;
}
