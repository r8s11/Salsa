import { useRef } from "react";
import { X } from "lucide-react";
import { useAccessibleDialog } from "../../shared/a11y/useAccessibleDialog";
import {
  CATEGORY_LABEL,
  type ActivityCategory,
  type ActivityFilters,
} from "../../features/admin/model/auditActivityQuery";
import "./AdminActivityFilterDrawer.css";
import { toggleArrayItem } from "../../shared/utils/toggleArrayItem";

interface AdminActivityFilterDrawerProps {
  open: boolean;
  filters: ActivityFilters;
  onFiltersChange: (filters: ActivityFilters) => void;
  onApply: () => void;
  onClose: () => void;
}

const EMPTY_FILTERS: Pick<ActivityFilters, "actor" | "action" | "targetType"> = {
  actor: null,
  action: [],
  targetType: [],
};

const CATEGORY_OPTIONS: ActivityCategory[] = [
  "events",
  "submissions",
  "users",
  "organizers",
  "venues",
  "taxonomy",
  "settings",
  "security",
];

const TARGET_TYPE_OPTIONS = [
  { value: "event", label: "Event" },
  { value: "event_submission", label: "Submission" },
  { value: "profile", label: "User" },
  { value: "venue", label: "Venue" },
  { value: "taxonomy_term", label: "Taxonomy term" },
  { value: "organizer", label: "Organizer" },
  { value: "platform_settings", label: "Platform settings" },
];

const ACTION_OPTIONS = [
  { value: "event.created", label: "Event created" },
  { value: "event.approved", label: "Event published" },
  { value: "event.updated", label: "Event updated" },
  { value: "event.deleted", label: "Event deleted" },
  { value: "event.archived", label: "Event archived" },
  { value: "event.restored", label: "Event restored" },
  { value: "submission.created", label: "Submission received" },
  { value: "submission.approved", label: "Submission approved" },
  { value: "submission.rejected", label: "Submission rejected" },
  { value: "submission.edited", label: "Submission edited" },
  { value: "submission.withdrawn", label: "Submission withdrawn" },
  { value: "user.role_changed", label: "Role changed" },
  { value: "user.flagged", label: "Account flagged" },
  { value: "user.suspended", label: "Account suspended" },
  { value: "user.banned", label: "Account banned" },
  { value: "user.restored", label: "Access restored" },
  { value: "venue.created", label: "Venue created" },
  { value: "venue.merged", label: "Venue merged" },
  { value: "platform_settings.updated", label: "Settings updated" },
  { value: "platform_settings.access_policy_changed", label: "Access policy changed" },
];

export default function AdminActivityFilterDrawer({
  open,
  filters,
  onFiltersChange,
  onApply,
  onClose,
}: AdminActivityFilterDrawerProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const { onKeyDown, onBackdropClick, onDialogClick } = useAccessibleDialog({
    dialogRef,
    onDismiss: onClose,
  });

  const toggleCategory = (value: ActivityCategory) => {
    onFiltersChange({ ...filters, category: toggleArrayItem(filters.category, value) });
  };

  const toggleAction = (value: string) => {
    onFiltersChange({ ...filters, action: toggleArrayItem(filters.action, value) });
  };

  const toggleTargetType = (value: string) => {
    onFiltersChange({ ...filters, targetType: toggleArrayItem(filters.targetType, value) });
  };

  if (!open) return null;

  return (
    <div className="admin-activity-filter-drawer__overlay" onClick={onBackdropClick}>
      <div
        ref={dialogRef}
        className="admin-activity-filter-drawer admin-card"
        role="dialog"
        aria-modal="true"
        aria-label="More filters"
        tabIndex={-1}
        onClick={onDialogClick}
        onKeyDown={onKeyDown}
      >
        <div className="admin-activity-filter-drawer__header">
          <h2>More Filters</h2>
          <button
            type="button"
            className="admin-icon-btn"
            aria-label="Close filters"
            onClick={onClose}
          >
            <X size={18} />
          </button>
        </div>

        <div className="admin-activity-filter-drawer__body">
          <fieldset className="admin-activity-filter-drawer__category-group">
            <legend>Category</legend>
            {CATEGORY_OPTIONS.map((option) => (
              <label key={option} className="admin-activity-filter-drawer__category-option">
                <input
                  type="checkbox"
                  checked={filters.category.includes(option)}
                  onChange={() => toggleCategory(option)}
                />
                {CATEGORY_LABEL[option]}
              </label>
            ))}
          </fieldset>

          <fieldset className="admin-activity-filter-drawer__action-group">
            <legend>Action (optional — narrows further)</legend>
            {ACTION_OPTIONS.map((option) => (
              <label key={option.value} className="admin-activity-filter-drawer__action-option">
                <input
                  type="checkbox"
                  checked={filters.action.includes(option.value)}
                  onChange={() => toggleAction(option.value)}
                />
                {option.label}
              </label>
            ))}
          </fieldset>

          <fieldset className="admin-activity-filter-drawer__target-group">
            <legend>Target type</legend>
            {TARGET_TYPE_OPTIONS.map((option) => (
              <label key={option.value} className="admin-activity-filter-drawer__target-option">
                <input
                  type="checkbox"
                  checked={filters.targetType.includes(option.value)}
                  onChange={() => toggleTargetType(option.value)}
                />
                {option.label}
              </label>
            ))}
          </fieldset>

          <div className="admin-field">
            <label htmlFor="admin-activity-filter-actor">Actor ID (UUID)</label>
            <input
              id="admin-activity-filter-actor"
              type="text"
              className="admin-input"
              placeholder="e.g. 123e4567-e89b-..."
              value={filters.actor ?? ""}
              onChange={(event) =>
                onFiltersChange({ ...filters, actor: event.target.value || null })
              }
            />
          </div>
        </div>

        <div className="admin-activity-filter-drawer__footer">
          <button
            type="button"
            className="admin-btn admin-btn--ghost"
            onClick={() =>
              onFiltersChange({
                ...filters,
                ...EMPTY_FILTERS,
                category: [],
              })
            }
          >
            Clear all
          </button>
          <button type="button" className="admin-btn admin-btn--primary" onClick={onApply}>
            Apply
          </button>
        </div>
      </div>
    </div>
  );
}
