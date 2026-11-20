import { useState } from "react";
import { useOrganizerTeam } from "../../hooks/useOrganizerAccess";
import { MEMBER_ROLE_LABEL, organizerAccessErrorMessage } from "../../model/organizerAccess";
import AssignOrganizerMemberDialog from "../organizers/AssignOrganizerMemberDialog";
import "./EventOrganizerPanel.css";

interface Props {
  organizer: { id: string; name: string } | null;
  /** Moves focus to the "Organized By" picker. */
  onChoose: () => void;
}

/**
 * "Organized By" is the organizer profile an event belongs to. "Team Members"
 * are the users who may manage that organizer's events. This panel explains
 * the difference and shows the team of the selected organizer.
 */
export default function EventOrganizerPanel({ organizer, onChoose }: Props) {
  return (
    <div className="event-organizer-panel">
      <p className="event-organizer-panel__intro">
        <strong>Organized By</strong> is the organizer this event belongs to.{" "}
        <strong>Team Members</strong> are the users allowed to manage that organizer&apos;s events.
      </p>
      {organizer ? (
        <OrganizerTeam organizerId={organizer.id} organizerName={organizer.name} />
      ) : (
        <div className="admin-banner" role="status">
          <p>
            <strong>Event has no assigned organizer.</strong> Only administrators can edit it until
            an organizer is chosen.
          </p>
          <button type="button" className="admin-btn admin-btn--secondary" onClick={onChoose}>
            Choose organizer
          </button>
        </div>
      )}
    </div>
  );
}

function OrganizerTeam({
  organizerId,
  organizerName,
}: {
  organizerId: string;
  organizerName: string;
}) {
  const team = useOrganizerTeam(organizerId);
  const [adding, setAdding] = useState(false);
  const members = (team.data?.members ?? []).filter((m) => m.member_status === "active");
  const inactive = team.data && team.data.organizer_status !== "active";

  return (
    <section
      className="event-organizer-panel__team"
      aria-label={`Team Members of ${organizerName}`}
    >
      <h3>Team Members</h3>
      {team.isPending ? (
        <p role="status" aria-busy="true">
          Loading team…
        </p>
      ) : team.isError ? (
        <div role="alert">
          <p>{organizerAccessErrorMessage(team.error)}</p>
          <button
            type="button"
            className="admin-btn admin-btn--secondary"
            onClick={() => team.refetch()}
          >
            Try Again
          </button>
        </div>
      ) : (
        <>
          {inactive && (
            <div className="admin-banner" role="status">
              <p>
                <strong>Organizer inactive.</strong> {organizerName} is {team.data.organizer_status}
                , so its team cannot manage events until it is reactivated.
              </p>
            </div>
          )}
          {members.length === 0 ? (
            <p role="status" className="event-organizer-panel__empty">
              No one is on {organizerName}&apos;s team yet, so only administrators can manage this
              event.
            </p>
          ) : (
            <ul className="event-organizer-panel__list">
              {members.map((m) => (
                <li key={m.user_id}>
                  <span>
                    {m.display_name || m.username || m.email || "Unnamed user"}
                    {m.email && m.display_name && <small> {m.email}</small>}
                  </span>
                  <span>{MEMBER_ROLE_LABEL[m.member_role]}</span>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            className="admin-btn admin-btn--secondary"
            disabled={Boolean(inactive)}
            onClick={() => setAdding(true)}
          >
            Add team member
          </button>
        </>
      )}
      {adding && (
        <AssignOrganizerMemberDialog
          organizer={{ id: organizerId, name: organizerName }}
          onClose={() => setAdding(false)}
        />
      )}
    </section>
  );
}
