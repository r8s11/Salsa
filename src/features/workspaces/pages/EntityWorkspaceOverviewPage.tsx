import { useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { DeskEmpty, DeskEntry, DeskMeasure, DeskMeasures } from "../../../components/desk/Desk";
import type { DeskListing } from "../../../components/desk/deskModel";
import WorkspaceFrame from "../components/WorkspaceFrame";
import {
  WEEKDAY_LABELS,
  workspacePath,
  type EntityWorkspace,
  type ManagedKind,
  type SchoolClass,
  type Weekday,
} from "../model";
import { formatTimeRange } from "../offeringForm";

const WEEKDAYS: readonly Weekday[] = [1, 2, 3, 4, 5, 6, 7];

type OverviewProps = { kind: ManagedKind };

export default function EntityWorkspaceOverviewPage({ kind }: OverviewProps) {
  const { id = "" } = useParams();
  return (
    <WorkspaceFrame kind={kind} id={id} section="Overview">
      {(workspace) => <OverviewBody workspace={workspace} />}
    </WorkspaceFrame>
  );
}

function OverviewBody({ workspace }: { workspace: EntityWorkspace }) {
  const { kind, entity, members, upcoming, offerings } = workspace;
  const id = entity.id;

  const nights: DeskListing[] = upcoming.map((event) => ({
    id: event.id,
    title: event.title,
    date: event.event_date,
    venue: event.location,
    state: "set",
    to: `/events/${event.slug || event.id}`,
  }));

  const upcomingNights = (
    <DeskMeasure title="Upcoming nights" note="Linked to this listing">
      {nights.length === 0 ? (
        <DeskEmpty>No upcoming nights are linked to this listing yet.</DeskEmpty>
      ) : (
        <ul className="desk__list">
          {nights.map((listing) => (
            <DeskEntry key={listing.id} listing={listing} />
          ))}
        </ul>
      )}
    </DeskMeasure>
  );

  if (offerings === null) {
    return (
      <>
        <ul className="desk__counts ws-figures">
          <Figure value={members.length} label={members.length === 1 ? "team member" : "team members"} />
          <Figure value={nights.length} label={nights.length === 1 ? "night ahead" : "nights ahead"} />
        </ul>
        <div className="ws-body ws-body--measure">{upcomingNights}</div>
      </>
    );
  }

  const activeClasses = offerings.classes.filter((entry) => entry.status === "active");
  const activePrivates = offerings.privates.filter((offer) => offer.status === "active");
  const activePlans = offerings.plans.filter((plan) => plan.status === "active");

  return (
    <>
      <ul className="desk__counts ws-figures">
        <Figure
          value={activeClasses.length}
          label={activeClasses.length === 1 ? "active class" : "active classes"}
          to={workspacePath(kind, id, "timetable")}
        />
        <Figure
          value={activePrivates.length}
          label={activePrivates.length === 1 ? "private lesson" : "private lessons"}
          to={workspacePath(kind, id, "privates")}
        />
        <Figure
          value={activePlans.length}
          label={activePlans.length === 1 ? "price plan" : "price plans"}
          to={workspacePath(kind, id, "prices")}
        />
        <Figure
          value={members.length}
          label={members.length === 1 ? "team member" : "team members"}
          to={workspace.role === "owner" || workspace.role === "admin" ? workspacePath(kind, id, "team") : undefined}
        />
      </ul>

      <div className="ws-body">
        <DeskMeasures>
          {upcomingNights}
          <DeskMeasure
            title="The week's timetable"
            link={{ to: workspacePath(kind, id, "timetable"), label: "Edit timetable" }}
          >
            <WeekPreview classes={activeClasses} />
          </DeskMeasure>
        </DeskMeasures>
      </div>
    </>
  );
}

function Figure({ value, label, to }: { value: number; label: string; to?: string }) {
  const body = (
    <>
      <span className="desk__count-figure">{value}</span>
      {label}
    </>
  );
  return <li>{to ? <Link to={to} className="desk__count">{body}</Link> : <span className="desk__count">{body}</span>}</li>;
}

/** Seven divisions Monday → Sunday; a day with no class still holds its place. */
function WeekPreview({ classes }: { classes: SchoolClass[] }) {
  // ISO weekday of today, so the day running now is the one that is marked.
  const today = useMemo(() => ((new Date().getDay() + 6) % 7) + 1, []);

  return (
    <div className="desk__column">
      {WEEKDAYS.map((day) => {
        const dayClasses = classes.filter((entry) => entry.weekday === day);
        return (
          <div
            key={day}
            className={`desk__division${day === today ? " desk__division--today" : ""}`}
          >
            <div className="desk__division-head">
              <span className="desk__division-day">{WEEKDAY_LABELS[day]}</span>
              <span className="desk__division-rule" aria-hidden />
            </div>
            {dayClasses.length === 0 ? (
              <p className="desk__division-empty">No classes.</p>
            ) : (
              dayClasses.map((entry) => (
                <p key={entry.id} className="ws-preview-row">
                  <span className="ws-preview-row__time">
                    {formatTimeRange(entry.start_time, entry.duration_minutes)}
                  </span>
                  <span>{entry.title}</span>
                </p>
              ))
            )}
          </div>
        );
      })}
    </div>
  );
}
