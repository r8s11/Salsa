import { useEffect, useRef, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { useEscapeKey } from "../../features/calendar/hooks/useEscapeKey";
import {
  CATEGORY_LABEL,
  type ActivityCategory,
  type ActivityFilters,
} from "../../features/admin/model/auditActivityQuery";
import "./AdminActivityFilterDrawer.css";

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

  useEscapeKey(() => {
    if (open) onClose();
  });

  useEffect(() => {
    if (open) dialogRef.current?.focus();
  }, [open]);

  // Tab cycling within the drawer
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab" || !dialogRef.current) return;
    const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
      "button, [href], select, input, textarea, [tabindex]:not([tabindex='-1'])"
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const toggleCategory = (value: ActivityCategory) => {
    const next = filters.category.includes(value)
      ? filters.category.filter((c) => c !== value)
      : [...filters.category, value];
    onFiltersChange({ ...filters, category: next });
  };

  const toggleAction = (value: string) => {
    const next = filters.action.includes(value)
      ? filters.action.filter((a) => a !== value)
      : [...filters.action, value];
    onFiltersChange({ ...filters, action: next });
  };

  const toggleTargetType = (value: string) => {
    const next = filters.targetType.includes(value)
      ? filters.targetType.filter((t) => t !== value)
      : [...filters.targetType, value];
    onFiltersChange({ ...filters, targetType: next });
  };

  if (!open) return null;

  return (
    <div className="admin-activity-filter-drawer__overlay" onClick={onClose}>
      <div
        ref={dialogRef}
        className="admin-activity-filter-drawer admin-card"
        role="dialog"
        aria-modal="true"
        aria-label="More filters"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={handleKeyDown}
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
              <label
                key={option}
                className="admin-activity-filter-drawer__category-option"
              >
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
              <label
                key={option.value}
                className="admin-activity-filter-drawer__action-option"
              >
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
              <label
                key={option.value}
                className="admin-activity-filter-drawer__target-option"
              >
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
