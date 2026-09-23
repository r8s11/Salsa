import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { useAdminSubmissions } from "../../features/admin/hooks/useAdminSubmissionList";
import type { EventSubmission } from "../../features/admin/model/submissions";
import type { DatabaseEvent } from "../../features/events/model/types";
import { missingFields } from "../../features/admin/model/overviewMetrics";
import {
  Desk,
  DeskColumn,
  DeskEmpty,
  DeskError,
  DeskMeasure,
  DeskMeasures,
  DeskRule,
  DeskSkeleton,
} from "./Desk";
import type { DeskCount, DeskListing } from "./deskModel";
import Galley from "./Galley";
import { readSubmission } from "./deskModel";

/**
 * The operator desk, shared by the admin and moderator overviews so both
 * roles read the same week in the same language. The roles differ only in
 * which counts stand in the rule and whether event creation is offered.
 */

export interface OperatorDeskProps {
  role: "admin" | "moderator";
  /** Approved, upcoming events. These are already set in the column. */
  upcoming: DatabaseEvent[];
  organizerRequestCount: number;
  flaggedUserCount: number;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  now?: Date;
}

/** How long the leaving row is allowed to animate before it is dropped. */
const LEAVE_MS = 420;

export default function OperatorDesk({
  role,
  upcoming,
  organizerRequestCount,
  flaggedUserCount,
  isLoading,
  error,
  onRetry,
  now,
}: OperatorDeskProps) {
  const {
    submissions,
    isLoading: submissionsLoading,
    error: submissionsError,
    approveSubmissionWithTaxonomy,
    isApproving,
    updateSubmission,
    isUpdating,
  } = useAdminSubmissions();

  /* One propagation: a decision removes the entry from the galley, sets it
     into the column, and drops the count — as a single state change rather
     than three independent refreshes. */
  const [decided, setDecided] = useState<Record<string, "set" | "killed">>({});
  const [leaving, setLeaving] = useState<{ id: string; outcome: "set" | "killed" } | null>(null);
  const [arrivingId, setArrivingId] = useState<string | null>(null);
  const [settledListings, setSettledListings] = useState<DeskListing[]>([]);
  const [settledId, setSettledId] = useState<string | null>(null);
  const [decideError, setDecideError] = useState<string | null>(null);

  const today = useMemo(() => now ?? new Date(), [now]);

  const pending = useMemo(
    () => submissions.filter((submission) => !decided[submission.id]),
    [submissions, decided]
  );

  const settle = useCallback(
    (submission: EventSubmission, outcome: "set" | "killed") => {
      setDecideError(null);
      setLeaving({ id: submission.id, outcome });

      window.setTimeout(() => {
        setDecided((previous) => ({ ...previous, [submission.id]: outcome }));
        setLeaving(null);

        if (outcome === "set") {
          const view = readSubmission(submission);
          setSettledListings((previous) => [
            ...previous,
            {
              id: submission.id,
              title: view.title,
              date: view.date,
              venue: view.venue,
              state: isToday(view.date, today) ? "tonight" : "set",
            },
          ]);
          setArrivingId(submission.id);
          setSettledId(submission.id);
          window.setTimeout(() => setArrivingId(null), 600);
        }
      }, LEAVE_MS);
    },
    [today]
  );

  const handleSet = useCallback(
    (submission: EventSubmission) => {
      const view = readSubmission(submission);
      approveSubmissionWithTaxonomy(
        { submissionId: submission.id, taxonomyTermIds: view.taxonomyTermIds },
        {
          // Wait for the server before the entry leaves the galley. A failed
          // approval stays in context, rather than briefly claiming it was set.
          onSuccess: () => {
            setSettledListings((previous) => previous.filter((row) => row.id !== submission.id));
            settle(submission, "set");
          },
          onError: (mutationError: Error) => {
            setDecideError(mutationError.message || "We couldn't approve this entry.");
          },
        }
      );
    },
    [approveSubmissionWithTaxonomy, settle]
  );

  const handleSettledFocus = useCallback(() => setSettledId(null), []);

  const handleKill = useCallback(
    (
      submission: EventSubmission,
      reason: EventSubmission["rejection_reason"],
      message: string,
      note: string
    ) => {
      updateSubmission(
        {
          id: submission.id,
          update: {
            status: "rejected",
            rejection_reason: reason,
            rejection_message: message,
            internal_note: note,
          },
        },
        {
          onError: (mutationError: Error) => {
            setDecided((previous) => {
              const next = { ...previous };
              delete next[submission.id];
              return next;
            });
            setDecideError(mutationError.message || "We couldn't reject this entry.");
          },
        }
      );
      settle(submission, "killed");
    },
    [updateSubmission, settle]
  );

  const columnListings = useMemo(
    () => [...upcoming.map((event) => eventToListing(event, today)), ...settledListings],
    [upcoming, settledListings, today]
  );

  const counts: DeskCount[] = [
    {
      id: "unset",
      value: pending.length,
      label: pending.length === 1 ? "entry unset" : "entries unset",
      work: pending.length > 0,
      settled: arrivingId !== null,
      to: "/admin/submissions",
    },
    {
      id: "organizers",
      value: organizerRequestCount,
      label: organizerRequestCount === 1 ? "organizer request" : "organizer requests",
      work: organizerRequestCount > 0,
      to: "/admin/organizer-requests",
    },
  ];

  if (role === "admin") {
    counts.push({
      id: "flagged",
      value: flaggedUserCount,
      label: flaggedUserCount === 1 ? "flagged account" : "flagged accounts",
      work: flaggedUserCount > 0,
      to: "/admin/users?status=flagged",
    });
  }

  return (
    <Desk>
      <DeskRule
        date={today.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
        dateline={role === "admin" ? "Salsa Segura · Desk" : "Salsa Segura · Review desk"}
        counts={counts}
        actions={
          role === "admin" ? (
            <Link to="/admin/events?new=1" className="desk__action desk__action--primary">
              <Plus size={15} aria-hidden /> Create event
            </Link>
          ) : undefined
        }
      />

      <DeskMeasures>
        <DeskMeasure
          title="Galley"
          note={pending.length > 0 ? "Awaiting decision" : undefined}
          link={{ to: "/admin/submissions", label: "All submissions" }}
        >
          <Galley
            submissions={pending}
            isLoading={submissionsLoading}
            error={submissionsError ? "We couldn't load the galley." : null}
            leavingId={leaving?.id ?? null}
            leavingOutcome={leaving?.outcome ?? null}
            settledId={settledId}
            onSettledFocus={handleSettledFocus}
            onSet={handleSet}
            onKill={handleKill}
            isDeciding={isApproving || isUpdating}
            decideError={decideError}
          />
        </DeskMeasure>

        <DeskMeasure title="Set for the week" link={{ to: "/admin/events", label: "All events" }}>
          {isLoading ? (
            <DeskSkeleton rows={5} />
          ) : error ? (
            <DeskError message="We couldn't load the week." onRetry={onRetry} />
          ) : columnListings.length === 0 ? (
            <DeskEmpty>Nothing is set for the next seven nights.</DeskEmpty>
          ) : (
            <DeskColumn listings={columnListings} now={today} arrivingId={arrivingId} />
          )}
        </DeskMeasure>
      </DeskMeasures>
    </Desk>
  );
}

function isToday(iso: string | null, now: Date): boolean {
  if (!iso) return false;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return false;
  return parsed.toDateString() === now.toDateString();
}

function eventToListing(event: DatabaseEvent, now: Date): DeskListing {
  const missing = missingFields(event);
  return {
    id: event.id,
    title: event.title,
    date: event.event_date,
    venue: event.location,
    state: isToday(event.event_date, now) ? "tonight" : "set",
    to: `/admin/events?edit=${event.id}`,
    flags: missing.map((field) => MISSING_LABEL[field]),
  };
}

const MISSING_LABEL: Record<"venue" | "time" | "image", string> = {
  venue: "No venue",
  time: "No time",
  image: "No flyer",
};
