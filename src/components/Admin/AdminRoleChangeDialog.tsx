import { useEffect, useId, useRef, useState } from "react";
import { useEscapeKey } from "../../features/calendar/hooks/useEscapeKey";
import {
  ROLE_LABEL,
  displayNameFor,
  type AdminUserRow,
  type UserRole,
} from "../../features/admin/model/usersQuery";
import "./AdminRoleChangeDialog.css";

interface AdminRoleChangeDialogProps {
  user: AdminUserRow;
  isBusy: boolean;
  error: string | null;
  onConfirm: (role: UserRole) => void;
  onCancel: () => void;
}

const ROLE_OPTIONS: UserRole[] = ["user", "moderator", "organizer", "admin"];

const CONSEQUENCE_COPY: Record<UserRole, string> = {
  user: "Removes elevated access. They can still submit events for review.",
  moderator:
    "Moderators can review, edit, approve, and reject user-submitted events. They cannot approve Organizer requests.",
  organizer:
    "This is a direct role change, not the approval of a submitted request. The user will be able to: create events, publish their own events directly, edit and cancel their own events, manage attendee-related event information, and manage their organizer/brand presence. They will not receive Moderator or Admin permissions.",
  admin:
    "Admins have full access, including user management and role changes. Grant this sparingly.",
};

export default function AdminRoleChangeDialog({
  user,
  isBusy,
  error,
  onConfirm,
  onCancel,
}: AdminRoleChangeDialogProps) {
  const titleId = useId();
  const selectRef = useRef<HTMLSelectElement>(null);
  const previouslyFocusedRef = useRef<Element | null>(null);
  const currentRole = user.role ?? "user";
  const [selectedRole, setSelectedRole] = useState<UserRole>(currentRole);

  useEscapeKey(onCancel);

  useEffect(() => {
    previouslyFocusedRef.current = document.activeElement;
    selectRef.current?.focus();
    return () => {
      const previouslyFocused = previouslyFocusedRef.current;
      if (previouslyFocused instanceof HTMLElement) {
        previouslyFocused.focus();
      }
    };
  }, []);

  return (
    <div className="admin-role-change-dialog__overlay" onClick={onCancel}>
      <div
        className="admin-role-change-dialog admin-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={titleId}>
          Change role for {user.username ? `@${user.username}` : displayNameFor(user)}
        </h2>

        <div className="admin-field">
          <span className="admin-role-change-dialog__label">Current role</span>
          <p className="admin-role-change-dialog__current">{ROLE_LABEL[currentRole]}</p>
        </div>

        <div className="admin-field">
          <label htmlFor="admin-role-change-select">New role</label>
          <select
            id="admin-role-change-select"
            ref={selectRef}
            className="admin-select"
            value={selectedRole}
            onChange={(event) => setSelectedRole(event.target.value as UserRole)}
          >
            {ROLE_OPTIONS.map((role) => (
              <option key={role} value={role}>
                {ROLE_LABEL[role]}
              </option>
            ))}
          </select>
        </div>

        <p className="admin-role-change-dialog__consequence" role="status">
          {CONSEQUENCE_COPY[selectedRole]}
        </p>

        <p className="admin-role-change-dialog__effect">
          Takes effect the next time they sign in or their session refreshes.
        </p>

        {error && (
          <p className="admin-field__error" role="alert">
            {error}
          </p>
        )}

        <div className="admin-role-change-dialog__actions">
          <button
            type="button"
            className="admin-btn admin-btn--secondary"
            onClick={onCancel}
            disabled={isBusy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="admin-btn admin-btn--primary"
            onClick={() => onConfirm(selectedRole)}
            disabled={isBusy || selectedRole === currentRole}
          >
            {isBusy ? "Working…" : "Change Role"}
          </button>
        </div>
      </div>
    </div>
  );
}
