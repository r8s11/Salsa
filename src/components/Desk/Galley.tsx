import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { EventSubmission } from "../../features/admin/model/submissions";
import AdminRejectSubmissionDialog from "../Admin/AdminRejectSubmissionDialog";
import { DeskEntry, DeskEmpty, DeskError, DeskSkeleton } from "./Desk";
import { readSubmission } from "./deskModel";
import type { DeskListing } from "./deskModel";

/**
 * The galley: entries awaiting decision. Each is a listing row carrying its
 * own evidence — the flyer at thumb size — and its state in the hanging
 * margin. Deciding one does not navigate; the row leaves the galley and the
 * entry arrives in the set column in the same movement.
 */

export interface GalleyDecision {
  id: string;
  outcome: "set" | "killed";
}

interface GalleyProps {
  submissions: EventSubmission[];
  isLoading: boolean;
  error: string | null;
  /** Ids already decided this session; they animate out and stay out. */
  leavingId: string | null;
  leavingOutcome: "set" | "killed" | null;
  /** An approved entry that just left the galley after its server confirmation. */
  settledId: string | null;
  onSettledFocus: () => void;
  onSet: (submission: EventSubmission) => void;
  onKill: (
    submission: EventSubmission,
    reason: EventSubmission["rejection_reason"],
    message: string,
    note: string
  ) => void;
  isDeciding: boolean;
  decideError: string | null;
  onRetry?: () => void;
}

export default function Galley({
  submissions,
  isLoading,
  error,
  leavingId,
  leavingOutcome,
  settledId,
  onSettledFocus,
  onSet,
  onKill,
  isDeciding,
  decideError,
  onRetry,
}: GalleyProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [killTarget, setKillTarget] = useState<EventSubmission | null>(null);
  const titleButtons = useRef(new Map<string, HTMLButtonElement>());
  const emptyStatus = useRef<HTMLParagraphElement>(null);

  // Render-phase adjustment (React docs: "Resetting state when a prop
  // changes"): closing the open row is a pure function of settledId
  // changing, not a side effect, so it happens during render instead of an
  // effect — no cascading extra render each time an entry settles.
  const [prevSettledId, setPrevSettledId] = useState(settledId);
  if (settledId !== prevSettledId) {
    setPrevSettledId(settledId);
    setOpenId(null);
  }

  // Focus is a real side effect (a DOM API, not React state), so it stays in
  // an effect: move focus to the next row, or the empty state if the galley
  // just emptied, then let the parent clear its one-shot settledId flag.
  useEffect(() => {
    if (!settledId) return;

    const next = submissions.find((submission) => submission.id !== settledId);
    if (next) {
      titleButtons.current.get(next.id)?.focus();
    } else {
      emptyStatus.current?.focus();
    }

    onSettledFocus();
  }, [onSettledFocus, settledId, submissions]);

  if (isLoading) return <DeskSkeleton rows={4} />;
  if (error) return <DeskError message={error} onRetry={onRetry} />;
  if (submissions.length === 0) {
    return (
      <DeskEmpty focusRef={emptyStatus} tabIndex={-1}>
        Galley is clear. Nothing is waiting on a decision.
      </DeskEmpty>
    );
  }

  return (
    <>
      <ul className="desk__list" data-has-open={openId ? "true" : undefined}>
        {submissions.map((submission) => {
          const listing = toListing(submission);
          const isOpen = openId === submission.id;
          const data = readSubmission(submission);

          return (
            <DeskEntry
              key={submission.id}
              listing={listing}
              showThumb
              open={isOpen}
              leaving={leavingId === submission.id ? (leavingOutcome ?? undefined) : undefined}
              onOpen={() => setOpenId(isOpen ? null : submission.id)}
              titleButtonRef={(node) => {
                if (node) titleButtons.current.set(submission.id, node);
                else titleButtons.current.delete(submission.id);
              }}
            >
              {isOpen && (
                <div className="desk__detail">
                  {data.flyerUrl ? (
                    <img className="desk__detail-flyer" src={data.flyerUrl} alt="" />
                  ) : (
                    <span />
                  )}

                  <div className="desk__detail-body">
                    {data.description && <p className="desk__detail-text">{data.description}</p>}

                    <dl className="desk__detail-facts">
                      <dt>Submitted by</dt>
                      <dd>
                        {submission.submitter_name || submission.submitter_email || "Unknown"}
                      </dd>
                      <dt>Received</dt>
                      <dd>{new Date(submission.submitted_at).toLocaleDateString("en-US")}</dd>
                      {data.address && (
                        <>
                          <dt>Address</dt>
                          <dd>{data.address}</dd>
                        </>
                      )}
                    </dl>

                    <div className="desk__actions">
                      <button
                        type="button"
                        className="desk__action desk__action--set"
                        onClick={() => onSet(submission)}
                        disabled={isDeciding}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="desk__action desk__action--kill"
                        onClick={() => setKillTarget(submission)}
                        disabled={isDeciding}
                      >
                        Reject
                      </button>
                      <Link className="desk__action" to={`/admin/submissions/${submission.id}`}>
                        Open full record
                      </Link>
                    </div>

                    {decideError && <DeskError message={decideError} />}
                  </div>
                </div>
              )}
            </DeskEntry>
          );
        })}
      </ul>

      {killTarget && (
        <AdminRejectSubmissionDialog
          submissionId={killTarget.id}
          submissionLabel={readSubmission(killTarget).title}
          isBusy={isDeciding}
          error={decideError}
          onConfirm={(reason, message, note) => {
            onKill(killTarget, reason as EventSubmission["rejection_reason"], message, note);
            setKillTarget(null);
          }}
          onCancel={() => setKillTarget(null)}
        />
      )}
    </>
  );
}

function toListing(submission: EventSubmission): DeskListing {
  const view = readSubmission(submission);
  // Flags name what is missing. The meta line never restates it.
  const flags: string[] = [];
  if (!view.venue) flags.push("No venue");
  if (!view.flyerUrl) flags.push("No flyer");

  return {
    id: submission.id,
    title: view.title,
    date: view.date,
    venue: view.venue,
    state: "unset",
    flags,
    flyerUrl: view.flyerUrl,
  };
}
