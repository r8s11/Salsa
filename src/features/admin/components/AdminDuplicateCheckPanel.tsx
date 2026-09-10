import type { DuplicateCandidate } from "../../../features/admin/model/submissions";
import type { DatabaseEvent } from "../../../features/events/model/types";
import "./AdminDuplicateCheckPanel.css";

interface AdminDuplicateCheckPanelProps {
  candidates: DuplicateCandidate[];
  onViewEvent: (event: DatabaseEvent) => void;
  onNotADuplicate: (event: DatabaseEvent) => void;
  onRejectAsDuplicate: (event: DatabaseEvent) => void;
}

export default function AdminDuplicateCheckPanel({
  candidates,
  onViewEvent,
  onNotADuplicate,
  onRejectAsDuplicate,
}: AdminDuplicateCheckPanelProps) {
  if (candidates.length === 0) return null;

  return (
    <div className="admin-duplicate-check-panel admin-card">
      <h3>Duplicate Candidates ({candidates.length})</h3>
      <ul className="admin-duplicate-check-panel__list">
        {candidates.map((candidate) => (
          <li key={candidate.event.id} className="admin-duplicate-check-panel__item">
            <div className="admin-duplicate-check-panel__info">
              <h4>{candidate.event.title}</h4>
              <p className="admin-duplicate-check-panel__confidence">
                Confidence: {candidate.confidence}
              </p>
              <ul className="admin-duplicate-check-panel__signals">
                {candidate.signals.map((signal) => (
                  <li key={signal} className="admin-badge">
                    {signal}
                  </li>
                ))}
              </ul>
            </div>
            <div className="admin-duplicate-check-panel__actions">
              <button
                className="admin-btn admin-btn--secondary"
                onClick={() => onViewEvent(candidate.event)}
              >
                View Existing
              </button>
              <button
                className="admin-btn admin-btn--secondary"
                onClick={() => onNotADuplicate(candidate.event)}
              >
                Not a Duplicate
              </button>
              <button
                className="admin-btn admin-btn--danger"
                onClick={() => onRejectAsDuplicate(candidate.event)}
              >
                Reject as Duplicate
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
