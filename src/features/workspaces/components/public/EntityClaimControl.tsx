import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useAuth } from "../../../../contexts/useAuth";
import { setAuthReturnDestination } from "../../../../lib/authReturnDestination";
import {
  useMyEntityClaims,
  useMyEntityMemberships,
} from "../../hooks/useMyEntityMemberships";
import { type ManagedKind, workspacePath } from "../../model";
import { EntityClaimDialog } from "./EntityClaimDialog";
import "./EntityClaimControl.css";

interface EntityClaimControlProps {
  kind: ManagedKind;
  entity: { id: string; name: string; slug: string };
}

export function EntityClaimControl({ kind, entity }: EntityClaimControlProps) {
  const { user } = useAuth();
  const location = useLocation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { data: memberships, isPending: membershipsPending } = useMyEntityMemberships();
  const { data: claims, isPending: claimsPending } = useMyEntityClaims();

  // 1. Signed out
  if (!user) {
    const promptText =
      kind === "instructor" ? "Is this you?" : `Run this ${kind}?`;

    return (
      <div className="entity-claim-control" aria-label="Listing management">
        <p className="entity-claim-control__signed-out">
          <span className="entity-claim-control__prompt">{promptText}</span>{" "}
          <Link
            to="/signin"
            className="entity-claim-control__link"
            state={{ from: location.pathname }}
            onClick={() => {
              setAuthReturnDestination(location.pathname);
            }}
          >
            Sign in
          </Link>
        </p>
      </div>
    );
  }

  // Wait for both lookups so a manager never sees a "claim" button flash first.
  if (membershipsPending || claimsPending) return null;

  // 2. Signed in & Member
  const isMember = memberships?.some(
    (m) => m.kind === kind && m.id === entity.id,
  );

  if (isMember) {
    return (
      <div className="entity-claim-control" aria-label="Listing management">
        <Link
          to={workspacePath(kind, entity.id)}
          className="entity-claim-control__link entity-claim-control__workspace-link"
        >
          Open your workspace
        </Link>
      </div>
    );
  }

  // 3 & 4. Signed in claims check
  const entityClaims =
    claims?.filter((c) => c.kind === kind && c.entity_id === entity.id) ?? [];
  const pendingClaim = entityClaims.find((c) => c.status === "pending");

  if (pendingClaim) {
    return (
      <div className="entity-claim-control" aria-label="Listing management">
        <p className="entity-claim-control__status">
          Your claim is waiting for review.
        </p>
      </div>
    );
  }

  const rejectedClaim = entityClaims.find((c) => c.status === "rejected");
  const claimButtonLabel = `Claim this ${kind === "instructor" ? "profile" : kind}`;

  return (
    <div className="entity-claim-control" aria-label="Listing management">
      {rejectedClaim ? (
        <div className="entity-claim-control__rejected">
          <p className="entity-claim-control__rejected-title">
            Your previous claim was rejected.
          </p>
          {rejectedClaim.review_note && (
            <p className="entity-claim-control__review-note">
              Note: {rejectedClaim.review_note}
            </p>
          )}
          <button
            type="button"
            className="ui-button ui-button--secondary entity-claim-control__claim-btn"
            onClick={() => setIsDialogOpen(true)}
          >
            {claimButtonLabel}
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="ui-button ui-button--secondary entity-claim-control__claim-btn"
          onClick={() => setIsDialogOpen(true)}
        >
          {claimButtonLabel}
        </button>
      )}

      <EntityClaimDialog
        kind={kind}
        entity={entity}
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
      />
    </div>
  );
}
