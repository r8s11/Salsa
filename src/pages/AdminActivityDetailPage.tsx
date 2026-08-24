import { useParams, Link, useNavigate } from "react-router-dom";
import { useAdminActivityDetail } from "../hooks/useAdminActivity";
import {
  activityActionLabel,
  activityActorLabel,
  activityTargetLabel,
  categoryOf,
  isSensitiveAction,
  CATEGORY_LABEL,
  formatActivityDate,
} from "../features/admin/model/auditActivityQuery";
import "./AdminActivityDetailPage.css";

export default function AdminActivityDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { entry, isLoading, error } = useAdminActivityDetail(id ?? null);

  if (isLoading) {
    return (
      <div className="admin-activity-detail-page" aria-busy="true">
        <p role="status" className="admin-activity-detail-page__loading">
          Loading activity entry…
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="admin-activity-detail-page__error" role="alert">
        <p>We couldn&apos;t load this activity entry.</p>
        <button
          type="button"
          className="admin-btn admin-btn--secondary"
          onClick={() => navigate("/admin/activity")}
        >
          Back to Activity
        </button>
      </div>
    );
  }

  if (!entry) {
    return (
      <div className="admin-activity-detail-page__empty">
        <h2>Activity entry not found</h2>
        <Link to="/admin/activity" className="admin-btn admin-btn--secondary">
          ← Back to Activity
        </Link>
      </div>
    );
  }

  const category = categoryOf(entry);
  const isSensitive = isSensitiveAction(entry.action);
  const metadata = entry.metadata ?? {};
  const targetName = activityTargetLabel(entry);
  const actorLabel = activityActorLabel(entry);
  const actionLabel = activityActionLabel(entry);

  // Helper to safely read string metadata
  const metaString = (key: string): string | undefined => {
    const value = metadata[key];
    return typeof value === "string" ? value : undefined;
  };

  // Resolve related-record link based on entity_type
  let relatedRecordLink: { label: string; href: string } | null = null;
  if (entry.entity_id) {
    switch (entry.entity_type) {
      case "event":
        relatedRecordLink = { label: "View Event", href: `/admin/events?edit=${entry.entity_id}` };
        break;
      case "event_submission":
        relatedRecordLink = {
          label: "View Submission",
          href: `/admin/submissions/${entry.entity_id}`,
        };
        break;
      case "profile":
        relatedRecordLink = { label: "View User", href: `/admin/users/${entry.entity_id}` };
        break;
      case "platform_settings":
        relatedRecordLink = { label: "View Settings", href: "/admin/settings" };
        break;
    }
  }

  // Before/after diff — metadata may contain `before` and `after` JSONB objects
  const beforeState = metadata.before as Record<string, unknown> | undefined;
  const afterState = metadata.after as Record<string, unknown> | undefined;
  const hasDiff = beforeState || afterState;

  // Status transition fields
  const hasStatusTransition =
    typeof metadata.from_status === "string" || typeof metadata.to_status === "string";

  // Sensitive-action-specific fields
  const hasRoleChange = entry.action === "user.role_changed";
  const hasModerationReason =
    entry.action === "user.suspended" ||
    entry.action === "user.banned" ||
    entry.action === "user.flagged";

  return (
    <div
      className={`admin-activity-detail-page ${isSensitive ? "admin-activity-detail-page--sensitive" : ""}`}
    >
      <Link to="/admin/activity" className="admin-activity-detail-page__back">
        ← Activity
      </Link>

      <header className="admin-activity-detail-page__header">
        <div className="admin-activity-detail-page__action">
          <span className="admin-activity-detail-page__action-icon">
            {isSensitive && <span className="admin-activity-detail-page__sensitive-dot" />}
          </span>
          <h1 className={isSensitive ? "admin-activity-detail-page__title--sensitive" : ""}>
            {actionLabel}
          </h1>
        </div>
        <p className="admin-activity-detail-page__meta">
          <span>by {actorLabel}</span>
          <span>·</span>
          <span>{formatActivityDate(entry.created_at)}</span>
        </p>
      </header>

      <div className="admin-activity-detail-page__body">
        {/* Target section */}
        <section className="admin-activity-detail-page__card admin-card">
          <h2>Target</h2>
          <div className="admin-activity-detail-page__field">
            <span className="admin-activity-detail-page__label">Record</span>
            <span className="admin-activity-detail-page__target">{targetName}</span>
          </div>
          <div className="admin-activity-detail-page__field">
            <span className="admin-activity-detail-page__label">Category</span>
            <span>
              <span className={`admin-chip admin-chip--${CATEGORY_LABEL[category]}`}>
                {CATEGORY_LABEL[category]}
              </span>
            </span>
          </div>
          {entry.entity_id && (
            <div className="admin-activity-detail-page__field">
              <span className="admin-activity-detail-page__label">Entity ID</span>
              <span className="admin-activity-detail-page__entity-id">{entry.entity_id}</span>
            </div>
          )}
        </section>

        {/* Reason / Notes (only when present) */}
        {(metaString("reason") ||
          metaString("internal_note") ||
          metaString("rejection_reason")) && (
          <section className="admin-activity-detail-page__card admin-card">
            <h2>Reason</h2>
            {metaString("reason") && (
              <div className="admin-activity-detail-page__field">
                <span className="admin-activity-detail-page__label">Reason</span>
                <span>{metaString("reason")}</span>
              </div>
            )}
            {metaString("rejection_reason") && (
              <div className="admin-activity-detail-page__field">
                <span className="admin-activity-detail-page__label">Rejection reason</span>
                <span>{metaString("rejection_reason")}</span>
              </div>
            )}
            {metaString("internal_note") && (
              <div className="admin-activity-detail-page__field">
                <span className="admin-activity-detail-page__label">Internal note</span>
                <span>{metaString("internal_note")}</span>
              </div>
            )}
          </section>
        )}

        {/* Role change detail */}
        {hasRoleChange && (
          <section className="admin-activity-detail-page__card admin-card admin-activity-detail-page__card--sensitive">
            <h2>Role Change</h2>
            <div className="admin-activity-detail-page__field">
              <span className="admin-activity-detail-page__label">Previous Role</span>
              <span>{metaString("from_role") || "—"}</span>
            </div>
            <div className="admin-activity-detail-page__field">
              <span className="admin-activity-detail-page__label">New Role</span>
              <span>{metaString("to_role") || "—"}</span>
            </div>
          </section>
        )}

        {/* Status transition detail */}
        {hasStatusTransition && !hasRoleChange && (
          <section className="admin-activity-detail-page__card admin-card">
            <h2>Status Change</h2>
            <div className="admin-activity-detail-page__field">
              <span className="admin-activity-detail-page__label">Before</span>
              <span>{metaString("from_status") || "—"}</span>
            </div>
            <div className="admin-activity-detail-page__field">
              <span className="admin-activity-detail-page__label">After</span>
              <span>{metaString("to_status") || "—"}</span>
            </div>
          </section>
        )}

        {/* Before / After diff */}
        {hasDiff && (
          <section className="admin-activity-detail-page__card admin-card">
            <h2>Before / After</h2>
            <table className="admin-activity-detail-page__diff">
              <thead>
                <tr>
                  <th>Field</th>
                  <th>Before</th>
                  <th>After</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(afterState ?? {})
                  .filter(([key]) => {
                    const beforeVal = beforeState?.[key];
                    const afterVal = afterState?.[key];
                    return JSON.stringify(beforeVal) !== JSON.stringify(afterVal);
                  })
                  .map(([key, afterVal]) => {
                    const beforeVal = beforeState?.[key];
                    const beforeStr =
                      beforeVal !== undefined ? String(JSON.stringify(beforeVal)) : "—";
                    const afterStr = String(JSON.stringify(afterVal));
                    return (
                      <tr key={key}>
                        <td>{key}</td>
                        <td>
                          <code>{beforeStr}</code>
                        </td>
                        <td>
                          <code>{afterStr}</code>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </section>
        )}

        {/* Metadata (key/value, not raw JSON dump) */}
        {Object.keys(metadata).length > 0 && !hasDiff && !hasRoleChange && !hasStatusTransition && (
          <section className="admin-activity-detail-page__card admin-card">
            <h2>Metadata</h2>
            <table className="admin-activity-detail-page__metadata">
              <tbody>
                {Object.entries(metadata).map(([key, value]) => (
                  <tr key={key}>
                    <th>{key}</th>
                    <td>{String(JSON.stringify(value))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {/* Related record link */}
        {relatedRecordLink && (
          <section className="admin-activity-detail-page__card admin-card">
            <h2>Related Record</h2>
            <Link to={relatedRecordLink.href} className="admin-btn admin-btn--secondary">
              {relatedRecordLink.label}
            </Link>
          </section>
        )}
      </div>

      {/* Moderation action links */}
      {hasModerationReason && entry.entity_type === "profile" && entry.entity_id && (
        <section className="admin-activity-detail-page__card admin-card">
          <h2>Moderation History</h2>
          <Link
            to={`/admin/users/${entry.entity_id}?tab=activity`}
            className="admin-btn admin-btn--secondary"
          >
            View Moderation History
          </Link>
        </section>
      )}
    </div>
  );
}
