import { CalendarDays, ClipboardCheck, ListChecks } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/useAuth";
import { useMySubmissions } from "../../hooks/useMySubmissions";
import { deriveHostEventRows, findNextHostEvent } from "../../features/host/model/hostEvents";
import AdminMetricCard from "../Admin/AdminMetricCard";
import AdminPageHeader from "../Admin/AdminPageHeader";
import "./HostDashboard.css";

export default function HostDashboard() {
  const { user } = useAuth();
  const { submissions, approvedEvents, isLoading, error, refetch } = useMySubmissions(user?.id);
  const events = [...submissions, ...approvedEvents.filter((approved) => !submissions.some((submission) => submission.id === approved.id))];
  const rows = deriveHostEventRows(events, new Date());
  const nextEvent = findNextHostEvent(approvedEvents, new Date());
  const pendingCount = submissions.filter((event) => event.status === "pending").length;
  const upcomingCount = approvedEvents.filter((event) => findNextHostEvent([event], new Date()) !== null).length;

  if (isLoading) return <p role="status" className="admin-overview-page__status">Loading your events…</p>;
  if (error) return <div className="host-dashboard__state"><p>We couldn't load your events.</p><button className="admin-btn admin-btn--secondary" onClick={refetch}>Try again</button></div>;

  return <>
    <AdminPageHeader title="Host dashboard" description="Your event submissions and published events" actions={<Link to="/admin/events?new=1" className="admin-btn admin-btn--primary">Create event</Link>} />
    <main className="host-dashboard">
      <div className="admin-overview-page__metrics">
        <AdminMetricCard label="Upcoming Events" value={upcomingCount} subLabel="Your published events" icon={CalendarDays} tone="informational" />
        <AdminMetricCard label="Awaiting Review" value={pendingCount} subLabel="Your submissions" icon={ClipboardCheck} tone={pendingCount ? "attention" : "informational"} to="/admin/submissions" actionLabel="View submissions" />
        <AdminMetricCard label="Total Events" value={events.length} subLabel="Submitted or published" icon={ListChecks} tone="informational" />
      </div>
      {nextEvent ? <section className="host-dashboard__next" aria-labelledby="host-next-event"><h2 id="host-next-event">Next event</h2><h3>{nextEvent.title}</h3><p>{rows.find((row) => row.event.id === nextEvent.id)?.dateLabel}</p><Link className="admin-btn admin-btn--secondary" to={`/calendar?event=${nextEvent.id}&city=${nextEvent.city}`}>View event</Link></section> : <section className="host-dashboard__empty"><h2>No upcoming events yet</h2><p>Submit an event to see it here once it is approved.</p><Link className="admin-btn admin-btn--primary" to="/admin/events?new=1">Create event</Link></section>}
      {rows.length > 0 && <section className="host-dashboard__events" aria-labelledby="host-events"><h2 id="host-events">Your events</h2>{rows.filter(row => row.event.id !== nextEvent?.id).map((row) => <article key={row.event.id}><div><h3>{row.event.title}</h3><p>{row.dateLabel} · {row.statusLabel}</p></div><Link to={row.action.to}>{row.action.label}</Link></article>)}</section>}
    </main>
  </>;
}
