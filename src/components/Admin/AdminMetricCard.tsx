import type { ComponentType } from "react";
import { Link } from "react-router-dom";
import "./AdminMetricCard.css";

interface AdminMetricCardProps {
  label: string;
  value: number | null;
  subLabel: string;
  icon: ComponentType<{ size?: number }>;
  tone: "informational" | "attention";
  to?: string;
  actionLabel?: string;
  isLoading?: boolean;
  onRetry?: () => void;
}

export default function AdminMetricCard({
  label,
  value,
  subLabel,
  icon: Icon,
  tone,
  to,
  actionLabel,
  isLoading,
  onRetry,
}: AdminMetricCardProps) {
  if (isLoading) {
    return (
      <div className="admin-card admin-metric-card" aria-busy="true">
        <span className="admin-skeleton admin-metric-card__icon-skeleton" aria-hidden />
        <span className="admin-skeleton admin-metric-card__value-skeleton" aria-hidden />
        <span className="admin-skeleton admin-metric-card__label-skeleton" aria-hidden />
      </div>
    );
  }

  // An attention card with a count of 0 renders informational — that is
  // what keeps a quiet day from being visually flagged.
  const effectiveTone: "informational" | "attention" =
    tone === "attention" && value ? "attention" : "informational";
  const accessibleLabel = `${label}: ${value ?? "unavailable"}. ${subLabel}.`;

  const content = (
    <>
      <span
        className={`admin-metric-card__icon admin-metric-card__icon--${effectiveTone}`}
        aria-hidden
      >
        <Icon size={20} />
      </span>
      <span className={`admin-metric-card__value admin-metric-card__value--${effectiveTone}`}>
        {value ?? "—"}
      </span>
      <span className="admin-metric-card__label">{label}</span>
      <span className="admin-metric-card__sub-label">{subLabel}</span>
      {value === null && onRetry ? (
        <button
          type="button"
          className="admin-metric-card__retry"
          onClick={(event) => {
            event.preventDefault();
            onRetry();
          }}
        >
          Retry
        </button>
      ) : (
        actionLabel &&
        to && (
          <span className={`admin-metric-card__action admin-metric-card__action--${effectiveTone}`}>
            {actionLabel} →
          </span>
        )
      )}
    </>
  );

  if (to && value !== null) {
    return (
      <Link to={to} className="admin-card admin-metric-card" aria-label={accessibleLabel}>
        {content}
      </Link>
    );
  }

  return (
    <div className="admin-card admin-metric-card" aria-label={accessibleLabel}>
      {content}
    </div>
  );
}
