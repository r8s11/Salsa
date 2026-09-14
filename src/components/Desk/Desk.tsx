import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { CircleCheck, ImageOff } from "lucide-react";
import MarginMark from "./MarginMark";
import type { DeskCount, DeskListing } from "./deskModel";
import "./desk.css";

/* ── The measured week ────────────────────────────────────
   Seven divisions from today. A day with nothing set still
   occupies its division, so a thin week looks thin instead
   of collapsing into a tidy short list. */
export const DESK_DIVISIONS = 7;

export function Desk({ children }: { children: ReactNode }) {
  return <div className="desk">{children}</div>;
}

/* ── Standing rule ──────────────────────────────────────── */

export function DeskRule({
  date,
  dateline,
  counts,
  actions,
}: {
  date: string;
  dateline: string;
  counts: DeskCount[];
  actions?: ReactNode;
}) {
  return (
    <div className="desk__rule">
      <div>
        <h1 className="desk__date">{date}</h1>
        <span className="desk__dateline">{dateline}</span>
      </div>

      <ul className="desk__counts">
        {counts.map((count) => {
          const body = (
            <>
              <span className="desk__count-figure" data-settled={count.settled || undefined}>
                {count.value}
              </span>
              {count.label}
            </>
          );
          const className = `desk__count${count.work ? " desk__count--work" : ""}`;
          return (
            <li key={count.id}>
              {count.to ? (
                <Link to={count.to} className={className}>
                  {body}
                </Link>
              ) : (
                <span className={className}>{body}</span>
              )}
            </li>
          );
        })}
      </ul>

      {actions}
    </div>
  );
}

/* ── Measures ───────────────────────────────────────────── */

export function DeskMeasures({ children }: { children: ReactNode }) {
  return <div className="desk__measures">{children}</div>;
}

export function DeskMeasure({
  title,
  note,
  link,
  children,
}: {
  title: string;
  note?: string;
  link?: { to: string; label: string };
  children: ReactNode;
}) {
  const headingId = `desk-measure-${title.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <section className="desk__measure" aria-labelledby={headingId}>
      <div className="desk__measure-head">
        <h2 id={headingId} className="desk__measure-title">
          {title}
        </h2>
        {note && <span className="desk__measure-note">{note}</span>}
        {link && (
          <Link className="desk__measure-link" to={link.to}>
            {link.label}
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}

/* ── Listing row ────────────────────────────────────────── */

export function DeskEntry({
  listing,
  showThumb = false,
  open = false,
  leaving,
  arriving,
  /**
   * Inside the column the division head already states the day, so the
   * entry states its time. Everywhere else the entry carries the date.
   */
  stamp = "date",
  onOpen,
  children,
}: {
  listing: DeskListing;
  showThumb?: boolean;
  open?: boolean;
  leaving?: "set" | "killed";
  arriving?: boolean;
  stamp?: "date" | "time";
  onOpen?: () => void;
  children?: ReactNode;
}) {
  const when = stamp === "time" ? formatEntryTime(listing.date) : formatEntryDate(listing.date);

  return (
    <li
      className={`desk__entry${showThumb ? " desk__entry--withthumb" : ""}${open ? " desk__entry--open" : ""}`}
      data-leaving={leaving}
      data-arriving={arriving || undefined}
    >
      <span className="desk__entry-mark">
        <MarginMark state={listing.state} labelled />
      </span>

      {showThumb &&
        (listing.flyerUrl ? (
          <img className="desk__entry-thumb" src={listing.flyerUrl} alt="" loading="lazy" />
        ) : (
          <span className="desk__entry-thumb desk__entry-thumb--empty" aria-hidden>
            <ImageOff size={16} />
          </span>
        ))}

      <div className="desk__entry-body">
        <h3 className="desk__entry-title">
          {onOpen ? (
            <button
              type="button"
              className="desk__entry-open"
              onClick={onOpen}
              aria-expanded={open}
            >
              {listing.title}
            </button>
          ) : listing.to ? (
            <Link to={listing.to}>{listing.title}</Link>
          ) : (
            listing.title
          )}
        </h3>

        {/* A missing venue is stated once, by its flag, not twice. */}
        <p className="desk__entry-meta">
          <b>{when}</b>
          {listing.venue && (
            <>
              <span className="desk__entry-sep" aria-hidden>
                ·
              </span>
              {listing.venue}
            </>
          )}
        </p>

        {listing.flags && listing.flags.length > 0 && (
          <p className="desk__entry-flags">{listing.flags.join(" · ")}</p>
        )}

        {children}
      </div>
    </li>
  );
}

/* ── The set column ─────────────────────────────────────── */

export function DeskColumn({
  listings,
  now,
  arrivingId,
}: {
  listings: DeskListing[];
  now: Date;
  arrivingId?: string | null;
}) {
  const divisions = buildDivisions(listings, now);

  return (
    <div className="desk__column">
      {divisions.map((division) => (
        <div
          key={division.dateLabel}
          className={`desk__division${division.isToday ? " desk__division--today" : ""}`}
        >
          <div className="desk__division-head">
            <span className="desk__division-day">{division.day}</span>
            <span className="desk__division-date">{division.dateLabel}</span>
            <span className="desk__division-rule" aria-hidden />
          </div>

          {division.listings.length === 0 ? (
            <p className="desk__division-empty">Nothing set.</p>
          ) : (
            <ul className="desk__list">
              {division.listings.map((listing) => (
                <DeskEntry
                  key={listing.id}
                  listing={listing}
                  stamp="time"
                  arriving={arrivingId === listing.id}
                />
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}

interface Division {
  day: string;
  dateLabel: string;
  isToday: boolean;
  listings: DeskListing[];
}

const MS_PER_DAY = 86_400_000;

function buildDivisions(listings: DeskListing[], now: Date): Division[] {
  const start = startOfDay(now);

  const divisions: Division[] = Array.from({ length: DESK_DIVISIONS }, (_, offset) => {
    const day = new Date(start);
    day.setDate(start.getDate() + offset);
    return {
      day: offset === 0 ? "Tonight" : day.toLocaleDateString("en-US", { weekday: "long" }),
      dateLabel: day.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      isToday: offset === 0,
      listings: [],
    };
  });

  for (const listing of listings) {
    if (!listing.date) continue;
    const parsed = new Date(listing.date);
    if (Number.isNaN(parsed.getTime())) continue;
    // Whole days between midnights, so a 23:30 event lands on its own
    // night rather than being rounded into the next division.
    const offset = Math.round((startOfDay(parsed).getTime() - start.getTime()) / MS_PER_DAY);
    if (offset < 0 || offset >= DESK_DIVISIONS) continue;
    divisions[offset].listings.push(listing);
  }

  for (const division of divisions) {
    division.listings.sort((a, b) => Date.parse(a.date ?? "") - Date.parse(b.date ?? ""));
  }

  return divisions;
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function formatEntryDate(iso: string | null): string {
  if (!iso) return "Date not set";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "Date not set";
  return parsed.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** Column entries state the time; the division head owns the day. */
function formatEntryTime(iso: string | null): string {
  if (!iso) return "Time not set";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "Time not set";
  return parsed.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

/* ── States ─────────────────────────────────────────────── */

export function DeskEmpty({ children }: { children: ReactNode }) {
  return (
    <p className="desk__empty">
      <CircleCheck size={18} className="desk__empty-figure" aria-hidden />
      {children}
    </p>
  );
}

export function DeskSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }, (_, index) => (
        <span key={index} className="desk__skeleton" />
      ))}
    </div>
  );
}

export function DeskError({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="desk__error" role="alert">
      <span>{message}</span>
      {onRetry && (
        <button type="button" className="desk__action" onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}
