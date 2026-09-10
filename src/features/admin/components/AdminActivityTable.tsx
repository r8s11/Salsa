import { Clock, Shield, Ban, PauseCircle } from "lucide-react";
import type { ComponentType } from "react";
import type { ActivityAuditLog } from "../../features/admin/model/auditActivityQuery";
import {
  activityActionLabel,
  activityActorLabel,
  activityTargetLabel,
  categoryOf,
  isSensitiveAction,
  CATEGORY_LABEL,
  formatActivityDate,
} from "../../features/admin/model/auditActivityQuery";
import "./AdminActivityTable.css";

interface AdminActivityTableProps {
  entries: ActivityAuditLog[];
  /** When resolving target display names, the page can pass in a lookup map. */
  targetDisplayMap?: Record<string, string>;
  onViewDetail?: (entry: ActivityAuditLog) => void;
}

const CATEGORY_ICON: Record<string, ComponentType<{ size?: number }>> = {
  events: Clock,
  submissions: Clock,
  users: Shield,
  organizers: Shield,
  venues: Clock,
  taxonomy: Clock,
  settings: Shield,
  security: Ban,
};

const SENSITIVE_ICON = Ban;
const STATUS_ICON = PauseCircle;

export default function AdminActivityTable({
  entries,
  targetDisplayMap = {},
  onViewDetail,
}: AdminActivityTableProps) {
  if (entries.length === 0) {
    return (
      <div className="admin-activity-table__empty" role="status">
        <p>No activity entries match these filters.</p>
      </div>
    );
  }

  return (
    <>
      <div className="admin-activity-table__scroll">
        <table className="admin-activity-table">
          <thead>
            <tr>
              <th>Action</th>
              <th>Target</th>
              <th>Actor</th>
              <th>Category</th>
              <th>Date & Time</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry) => {
              const category = categoryOf(entry);
              const isSensitive = isSensitiveAction(entry.action);
              const Icon = isSensitive ? SENSITIVE_ICON : (CATEGORY_ICON[category] ?? STATUS_ICON);
              const targetName =
                targetDisplayMap[entry.entity_id ?? ""] ?? activityTargetLabel(entry);
              const rowClass = [
                "admin-activity-table__row",
                isSensitive ? "admin-activity-table__row--sensitive" : "",
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <tr key={entry.id} className={rowClass}>
                  <td>
                    <a
                      href={`/admin/activity/${entry.id}`}
                      className="admin-activity-table__action-link admin-activity-table__action-label"
                      onClick={(event) => {
                        event.preventDefault();
                        onViewDetail?.(entry);
                      }}
                    >
                      <span className="admin-activity-table__action-icon">
                        <Icon size={16} />
                      </span>
                      <span
                        className={isSensitive ? "admin-activity-table__action--sensitive" : ""}
                      >
                        {activityActionLabel(entry)}
                      </span>
                    </a>
                  </td>
                  <td>
                    <span className="admin-activity-table__target">{targetName}</span>
                    {entry.entity_id && (
                      <span className="admin-activity-table__entity-id">
                        #{(entry.entity_id || "").slice(0, 8)}
                      </span>
                    )}
                  </td>
                  <td>
                    <span className="admin-activity-table__actor">{activityActorLabel(entry)}</span>
                  </td>
                  <td>
                    <span className={`admin-chip admin-chip--${CATEGORY_LABEL[category]}`}>
                      {CATEGORY_LABEL[category]}
                    </span>
                  </td>
                  <td>
                    <span className="admin-activity-table__date">
                      {formatActivityDate(entry.created_at)}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile card stack — same pattern as AdminEventsTable cards */}
      <ul className="admin-activity-cards">
        {entries.map((entry) => {
          const category = categoryOf(entry);
          const isSensitive = isSensitiveAction(entry.action);
          const Icon = isSensitive ? SENSITIVE_ICON : (CATEGORY_ICON[category] ?? STATUS_ICON);
          const targetName = targetDisplayMap[entry.entity_id ?? ""] ?? activityTargetLabel(entry);

          return (
            <li
              key={entry.id}
              className={
                isSensitive
                  ? "admin-card admin-activity-cards__item admin-activity-cards__item--sensitive"
                  : "admin-card admin-activity-cards__item"
              }
            >
              <div className="admin-activity-cards__head">
                <a
                  href={`/admin/activity/${entry.id}`}
                  className="admin-activity-table__action-link"
                  onClick={(event) => {
                    event.preventDefault();
                    onViewDetail?.(entry);
                  }}
                >
                  <span className="admin-activity-table__action-icon">
                    <Icon size={16} />
                  </span>
                  <span className={isSensitive ? "admin-activity-table__action--sensitive" : ""}>
                    {activityActionLabel(entry)}
                  </span>
                </a>
                <span className={`admin-chip admin-chip--${CATEGORY_LABEL[category]}`}>
                  {CATEGORY_LABEL[category]}
                </span>
              </div>
              <div className="admin-activity-cards__row">
                <span className="admin-activity-cards__label">Target</span>
                <span className="admin-activity-table__target">{targetName}</span>
              </div>
              <div className="admin-activity-cards__row">
                <span className="admin-activity-cards__label">Actor</span>
                <span className="admin-activity-table__actor">{activityActorLabel(entry)}</span>
              </div>
              {entry.metadata &&
                typeof entry.metadata.reason === "string" &&
                entry.metadata.reason !== "" && (
                  <div className="admin-activity-cards__row">
                    <span className="admin-activity-cards__label">Reason</span>
                    <span>{entry.metadata.reason as string}</span>
                  </div>
                )}
              <div className="admin-activity-cards__row">
                <span className="admin-activity-cards__label">Date</span>
                <span>{formatActivityDate(entry.created_at)}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
