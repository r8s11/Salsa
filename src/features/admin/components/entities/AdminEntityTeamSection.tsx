import { Link } from "react-router-dom";
import { useAdminEntityMembers } from "../../hooks/useAdminEntityClaims";
import {
  MANAGED_KIND_LABELS,
  MEMBER_ROLE_LABELS,
  workspacePath,
  type ManagedKind,
} from "../../../workspaces/model";
import "./AdminEntityTeamSection.css";

interface AdminEntityTeamSectionProps {
  kind: ManagedKind;
  id: string;
  /** Extra class so a host page can slot the section into its own grid. */
  className?: string;
}

/** Who manages one listing, with the way into its workspace and the claims queue. */
export default function AdminEntityTeamSection({ kind, id, className }: AdminEntityTeamSectionProps) {
  const { members, isLoading, error, refetch } = useAdminEntityMembers(kind, id);
  const kindLabel = MANAGED_KIND_LABELS[kind].toLowerCase();

  return (
    <section
      className={["admin-card", "admin-entity-team", className].filter(Boolean).join(" ")}
      aria-labelledby={`admin-entity-team-${id}`}
      aria-busy={isLoading || undefined}
    >
      <div className="admin-entity-team__heading">
        <h2 id={`admin-entity-team-${id}`}>
          Team <span className="admin-entity-team__count">({members.length})</span>
        </h2>
        <div className="admin-entity-team__links">
          <Link to={workspacePath(kind, id)} className="admin-btn admin-btn--secondary">
            Open workspace
          </Link>
          <Link to="/admin/claims" className="admin-btn admin-btn--secondary">
            Pending claims
          </Link>
        </div>
      </div>

      {isLoading ? (
        <p role="status" className="admin-entity-team__state">
          Loading team…
        </p>
      ) : error ? (
        <div className="admin-banner admin-banner--error" role="alert">
          <p>We couldn&apos;t load the team for this {kindLabel}.</p>
          <button type="button" className="admin-btn admin-btn--secondary" onClick={() => refetch()}>
            Try again
          </button>
        </div>
      ) : members.length === 0 ? (
        <p className="admin-entity-team__state">Nobody manages this listing yet.</p>
      ) : (
        <ul className="admin-entity-team__list">
          {members.map((member) => (
            <li key={member.user_id} className="admin-entity-team__row">
              <span className="admin-entity-team__who">
                <span className="admin-entity-team__name">{member.display_name ?? member.email}</span>
                {member.display_name && (
                  <span className="admin-entity-team__email">{member.email}</span>
                )}
              </span>
              <span className="admin-entity-team__role">{MEMBER_ROLE_LABELS[member.member_role]}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
