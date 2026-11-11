import { useParams } from "react-router-dom";
import EventLinkRequestForm from "../../listingRequests/components/EventLinkRequestForm";
import ListingRequestStatusList from "../../listingRequests/components/ListingRequestStatusList";
import ProfileChangeRequestForm from "../../listingRequests/components/ProfileChangeRequestForm";
import { isEventLinkKind } from "../../listingRequests/model";
import WorkspaceFrame from "../components/WorkspaceFrame";
import { MANAGED_KIND_LABELS, canEditProfile, type EntityWorkspace, type ManagedKind } from "../model";

type RequestsPageProps = { kind: ManagedKind };

/** Requests an owner or manager sends to Salsa Segura about one listing, with their status. */
export default function EntityWorkspaceRequestsPage({ kind }: RequestsPageProps) {
  const { id = "" } = useParams();
  return (
    <WorkspaceFrame kind={kind} id={id} section="Requests">
      {(workspace) => <RequestsBody workspace={workspace} />}
    </WorkspaceFrame>
  );
}

function RequestsBody({ workspace }: { workspace: EntityWorkspace }) {
  const { kind, entity, role } = workspace;

  if (!canEditProfile(role)) {
    return (
      <div className="ws-body ws-body--measure">
        <p className="ws-note" role="status">
          Only owners and managers can send requests for this listing.
        </p>
      </div>
    );
  }

  return (
    <div className="ws-body ws-body--measure">
      {isEventLinkKind(kind) ? (
        <EventLinkRequestForm kind={kind} entityId={entity.id} entityName={entity.name} />
      ) : (
        <p className="ws-note">
          Events at your {MANAGED_KIND_LABELS[kind].toLowerCase()} are managed by their organizers. Ask the organizer, or
          contact them from the event page.
        </p>
      )}
      <ProfileChangeRequestForm kind={kind} entityId={entity.id} />
      <ListingRequestStatusList
        heading={`Requests for ${entity.name}`}
        emptyText="No requests have been sent for this listing."
        actionClassName="desk__action"
        filter={(request) => request.entity_id === entity.id}
      />
    </div>
  );
}
