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
    ...(entities.instructors ?? []), ...(entities.djs ?? []), entities.city, ...(entities.styles ?? [])];
  const seen = new Set<string>();
  // An organizer named like its venue reads as the same link twice.
  const venueName = entities.venue?.name.trim().toLowerCase();
  const linked = refs.filter((ref): ref is PublicEntityRef => {
    if (!ref || !ref.slug || omit.includes(ref.kind)) return false;
    if (ref.kind === "organizer" && venueName && ref.name.trim().toLowerCase() === venueName) return false;
    const key = `${ref.kind}:${ref.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (!linked.length) return null;
  // A group, not a landmark: every card renders one, and repeated navs flood the landmark list.
  return <div className="event-entity-links" role="group" aria-label="Event people, places and styles">
    {linked.map((ref) => <Link key={`${ref.kind}:${ref.id}`} to={entityHref(ref)} onClick={onNavigate}>
      {ref.name}
    </Link>)}
  </div>;
}
