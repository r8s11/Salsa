import { CircleCheck } from "lucide-react";
import { Link } from "react-router-dom";
import "./AdminNeedsAttention.css";

export interface AttentionItem {
  id: string;
  severity: "action" | "suggested";
  message: string;
  actionLabel: string;
  to: string;
}

interface AdminNeedsAttentionProps {
  items: AttentionItem[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
}

export default function AdminNeedsAttention({
  items,
  isLoading,
  error,
  onRetry,
}: AdminNeedsAttentionProps) {
  return (
    <section className="admin-card admin-needs-attention" aria-labelledby="needs-attention-heading">
      <h2 id="needs-attention-heading">Needs attention</h2>

      {isLoading && (
        <ul className="admin-needs-attention__list" aria-busy="true">
          {[1, 2].map((key) => (
            <li key={key} className="admin-needs-attention__row" aria-hidden>
              <span className="admin-skeleton admin-needs-attention__row-skeleton" />
            </li>
          ))}
        </ul>
      )}

      {!isLoading && error && (
        <div className="admin-banner admin-banner--error" role="alert">
          <p>We couldn't load your attention queue.</p>
          {onRetry && (
            <button type="button" className="admin-btn admin-btn--secondary" onClick={onRetry}>
              Try Again
            </button>
          )}
        </div>
      )}

      {!isLoading && !error && items.length === 0 && (
        <div className="admin-needs-attention__row admin-needs-attention__row--empty">
          <CircleCheck size={18} className="admin-needs-attention__empty-icon" aria-hidden />
          <span>You're all caught up — nothing needs your attention right now.</span>
        </div>
      )}

      {!isLoading && !error && items.length > 0 && (
        <ul className="admin-needs-attention__list">
          {items.map((item) => (
            <li key={item.id} className="admin-needs-attention__row">
              <span
                className={`admin-needs-attention__pill admin-needs-attention__pill--${item.severity}`}
              >
                {item.severity === "action" ? "Action needed" : "Suggested"}
              </span>
              <span className="admin-needs-attention__message">{item.message}</span>
              <Link to={item.to} className="admin-needs-attention__action">
                {item.actionLabel} →
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
