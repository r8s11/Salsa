import { Children, Fragment, useRef, useState, type ReactNode } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Desk, DeskEmpty, DeskError, DeskSkeleton } from "../../../components/desk/Desk";
import MarginMark from "../../../components/desk/MarginMark";
import type { DeskState } from "../../../components/desk/deskModel";
import {
  requestHeadline,
  requestStatusWord,
  type AdminListingRequest,
  type ListingRequestStatus,
} from "../../listingRequests/model";
import { MANAGED_KINDS, MEMBER_ROLE_LABELS, type ManagedKind } from "../../workspaces/model";
import AdminConfirmDialog from "../components/common/AdminConfirmDialog";
import AdminPageHeader from "../components/shell/AdminPageHeader";
import AdminViewTabs from "../components/shell/AdminViewTabs";
import { useAdminEntityDirectory, useAdminVenueOptions } from "../entities/hooks/useAdminEntities";
import { useAdminListingRequests, type ListingRequestScope, type ListingRequestView } from "../hooks/useAdminListingRequests";
import "./AdminListingRequestsPage.css";

const REQUEST_VIEWS: { view: ListingRequestView; label: string }[] = [
  { view: "pending", label: "Pending" },
  { view: "approved", label: "Approved" },
  { view: "rejected", label: "Rejected" },
  { view: "all", label: "All" },
];

const EMPTY_COPY: Record<ListingRequestView, string> = {
  pending: "No requests are waiting on a decision.",
  approved: "No approved requests yet.",
  rejected: "No rejected requests.",
  all: "Nobody has sent a request yet.",
};

const STATUS_STATE: Record<ListingRequestStatus, DeskState> = {
  pending: "unset",
  approved: "set",
  rejected: "killed",
  withdrawn: "standing",
};

const ADMIN_SEGMENT: Record<ManagedKind, string> = {
  school: "schools",
  venue: "venues",
  instructor: "instructors",
  dj: "djs",
};

/** What approving does, said before the admin confirms it. */
const APPROVE_BODY: Record<AdminListingRequest["request_type"], string> = {
  event_link: "This adds the event to the profile. It does not change the event or its organizer's access.",
  missing_listing:
    "This records the listing you chose as the one created for this request. It does not give the requester access; they claim it from its public page.",
  profile_change:
    "This records that the change was made. Approving does not edit the listing: make the change on its admin page first.",
};

const dateFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

function requesterName(request: AdminListingRequest): string {
  return request.display_name?.trim() || request.email;
}

function scopeFromQuery(params: URLSearchParams): ListingRequestScope | null {
  const kind = MANAGED_KINDS.find((value) => value === params.get("kind"));
  const id = params.get("entity");
  return kind && id ? { kind, id } : null;
}

type Decision = { request: AdminListingRequest; approve: boolean };

export default function AdminListingRequestsPage() {
  const [params] = useSearchParams();
  const scope = scopeFromQuery(params);
  const [view, setView] = useState<ListingRequestView>("pending");
  const { requests, counts, isLoading, error, refetch, review, isReviewing } = useAdminListingRequests(view, scope);

  const [announcement, setAnnouncement] = useState("");
  const [deciding, setDeciding] = useState<Decision | null>(null);
  const [decisionError, setDecisionError] = useState<string | null>(null);
  /** The listing the admin created, per missing-listing request. */
  const [created, setCreated] = useState<Record<string, string>>({});
  const [needsListing, setNeedsListing] = useState<string | null>(null);
  const galleyRef = useRef<HTMLDivElement>(null);

  const open = (request: AdminListingRequest, approve: boolean) => {
    if (approve && request.request_type === "missing_listing" && !created[request.id]) {
      setNeedsListing(request.id);
      return;
    }
    setNeedsListing(null);
    setDecisionError(null);
    setDeciding({ request, approve });
  };

  const decide = async ({ request, approve }: Decision, note: string | undefined) => {
    setDecisionError(null);
    try {
      await review({
        requestId: request.id,
        approve,
        note: note ?? null,
        resultingEntityId: approve && request.request_type === "missing_listing" ? created[request.id] : null,
      });
      setDeciding(null);
      setAnnouncement(`${approve ? "Approved" : "Rejected"}: ${requestHeadline(request)}.`);
      galleyRef.current?.focus();
    } catch (reason) {
      // The server's own words; the request stays pending.
      setDecisionError(reason instanceof Error ? reason.message : "We couldn't record this decision.");
    }
  };

  return (
    <>
      <AdminPageHeader
        title="Listing Requests"
        description="People asking for a missing listing, for an event on an Artist or DJ profile they manage, or for a change to a listing's name, city or page address. Nothing changes until you approve."
      />

      <p role="status" className="admin-visually-hidden">
        {announcement}
      </p>

      {scope && (
        <p className="admin-listing-requests__scope">
          Showing requests for one listing. <Link to="/admin/requests">Show every request</Link>
        </p>
      )}

      <AdminViewTabs
        views={REQUEST_VIEWS}
        active={view}
        counts={counts}
        panelId="admin-listing-requests-tabpanel"
        ariaLabel="Request views"
        selectId="admin-listing-requests-view-select"
        selectLabel="Request view"
        onChange={(next) => {
          setView(next);
          setNeedsListing(null);
        }}
      />

      <Desk>
        <div
          id="admin-listing-requests-tabpanel"
          role="tabpanel"
          aria-labelledby={`admin-view-tab-${view}`}
          className="admin-listing-requests__galley"
          ref={galleyRef}
          tabIndex={-1}
        >
          {isLoading ? (
            <DeskSkeleton rows={4} />
          ) : error ? (
            <DeskError message="We couldn't load listing requests." onRetry={() => void refetch()} />
          ) : requests.length === 0 ? (
            view === "pending" ? (
              <DeskEmpty>{EMPTY_COPY.pending}</DeskEmpty>
            ) : (
              <p className="desk__empty">{EMPTY_COPY[view]}</p>
            )
          ) : (
            <ul className="desk__list">
              {requests.map((request) => {
                const headline = requestHeadline(request);
                const isPending = request.status === "pending";
                const kind = request.entity_kind;
                return (
                  <li key={request.id} className="desk__entry" aria-label={headline}>
                    <span className="desk__entry-mark">
                      <MarginMark state={STATUS_STATE[request.status]} labelled />
                    </span>
                    <div className="desk__entry-body">
                      <h3 className="desk__entry-title">{headline}</h3>
                      <p className="desk__entry-meta">
                        <b>{requesterName(request)}</b>
                        {request.display_name?.trim() && (
                          <>
                            <Sep />
                            <span>{request.email}</span>
                          </>
                        )}
                        {request.member_role && (
                          <>
                            <Sep />
                            <span>{MEMBER_ROLE_LABELS[request.member_role]}</span>
                          </>
                        )}
                        <Sep />
                        <time dateTime={request.created_at}>{dateFormat.format(new Date(request.created_at))}</time>
                      </p>

                      {request.request_type === "event_link" && request.event_id && (
                        <p className="desk__entry-meta">
                          <Link to={`/admin/events?edit=${request.event_id}`} className="admin-listing-requests__link">
                            {request.event_title ?? "Event"}
                          </Link>
                          {request.event_date && (
                            <>
                              <Sep />
                              <time dateTime={request.event_date}>{dateFormat.format(new Date(request.event_date))}</time>
                            </>
                          )}
                          {request.event_location && (
                            <>
                              <Sep />
                              <span>{request.event_location}</span>
                            </>
                          )}
                          {request.event_status && (
                            <>
                              <Sep />
                              <span>{request.event_status}</span>
                            </>
                          )}
                          <Sep />
                          <span>{request.event_organizer_name ? `Organizer: ${request.event_organizer_name}` : "No organizer"}</span>
                        </p>
                      )}

                      {request.request_type === "missing_listing" && kind && (
                        <MetaLine>
                          {request.proposed_city && <span>{`City: ${request.proposed_city}`}</span>}
                          {request.website && <span>{`Website: ${request.website}`}</span>}
                          {request.instagram && <span>{`Instagram: ${request.instagram}`}</span>}
                          {isPending && (
                            <Link to={`/admin/${ADMIN_SEGMENT[kind]}/new`} className="admin-listing-requests__link">
                              Create the listing
                            </Link>
                          )}
                        </MetaLine>
                      )}

                      {request.request_type === "profile_change" && kind && request.entity_id && (
                        <MetaLine>
                          {request.proposed_name && <span>{`New name: ${request.proposed_name}`}</span>}
                          {request.proposed_city && <span>{`New city: ${request.proposed_city}`}</span>}
                          <Link to={`/admin/${ADMIN_SEGMENT[kind]}/${request.entity_id}`} className="admin-listing-requests__link">
                            Open the listing
                          </Link>
                        </MetaLine>
                      )}

                      {request.details && <p className="admin-listing-requests__message">{request.details}</p>}

                      {isPending && request.request_type === "event_link" && request.already_linked && (
                        <p className="desk__entry-flags">Already on this profile</p>
                      )}

                      {isPending && request.request_type === "missing_listing" && kind && (
                        <CreatedListingSelect
                          kind={kind}
                          label={`Listing created for: ${headline}`}
                          value={created[request.id] ?? ""}
                          onChange={(id) => {
                            setCreated((current) => ({ ...current, [request.id]: id }));
                            setNeedsListing(null);
                          }}
                        />
                      )}

                      {needsListing === request.id && (
                        <p className="admin-listing-requests__error" role="alert">
                          Choose the listing you created for this request.
                        </p>
                      )}

                      {!isPending && (
                        <p className="desk__entry-meta admin-listing-requests__decision">
                          <b>{requestStatusWord(request)}</b>
                          {request.reviewed_at && (
                            <>
                              <Sep />
                              <time dateTime={request.reviewed_at}>{dateFormat.format(new Date(request.reviewed_at))}</time>
                            </>
                          )}
                          {request.review_note && (
                            <>
                              <Sep />
                              <span>{request.review_note}</span>
                            </>
                          )}
                        </p>
                      )}

                      {isPending && (
                        <div className="desk__actions">
                          <button
                            type="button"
                            className="desk__action desk__action--set"
                            aria-label={`Approve: ${headline}`}
                            disabled={isReviewing}
                            onClick={() => open(request, true)}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="desk__action desk__action--kill"
                            aria-label={`Reject: ${headline}`}
                            disabled={isReviewing}
                            onClick={() => open(request, false)}
                          >
                            Reject
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </Desk>

      {deciding && (
        <AdminConfirmDialog
          key={`${deciding.request.id}:${deciding.approve}`}
          title={`${deciding.approve ? "Approve" : "Reject"}: ${requestHeadline(deciding.request)}`}
          body={
            deciding.approve
              ? APPROVE_BODY[deciding.request.request_type]
              : "The requester will see this as Not approved, with any note you add below."
          }
          confirmLabel={deciding.approve ? "Approve request" : "Reject request"}
          busyLabel={deciding.approve ? "Approving…" : "Rejecting…"}
          tone={deciding.approve ? "neutral" : "danger"}
          isBusy={isReviewing}
          reasonField={{
            label: "Note (optional)",
            placeholder: deciding.approve ? "Kept on the request record…" : "Why this request was not approved…",
          }}
          error={decisionError}
          onConfirm={(note) => void decide(deciding, note)}
          onCancel={() => setDeciding(null)}
        />
      )}
    </>
  );
}

function Sep() {
  return (
    <span className="desk__entry-sep" aria-hidden>
      ·
    </span>
  );
}

/** A meta line whose optional parts are separated, never led, by a dot. */
function MetaLine({ children }: { children: ReactNode }) {
  const parts = Children.toArray(children);
  if (parts.length === 0) return null;
  return (
    <p className="desk__entry-meta">
      {parts.map((part, index) => (
        <Fragment key={index}>
          {index > 0 && <Sep />}
          {part}
        </Fragment>
      ))}
    </p>
  );
}

/** Active listings of one kind, so approval can record which one answers the request. */
function CreatedListingSelect(props: { kind: ManagedKind; label: string; value: string; onChange: (id: string) => void }) {
  const { kind, label, value, onChange } = props;
  const isVenue = kind === "venue";
  // Venues have their own admin directory; the other kinds share one.
  const directory = useAdminEntityDirectory(isVenue ? "school" : kind, "", "active", !isVenue);
  const venues = useAdminVenueOptions(isVenue);
  const options: { id: string; name: string; city: string | null }[] = isVenue ? venues : (directory.rows ?? []);

  return (
    <select
      className="admin-select admin-listing-requests__created"
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">Choose the listing you created…</option>
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.city ? `${option.name} · ${option.city}` : option.name}
        </option>
      ))}
    </select>
  );
}
