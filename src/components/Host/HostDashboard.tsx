import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Building2, Plus } from "lucide-react";
import { useAuth } from "../../contexts/useAuth";
import { useMySubmissions } from "../../features/account/hooks/useMySubmissions";
import { useMyOrganizers } from "../../features/host/hooks/useMyOrganizers";
import { useMyOrganizerEvents } from "../../features/host/hooks/useMyOrganizerEvents";
import type { OrganizerMemberRole } from "../../features/host/api/organizerAccessRepo";
import type { DatabaseEvent } from "../../features/events/model/types";
import { deriveHostEventRows, isUpcomingHostEvent } from "../../features/host/model/hostEvents";
import {
  Desk,
  DeskColumn,
  DeskEmpty,
  DeskEntry,
  DeskError,
  DeskMeasure,
  DeskMeasures,
  DeskRule,
  DeskSkeleton,
} from "../Desk/Desk";
import type { DeskCount, DeskListing, DeskState } from "../Desk/deskModel";
import "./HostDashboard.css";

const ROLE_LABELS: Record<OrganizerMemberRole, string> = {
  owner: "Owner",
  manager: "Manager",
  editor: "Editor",
};

/**
 * The host reads the same desk as the platform, in a single measure: their
 * own entries, with state in the hanging margin and the week they are set
 * into underneath.
 */
export default function HostDashboard() {
  const { user, isAdmin, isModerator } = useAuth();
  const { submissions, approvedEvents, isLoading, error, refetch } = useMySubmissions(user?.id);
  const {
    data: organizers = [],
    isLoading: organizersLoading,
    error: organizersError,
    refetch: refetchOrganizers,
  } = useMyOrganizers();
  const organizerEvents = useMyOrganizerEvents();

  const canCreate = organizers.some(
    (organizer) =>
      organizer.organizerStatus === "active" &&
      (organizer.memberRole === "owner" || organizer.memberRole === "manager")
  );
  const dashboardLoading = isLoading || organizerEvents.isLoading;
  const dashboardError = error || organizersError?.message || organizerEvents.error;

  // Retry every query behind the desk, and let one missing refetch not
  // block the others.
  const refetchAll = () => {
    refetch?.();
    refetchOrganizers?.();
    organizerEvents.refetch?.();
  };

  // `new Date()` stays inside useMemo, matching the constraint the admin
  // overview documents.
  const { today, listings, unsetCount, standingCount, upcomingCount } = useMemo(() => {
    const now = new Date();
    // An organizer-owned event can arrive from both the submissions query
    // and the organizer query. Dedupe by id so it is one entry, not two.
    const byId = new Map(
      [...submissions, ...approvedEvents, ...organizerEvents.events].map(
        (event) => [event.id, event] as const
      )
    );
    const owned = [...byId.values()];
    const rows = deriveHostEventRows(owned);

    return {
      today: now,
      listings: rows.map((row) => toHostListing(row.event, now)),
      unsetCount: owned.filter((event) => event.status === "pending").length,
      standingCount: owned.filter((event) => event.status === "draft").length,
      upcomingCount: owned.filter((event) => isUpcomingHostEvent(event, now)).length,
    };
  }, [submissions, approvedEvents, organizerEvents.events]);

  const counts: DeskCount[] = [
    {
      id: "unset",
      value: unsetCount,
      label: unsetCount === 1 ? "awaiting review" : "awaiting review",
      work: unsetCount > 0,
      to: "/host/events",
    },
    {
      id: "standing",
      value: standingCount,
      label: standingCount === 1 ? "draft" : "drafts",
      work: standingCount > 0,
      to: "/host/events?filter=drafts",
    },
    {
      id: "upcoming",
      value: upcomingCount,
      label: upcomingCount === 1 ? "night ahead" : "nights ahead",
      to: "/host/events",
    },
  ];

  return (
    <Desk>
      <DeskRule
        date={today.toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
        })}
        dateline="Salsa Segura · Host desk"
        counts={counts}
        actions={
          <div className="desk__actions">
            {canCreate && (
              <Link to="/host/events/new" className="desk__action desk__action--set">
                <Plus size={15} aria-hidden /> Create event
              </Link>
            )}
            <Link to="/submit" className="desk__action">
              Submit an event
            </Link>
          </div>
        }
      />

      {dashboardError && <DeskError message="We couldn't load your events." onRetry={refetchAll} />}

      <DeskMeasures>
        <DeskMeasure title="Your entries" link={{ to: "/host/events", label: "All my events" }}>
          {dashboardLoading ? (
            <DeskSkeleton rows={4} />
          ) : listings.length === 0 ? (
            <DeskEmpty>
              {canCreate
                ? "No entries yet. Create an event and it appears here."
                : "No entries yet. Submit an event and it appears here."}
            </DeskEmpty>
          ) : (
            <ul className="desk__list">
              {listings.map((listing) => (
                <DeskEntry key={listing.id} listing={listing} showThumb />
              ))}
            </ul>
          )}
        </DeskMeasure>

        <DeskMeasure title="Set for the week">
          {dashboardLoading ? (
            <DeskSkeleton rows={5} />
          ) : (
            <DeskColumn
              listings={listings.filter((listing) => listing.state !== "killed")}
              now={today}
            />
          )}
        </DeskMeasure>
      </DeskMeasures>

      <section className="host-desk__organizers" aria-labelledby="host-organizers">
        <h2 id="host-organizers" className="desk__measure-title">
          Your organizers
        </h2>

        {organizersLoading ? (
          <DeskSkeleton rows={2} />
        ) : organizers.length > 0 ? (
          <ul className="desk__list">
            {organizers.map((organizer) => (
              <li key={organizer.organizerId} className="host-desk__organizer">
                <Building2 size={16} aria-hidden />
                <span className="host-desk__organizer-name">{organizer.organizerName}</span>
                <span className="host-desk__organizer-role">
                  {ROLE_LABELS[organizer.memberRole]}
                </span>
              </li>
            ))}
          </ul>
        ) : isAdmin || isModerator ? (
          <p className="host-desk__note">
            No organizer memberships on this account. Platform tools live in{" "}
            <Link to="/admin">Admin</Link>.
          </p>
        ) : (
          <p className="host-desk__note">
            No organizer access yet. Organizer access is granted by the Salsa Segura team once an
            organizer request is approved. <Link to="/contact">Contact Salsa Segura</Link> to get
            started.
          </p>
        )}
      </section>
    </Desk>
  );
}

const HOST_STATE: Record<DatabaseEvent["status"], DeskState> = {
  draft: "standing",
  pending: "unset",
  approved: "set",
  rejected: "killed",
  cancelled: "killed",
  archived: "killed",
};

function toHostListing(event: DatabaseEvent, now: Date): DeskListing {
  const state = HOST_STATE[event.status];
  const isTonight =
    state === "set" && new Date(event.event_date).toDateString() === now.toDateString();

  return {
    id: event.id,
    title: event.title,
    date: event.event_date,
    venue: event.location,
    state: isTonight ? "tonight" : state,
    to: `/host/events/${event.id}`,
    flyerUrl: event.image_url,
  };
}
