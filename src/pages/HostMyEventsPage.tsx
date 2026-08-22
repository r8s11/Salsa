import { useState, useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import { useMySubmissions } from "../hooks/useMySubmissions";
import { deriveHostEventRows } from "../features/host/model/hostEvents";
import { Link } from "react-router-dom";
import "./HostMyEventsPage.css";

export default function HostMyEventsPage() {
  const { user } = useAuth();
  const { submissions } = useMySubmissions(user?.id);
  const [view, setView] = useState<"cards" | "table">("cards");

  const events = useMemo(() => {
    if (!submissions) return [];
    return deriveHostEventRows(submissions, new Date());
  }, [submissions]);

  return (
    <div className="host-my-events">
      <div className="host-my-events__header">
        <h1>Host · My Events</h1>
        <div role="group" className="host-my-events__view-toggle">
          <button 
            aria-pressed={view === "cards"} 
            onClick={() => setView("cards")}
          >
            Cards
          </button>
          <button 
            aria-pressed={view === "table"} 
            onClick={() => setView("table")}
          >
            Table
          </button>
        </div>
      </div>

      {view === "cards" ? (
        <div className="host-my-events__cards">
          {events.map(row => (
            <div key={row.event.id} className="host-my-events__card">
              <h3>{row.event.title}</h3>
              <p><strong>Status:</strong> {row.statusLabel}</p>
              <p><strong>Venue:</strong> {row.event.venue_id || "N/A"}</p>
              <div className="host-my-events__actions">
                 <Link to={row.action.to}>{row.action.label}</Link>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <table className="host-my-events__table">
          <thead>
            <tr>
              <th>Title</th>
              <th>Date</th>
              <th>Venue</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {events.map(row => (
              <tr key={row.event.id}>
                <td data-label="Title">{row.event.title}</td>
                <td data-label="Date">{row.dateLabel}</td>
                <td data-label="Venue">{row.event.venue_id || "N/A"}</td>
                <td data-label="Status">{row.statusLabel}</td>
                <td data-label="Action">
                  <Link to={row.action.to}>{row.action.label}</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
