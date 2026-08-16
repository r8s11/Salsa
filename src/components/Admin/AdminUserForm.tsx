import { useId, useState } from "react";
import type { FormEvent } from "react";
import { useEscapeKey } from "../../features/calendar/hooks/useEscapeKey";
import {
  ROLE_LABEL,
  type UserRole,
} from "../../features/admin/model/usersQuery";
import type { CreateUserParams } from "../../features/admin/api/profilesRepo";
import "./AdminUserForm.css";

interface AdminUserFormProps {
  isBusy: boolean;
  error: string | null;
  onSubmit: (params: CreateUserParams) => void;
  onCancel: () => void;
}

const ROLE_OPTIONS: UserRole[] = ["user", "moderator", "organizer", "admin"];

export default function AdminUserForm({
  isBusy,
  error,
  onSubmit,
  onCancel,
}: AdminUserFormProps) {
  const titleId = useId();

  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<UserRole>("user");

  useEscapeKey(onCancel);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim()) return;
    onSubmit({
      email: email.trim(),
      display_name: displayName.trim() || undefined,
      role,
    });
  };

  return (
    <div className="admin-user-form__overlay" onClick={onCancel}>
      <div
        className="admin-user-form admin-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id={titleId}>Add User</h2>

        <form onSubmit={handleSubmit}>
          <div className="admin-field">
            <label htmlFor="admin-user-form-email">Email</label>
            <input
              id="admin-user-form-email"
              type="email"
              className="admin-input"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              autoFocus
              required
            />
          </div>

          <div className="admin-field">
            <label htmlFor="admin-user-form-name">Display Name</label>
            <input
              id="admin-user-form-name"
              type="text"
              className="admin-input"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Optional"
            />
          </div>

          <div className="admin-field">
            <label htmlFor="admin-user-form-role">Role</label>
            <select
              id="admin-user-form-role"
              className="admin-select"
              value={role}
              onChange={(event) => setRole(event.target.value as UserRole)}
            >
              {ROLE_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </div>

          <p className="admin-user-form__hint">
            An invite email with a sign-up link will be sent to the address above.
          </p>

          {error && (
            <p className="admin-field__error" role="alert">
              {error}
            </p>
          )}

          <div className="admin-user-form__actions">
            <button
              type="button"
              className="admin-btn admin-btn--secondary"
              onClick={onCancel}
              disabled={isBusy}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="admin-btn admin-btn--primary"
              disabled={isBusy || !email.trim()}
            >
              {isBusy ? "Inviting…" : "Invite User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
