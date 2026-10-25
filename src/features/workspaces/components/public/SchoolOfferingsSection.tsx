import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { fetchPublicSchoolOfferings } from "../../api/workspacesRepo";
import {
  CLASS_LEVEL_LABELS,
  WEEKDAY_LABELS,
  PLAN_TYPE_LABELS,
  type Weekday,
  formatCents,
  formatClock,
} from "../../model";
import "./SchoolOfferingsSection.css";

const WEEKDAYS: readonly Weekday[] = [1, 2, 3, 4, 5, 6, 7];

function calculateEndTime(startTime: string, durationMinutes: number): string {
  const [hours = 0, minutes = 0] = startTime.split(":").map(Number);
  const totalMinutes = (hours * 60 + minutes + durationMinutes) % (24 * 60);
  const endHours = Math.floor(totalMinutes / 60);
  const endMinutes = totalMinutes % 60;
  return `${String(endHours).padStart(2, "0")}:${String(endMinutes).padStart(2, "0")}`;
}

function formatClassTimeRange(startTime: string, durationMinutes: number): string {
  const endTime = calculateEndTime(startTime, durationMinutes);
  return `${formatClock(startTime)} – ${formatClock(endTime)}`;
}

function formatPlanTerms(classCount: number | null, validDays: number | null): string | null {
  const parts: string[] = [];
  if (classCount != null) {
    parts.push(`${classCount} ${classCount === 1 ? "class" : "classes"}`);
  }
  if (validDays != null) {
    parts.push(`valid ${validDays} days`);
  }
  return parts.length > 0 ? parts.join(" · ") : null;
}

export function SchoolOfferingsSection({ slug }: { slug: string }) {
  const { data, isPending, isError, refetch } = useQuery({
    queryKey: ["public-school-offerings", slug],
    queryFn: () => fetchPublicSchoolOfferings(slug),
    enabled: Boolean(slug),
  });

  if (isPending) {
    return (
      <section className="school-offerings school-offerings--loading" role="status" aria-label="Loading school offerings…">
        <div className="school-offerings__skeleton-header" />
        <div className="school-offerings__skeleton-block">
          <div className="school-offerings__skeleton-line" />
          <div className="school-offerings__skeleton-line" />
          <div className="school-offerings__skeleton-line" />
        </div>
      </section>
    );
  }

  if (isError) {
    return (
      <section className="school-offerings school-offerings--error" role="alert" aria-label="School offerings error">
        <p className="school-offerings__error-message">Unable to load school offerings at this time.</p>
        <button
          type="button"
          className="ui-button ui-button--secondary school-offerings__retry-button"
          onClick={() => void refetch()}
        >
          Try again
        </button>
      </section>
    );
  }

  if (!data) return null;

  const { classes = [], privates = [], plans = [] } = data;
  const isEmpty = classes.length === 0 && privates.length === 0 && plans.length === 0;

  if (isEmpty) return null;

  // Filter and group classes by weekday (Mon=1 -> Sun=7), only days with classes
  const classesByWeekday = WEEKDAYS.map((weekday) => {
    const dayClasses = classes
      .filter((c) => c.weekday === weekday)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
    return { weekday, label: WEEKDAY_LABELS[weekday], classes: dayClasses };
  }).filter((group) => group.classes.length > 0);

  return (
    <section className="school-offerings" aria-label="School offerings">
      {classesByWeekday.length > 0 && (
        <section className="school-offerings__section school-offerings__timetable" aria-labelledby="school-timetable-heading">
          <h2 id="school-timetable-heading">Weekly classes</h2>
          <div className="school-offerings__days-grid">
            {classesByWeekday.map((group) => (
              <div key={group.weekday} className="school-offerings__day-group">
                <h3 className="school-offerings__day-heading">{group.label}</h3>
                <ul className="school-offerings__class-list">
                  {group.classes.map((cls) => (
                    <li key={cls.id} className="school-offerings__class-item">
                      <div className="school-offerings__class-header">
                        <time className="school-offerings__class-time" dateTime={cls.start_time}>
                          {formatClassTimeRange(cls.start_time, cls.duration_minutes)}
                        </time>
                        {cls.drop_in_cents != null && (
                          <span className="school-offerings__class-price">{formatCents(cls.drop_in_cents)}</span>
                        )}
                      </div>
                      <h4 className="school-offerings__class-title">{cls.title}</h4>
                      <div className="school-offerings__class-meta">
                        {cls.style_name && (
                          <span className="school-offerings__pill school-offerings__pill--style">
                            {cls.style_name}
                          </span>
                        )}
                        <span className="school-offerings__pill school-offerings__pill--level">
                          {CLASS_LEVEL_LABELS[cls.level]}
                        </span>
                        {cls.room && (
                          <span className="school-offerings__class-room">{cls.room}</span>
                        )}
                      </div>
                      {cls.instructor_slug ? (
                        <p className="school-offerings__instructor">
                          Instructor:{" "}
                          <Link to={`/i/${cls.instructor_slug}`} className="school-offerings__instructor-link">
                            {cls.instructor_name ?? "Instructor"}
                          </Link>
                        </p>
                      ) : cls.instructor_name ? (
                        <p className="school-offerings__instructor">
                          Instructor: <span>{cls.instructor_name}</span>
                        </p>
                      ) : null}
                      {cls.notes && (
                        <p className="school-offerings__class-notes">{cls.notes}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="school-offerings__timetable-note">
            Classes repeat weekly. Please confirm schedule and room changes directly with the school.
          </p>
        </section>
      )}

      {privates.length > 0 && (
        <section className="school-offerings__section school-offerings__privates" aria-labelledby="school-privates-heading">
          <h2 id="school-privates-heading">Private lessons</h2>
          <ul className="school-offerings__privates-list">
            {privates.map((priv) => (
              <li key={priv.id} className="school-offerings__private-item">
                <div className="school-offerings__private-main">
                  <h3 className="school-offerings__private-title">{priv.title}</h3>
                  <div className="school-offerings__private-meta">
                    <span className="school-offerings__private-duration">{priv.duration_minutes} min</span>
                    {priv.instructor_slug ? (
                      <span className="school-offerings__instructor">
                        with{" "}
                        <Link to={`/i/${priv.instructor_slug}`} className="school-offerings__instructor-link">
                          {priv.instructor_name ?? "Instructor"}
                        </Link>
                      </span>
                    ) : priv.instructor_name ? (
                      <span className="school-offerings__instructor">with {priv.instructor_name}</span>
                    ) : null}
                  </div>
                  {priv.notes && (
                    <p className="school-offerings__private-notes">{priv.notes}</p>
                  )}
                </div>
                <span className="school-offerings__price school-offerings__private-price">
                  {formatCents(priv.price_cents)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {plans.length > 0 && (
        <section className="school-offerings__section school-offerings__plans" aria-labelledby="school-plans-heading">
          <h2 id="school-plans-heading">Prices</h2>
          <ul className="school-offerings__plans-list">
            {plans.map((plan) => {
              const terms = formatPlanTerms(plan.class_count, plan.valid_days);
              return (
                <li key={plan.id} className="school-offerings__plan-item">
                  <div className="school-offerings__plan-main">
                    <div className="school-offerings__plan-header">
                      <h3 className="school-offerings__plan-name">{plan.name}</h3>
                      <span className="school-offerings__pill school-offerings__pill--plan">
                        {PLAN_TYPE_LABELS[plan.plan_type]}
                      </span>
                    </div>
                    {terms && <p className="school-offerings__plan-terms">{terms}</p>}
                    {plan.notes && <p className="school-offerings__plan-notes">{plan.notes}</p>}
                  </div>
                  <span className="school-offerings__price school-offerings__plan-price">
                    {formatCents(plan.price_cents)}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </section>
  );
}
