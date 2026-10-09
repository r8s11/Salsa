import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Desk, DeskEmpty, DeskError, DeskSkeleton } from "../../../components/desk/Desk";
import MarginMark from "../../../components/desk/MarginMark";
import type { DeskState } from "../../../components/desk/deskModel";
import AdminPageHeader from "../components/shell/AdminPageHeader";
import AdminViewTabs from "../components/shell/AdminViewTabs";
import AdminConfirmDialog from "../components/common/AdminConfirmDialog";
import { useAdminEntityClaims, type ClaimView } from "../hooks/useAdminEntityClaims";
import {
  CLAIM_RELATIONSHIP_LABELS,
  MANAGED_KIND_LABELS,
  MEMBER_ROLE_LABELS,
  type AdminEntityClaim,
  type ClaimStatus,
  type ManagedKind,
} from "../../workspaces/model";
import "./AdminEntityClaimsPage.css";

const CLAIM_VIEWS: { view: ClaimView; label: string }[] = [
  { view: "pending", label: "Pending" },
  { view: "approved", label: "Approved" },
  { view: "rejected", label: "Rejected" },
  { view: "all", label: "All" },
];

const EMPTY_COPY: Record<ClaimView, string> = {
  pending: "Galley is clear. No claims are waiting on a decision.",
  approved: "No approved claims yet.",
  rejected: "No rejected claims.",
  all: "Nobody has claimed a listing yet.",
};

const STATUS_STATE: Record<ClaimStatus, DeskState> = {
  pending: "unset",
  approved: "set",
  rejected: "killed",
  withdrawn: "standing",
};

const STATUS_WORD: Record<ClaimStatus, string> = {
  pending: "Awaiting decision",
  approved: "Approved",
  rejected: "Rejected",
  withdrawn: "Withdrawn",
};

const PUBLIC_SEGMENT: Record<ManagedKind, string> = { school: "s", venue: "v", instructor: "i" };
const ADMIN_SEGMENT: Record<ManagedKind, string> = {
  school: "schools",
  venue: "venues",
  instructor: "instructors",
};

const dateFormat = new Intl.DateTimeFormat("en-US", { dateStyle: "medium" });

function claimantName(claim: AdminEntityClaim): string {
  return claim.display_name?.trim() || claim.email;
}

export default function AdminEntityClaimsPage() {
  const [view, setView] = useState<ClaimView>("pending");
  const { claims, counts, isLoading, error, refetch, review, isReviewing } =
    useAdminEntityClaims(view);

  const [announcement, setAnnouncement] = useState("");
  const [leaving, setLeaving] = useState<{ id: string; outcome: "set" | "killed" } | null>(null);
  const [rowError, setRowError] = useState<{ id: string; message: string } | null>(null);
  const [rejecting, setRejecting] = useState<AdminEntityClaim | null>(null);
  const [rejectError, setRejectError] = useState<string | null>(null);
  const galleyRef = useRef<HTMLDivElement>(null);

  const changeView = (next: ClaimView) => {
    setView(next);
    setLeaving(null);
    setRowError(null);
  };

  const settle = (claim: AdminEntityClaim, outcome: "set" | "killed", sentence: string) => {
    setLeaving({ id: claim.id, outcome });
    setAnnouncement(sentence);
    galleyRef.current?.focus();
  };

  const approve = async (claim: AdminEntityClaim) => {
    setRowError(null);
    try {
      const result = await review({ claimId: claim.id, approve: true });
      const role = result.member_role ? MEMBER_ROLE_LABELS[result.member_role].toLowerCase() : "member";
      settle(
        claim,
        "set",
        `Approved ${claimantName(claim)} for ${claim.entity_name}. They are now ${/^[aeiou]/.test(role) ? "an" : "a"} ${role}.`,
      );
    } catch (reason) {
      setRowError({
        id: claim.id,
        message: reason instanceof Error ? reason.message : "We couldn't approve this claim.",
      });
    }
  };

  const reject = async (claim: AdminEntityClaim, note: string | undefined) => {
    setRejectError(null);
    try {
      await review({ claimId: claim.id, approve: false, note: note ?? null });
      setRejecting(null);
      settle(claim, "killed", `Rejected ${claimantName(claim)}'s claim on ${claim.entity_name}.`);
    } catch (reason) {
      setRejectError(reason instanceof Error ? reason.message : "We couldn't reject this claim.");
    }
  };

  const activeLeaving = view === "pending" ? leaving : null;

  return (
    <>
      <AdminPageHeader
        title="Listing Claims"
        description="People asking to manage a school, venue or artist listing. Approving makes them the listing's owner, or a manager when it already has one."
      />

      <p role="status" className="admin-visually-hidden">
        {announcement}
      </p>

      <AdminViewTabs
        views={CLAIM_VIEWS}
        active={view}
        counts={counts}
        panelId="admin-entity-claims-tabpanel"
        ariaLabel="Claim views"
        selectId="admin-entity-claims-view-select"
        selectLabel="Claim view"
        onChange={changeView}
      />

      <Desk>
        <div
          id="admin-entity-claims-tabpanel"
          role="tabpanel"
          aria-labelledby={`admin-view-tab-${view}`}
          className="admin-entity-claims__galley"
          ref={galleyRef}
          tabIndex={-1}
        >
          {isLoading ? (
            <DeskSkeleton rows={4} />
          ) : error ? (
            <DeskError message="We couldn't load listing claims." onRetry={() => void refetch()} />
          ) : claims.length === 0 ? (
            view === "pending" ? (
              <DeskEmpty>{EMPTY_COPY.pending}</DeskEmpty>
            ) : (
              <p className="desk__empty">{EMPTY_COPY[view]}</p>
            )
          ) : (
            <ul className="desk__list">
              {claims.map((claim) => {
                const isPending = claim.status === "pending";
                const isLeaving = activeLeaving?.id === claim.id;
                const busy = isReviewing || isLeaving;
                const name = claimantName(claim);
                const message = claim.message?.trim();
                return (
                  <li
                    key={claim.id}
                    className="desk__entry"
                    data-leaving={isLeaving ? activeLeaving.outcome : undefined}
                  >
                    <span className="desk__entry-mark">
                      <MarginMark state={STATUS_STATE[claim.status]} labelled />
                    </span>
                    <div className="desk__entry-body">
                      <h3 className="desk__entry-title">
                        <Link to={`/${PUBLIC_SEGMENT[claim.kind]}/${claim.entity_slug}`}>
                          {claim.entity_name}
                        </Link>
                      </h3>
                      <p className="desk__entry-meta">
                        <b>{MANAGED_KIND_LABELS[claim.kind]}</b>
                        {claim.entity_city && (
                          <>
                            <span className="desk__entry-sep" aria-hidden>
                              ·
                            </span>
                            {claim.entity_city}
                          </>
                        )}
                        <span className="desk__entry-sep" aria-hidden>
                          ·
                        </span>
                        <Link
                          to={`/admin/${ADMIN_SEGMENT[claim.kind]}/${claim.entity_id}`}
                          className="admin-entity-claims__admin-link"
                          aria-label={`Admin record for ${claim.entity_name}`}
                        >
                          Admin record
                        </Link>
                      </p>
                      <p className="desk__entry-meta">
                        <b>{name}</b>
                        {claim.display_name?.trim() && (
                          <>
                            <span className="desk__entry-sep" aria-hidden>
                              ·
                            </span>
                            <span>{claim.email}</span>
                          </>
                        )}
                        <span className="desk__entry-sep" aria-hidden>
                          ·
                        </span>
                        {CLAIM_RELATIONSHIP_LABELS[claim.relationship]}
                        <span className="desk__entry-sep" aria-hidden>
                          ·
                        </span>
                        <time dateTime={claim.created_at}>
                          {dateFormat.format(new Date(claim.created_at))}
                        </time>
                      </p>
                      {message && <p className="admin-entity-claims__message">{message}</p>}

                      {isPending && claim.active_owner_count > 0 && (
                        <p className="desk__entry-flags">
                          Already has an owner — approving makes them a manager
                        </p>
                      )}

                      {!isPending && (
                        <p className="desk__entry-meta admin-entity-claims__decision">
                          <b>{STATUS_WORD[claim.status]}</b>
                          {claim.reviewed_at && (
                            <>
                              <span className="desk__entry-sep" aria-hidden>
                                ·
                              </span>
                              {dateFormat.format(new Date(claim.reviewed_at))}
                            </>
                          )}
                          {claim.review_note && (
                            <>
                              <span className="desk__entry-sep" aria-hidden>
                                ·
                              </span>
                              <span>{claim.review_note}</span>
                            </>
                          )}
                        </p>
                      )}

                      {rowError?.id === claim.id && (
                        <p className="admin-entity-claims__error" role="alert">
                          {rowError.message}
                        </p>
                      )}

                      {isPending && (
                        <div className="desk__actions">
                          <button
                            type="button"
                            className="desk__action desk__action--set"
                            aria-label={`Approve ${name}'s claim on ${claim.entity_name}`}
                            disabled={busy}
                            onClick={() => void approve(claim)}
                          >
                            Approve
                          </button>
                          <button
                            type="button"
                            className="desk__action desk__action--kill"
                            aria-label={`Reject ${name}'s claim on ${claim.entity_name}`}
                            disabled={busy}
                            onClick={() => {
                              setRejectError(null);
                              setRejecting(claim);
                            }}
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

      {rejecting && (
        <AdminConfirmDialog
          title={`Reject ${claimantName(rejecting)}'s claim?`}
          body={`They will not be able to manage ${rejecting.entity_name}. Any note below is kept on the claim record.`}
          confirmLabel="Reject claim"
          busyLabel="Rejecting…"
          isBusy={isReviewing}
          reasonField={{ label: "Note (optional)", placeholder: "Why this claim was rejected…" }}
          error={rejectError}
          onConfirm={(note) => void reject(rejecting, note)}
          onCancel={() => setRejecting(null)}
        />
      )}
    </>
  );
}
