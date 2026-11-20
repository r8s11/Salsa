import { useState } from "react";
import { Link } from "react-router-dom";
import { useUserOrganizerMemberships } from "../../hooks/useOrganizerAccess";
import {
  INSUFFICIENT_PERMISSION_MESSAGE,
  MEMBER_ROLE_LABEL,
  ORGANIZER_ACCESS_LABEL,
  activeMembershipCount,
  managedEventCount,
  organizerAccessErrorMessage,
  organizerAccessState,
} from "../../model/organizerAccess";
import type { AdminUserRow } from "../../model/usersQuery";
import { displayNameFor } from "../../model/usersQuery";
import AssignOrganizerMemberDialog from "./AssignOrganizerMemberDialog";
import "./UserOrganizerAccessPanel.css";

interface Props {
  user: AdminUserRow;
  /** Only administrators may read or change organizer access. */
  isAdmin: boolean;
}

/** Account-level view of organizer access: role, memberships and the next action. */
export default function UserOrganizerAccessPanel({ user, isAdmin }: Props) {
  const [assigning, setAssigning] = useState(false);
  const query = useUserOrganizerMemberships(isAdmin && user.user_id ? user.user_id : null);
  const memberships = query.data ?? [];
  const state = organizerAccessState(user.role, memberships);

  if (!user.user_id) return null;
  // Non-organizers only get the panel once they hold a membership.
  if (user.role !== "organizer" && (!isAdmin || query.isPending || memberships.length === 0)) {
    return null;
  }

  return (
    <section
      className="admin-card user-organizer-access"
      aria-labelledby="user-organizer-access-heading"
    >
      <h2 id="user-organizer-access-heading">Organizer access</h2>

      {!isAdmin ? (
        <p role="status" className="user-organizer-access__note">
          {INSUFFICIENT_PERMISSION_MESSAGE}
        </p>
      ) : query.isPending ? (
        <p role="status" aria-busy="true">
          Loading organizer access…
        </p>
      ) : query.isError ? (
        <div role="alert">
          <p>{organizerAccessErrorMessage(query.error)}</p>
          <button
            type="button"
            className="admin-btn admin-btn--secondary"
            onClick={() => query.refetch()}
          >
            Try Again
          </button>
        </div>
      ) : (
        <>
          {state !== "not_applicable" ? (
            <p className={`user-organizer-access__status user-organizer-access__status--${state}`}>
              {ORGANIZER_ACCESS_LABEL[state]}
            </p>
          ) : (
            <p className="user-organizer-access__note">No organizer teams yet.</p>
          )}

          {state === "membership_missing" && (
            <div className="admin-banner">
              <p>
                {displayNameFor(user)} has the Organizer role but is not on any organizer&apos;s
                team, so they cannot manage events. Assign them to an organizer to grant access.
              </p>
            </div>
          )}
          {state === "organizer_inactive" && (
            <div className="admin-banner">
              <p>
                Every organizer this user belongs to is inactive. Reactivate it or assign them to an
                active organizer.
              </p>
            </div>
          )}

          {memberships.length > 0 && (
            <ul className="user-organizer-access__list">
              {memberships.map((m) => (
                <li key={m.organizer_id}>
                  <span className="user-organizer-access__name">{m.organizer_name}</span>
                  <span>
                    {MEMBER_ROLE_LABEL[m.member_role]}
                    {m.member_status === "removed" && " (removed)"}
                    {m.organizer_status !== "active" && ` · organizer ${m.organizer_status}`}
                  </span>
                  <span>
                    {m.event_count} {Number(m.event_count) === 1 ? "event" : "events"}
                  </span>
                </li>
              ))}
            </ul>
          )}
          {activeMembershipCount(memberships) > 0 && (
            <p className="user-organizer-access__note">
              Manages {managedEventCount(memberships)} events across{" "}
              {activeMembershipCount(memberships)} organizer
              {activeMembershipCount(memberships) === 1 ? "" : "s"}. Owners and Managers edit
              events; Editors only view them.
            </p>
          )}

          <button
            type="button"
            className="admin-btn admin-btn--secondary"
            onClick={() => setAssigning(true)}
          >
            Assign to Organizer
          </button>
          <Link to={`/admin/events?submitter=${encodeURIComponent(user.user_id)}`}>
            View Events
          </Link>
        </>
      )}

      {assigning && (
        <AssignOrganizerMemberDialog
          user={{ id: user.user_id, name: displayNameFor(user) }}
          onClose={() => setAssigning(false)}
        />
      )}
    </section>
  );
}
