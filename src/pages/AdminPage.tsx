import { useAuth } from "../contexts/useAuth";
import { usePendingEvents } from "../hooks/usePendingEvents";
import PendingEventCard from "../components/Admin/PendingEventCard";
import "./AdminPage.css";

export default function AdminPage() {
  const { user } = useAuth();
  const { pending, isLoading, error, refetch, decide, decidingId, decideErrorId, decideError } =
    usePendingEvents();

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <p className="eyebrow">Moderation</p>
        <h1>Pending events</h1>
        {user?.email && <p className="admin-page-user">Signed in as {user.email}</p>}
      </header>

      {isLoading && <p className="admin-page-status">Loading pending events...</p>}

      {error && (
        <div className="admin-page-status admin-page-error">
          <p>Couldn't load pending events: {error}</p>
          <button type="button" onClick={() => refetch()}>
            Retry
          </button>
        </div>
      )}

      {!isLoading && !error && pending && pending.length === 0 && (
        <p className="admin-page-status">No events waiting for review.</p>
      )}

      {pending && pending.length > 0 && (
        <div className="admin-page-list">
          {pending.map((event) => (
            <PendingEventCard
              key={event.id}
              event={event}
              onApprove={(id) => decide({ id, status: "approved" })}
              onReject={(id) => decide({ id, status: "rejected" })}
              isDeciding={decidingId === event.id}
              error={decideErrorId === event.id ? decideError : null}
            />
          ))}
        </div>
      )}
    </div>
  );
}
