import { Link, useParams } from "react-router-dom";
import WorkspaceFrame from "../../workspaces/components/WorkspaceFrame";
import { useAuth } from "../../../contexts/useAuth";
import { useArtistEvents } from "../hooks";
import "../artist-rsvp.css";

export default function ArtistEventsPage() {
  const { id = "" } = useParams();
  const { user } = useAuth();
  const query = useArtistEvents(id);
  const base = `/host/instructors/${id}/events`;
  return <WorkspaceFrame kind="instructor" id={id} section="Events">{() => <section className="artist-rsvp-operator">
    <header className="artist-rsvp-heading"><div><h2>Artist events</h2><p>Dated events, private drafts and website-managed signups.</p></div>{user && !query.error && <Link className="admin-btn admin-btn--primary" to={`${base}/new`}>Create event</Link>}</header>
    {!user ? <p role="alert">Sign in again to open artist events.</p> : query.isPending ? <p role="status">Loading artist events…</p> : query.error ? <div role="alert"><p>{query.error.message}</p><button className="admin-btn admin-btn--secondary" onClick={() => void query.refetch()}>Try again</button></div> : query.data?.length ? <ul className="artist-event-list">{query.data.map((event) => <li key={event.id}>
      <div><Link to={`${base}/${event.id}`}>{event.title}</Link><p>{event.status === "approved" ? "Published" : event.status} · {event.rsvp_enabled ? "Website RSVPs" : "External RSVP"}</p></div>
      <div className="artist-rsvp-actions"><Link to={`${base}/${event.id}`}>Edit event</Link>{event.rsvp_enabled && <Link to={`${base}/${event.id}/rsvps`}>Manage RSVPs</Link>}{event.status === "approved" && <Link to={`/events/${event.slug || event.id}`}>View public event</Link>}</div>
    </li>)}</ul> : <p>No artist events yet. Create a private draft to get started.</p>}
  </section>}</WorkspaceFrame>;
}
