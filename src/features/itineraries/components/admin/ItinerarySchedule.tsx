import "temporal-polyfill/global";
import { useId } from "react";
import { ArrowDown, ArrowUp, CircleAlert, Star, Trash2 } from "lucide-react";
import { databaseEventToScheduleX } from "../../../events/model/convert";
import { neighborhoodLabel } from "../../../metros/model/neighborhood";
import type { ItineraryWarning, Schedule, ScheduledEntry, ScheduleNight } from "../../model/schedule";
import type { IsoWeekday, ItineraryItem } from "../../model/types";

interface ScheduleActions {
  onToggleFeatured: (eventId: string) => void;
  onMove: (eventId: string, offset: -1 | 1) => void;
  onNote: (eventId: string, note: string) => void;
  onRemove: (eventId: string) => void;
}

interface ItineraryScheduleProps extends ScheduleActions {
  schedule: Schedule;
  warnings: ItineraryWarning[];
  loading: boolean;
  onUnfeatured: (weekday: IsoWeekday, on: boolean) => void;
}

const itemAnchor = (eventId: string) => `itinerary-item-${eventId}`;
const nightAnchor = (date: string) => `itinerary-night-${date}`;

function nightLabel(date: string): string {
  return Temporal.PlainDate.from(date).toLocaleString("en-US", { weekday: "long", month: "short", day: "numeric" });
}

function Warnings({ warnings }: { warnings: ItineraryWarning[] }) {
  if (warnings.length === 0) return null;
  return (
    <ul className="itinerary-schedule__warnings">
      {warnings.map((warning) => (
        <li key={warning.code} data-blocking={warning.blocking || undefined}>
          <CircleAlert size={14} aria-hidden="true" />
          {warning.message}
          {warning.blocking && <span className="itinerary-schedule__blocks"> · Blocks publishing</span>}
        </li>
      ))}
    </ul>
  );
}

function NoteField({ item, title, onNote }: { item: ItineraryItem; title: string; onNote: ScheduleActions["onNote"] }) {
  const id = useId();
  return (
    <div className="admin-field itinerary-schedule__note">
      <label htmlFor={id}>
        Note<span className="admin-visually-hidden"> for {title}</span>
      </label>
      <input
        id={id}
        aria-label={`Note for ${title}`}
        className="admin-input"
        value={item.note ?? ""}
        maxLength={280}
        onChange={(event) => onNote(item.eventId, event.target.value)}
      />
    </div>
  );
}

function RemoveButton({ eventId, title, onRemove }: { eventId: string; title: string; onRemove: ScheduleActions["onRemove"] }) {
  return (
    <button type="button" className="admin-btn admin-btn--ghost admin-btn--sm" aria-label={`Remove ${title}`} onClick={() => onRemove(eventId)}>
      <Trash2 size={14} aria-hidden="true" />
      Remove<span className="admin-visually-hidden"> {title}</span>
    </button>
  );
}

function EntryRow({
  entry,
  rank,
  warnings,
  inWeek,
  actions,
}: {
  entry: ScheduledEntry;
  /** 1-based rank among the night's alternatives, or null for the featured pick. */
  rank: { at: number; of: number } | null;
  warnings: ItineraryWarning[];
  inWeek: boolean;
  actions: ScheduleActions;
}) {
  const titleId = useId();
  const { event, item } = entry;
  const featured = item.role === "featured";
  const place = [event.location?.trim(), neighborhoodLabel(event.neighborhood)].filter(Boolean).join(" · ");
  const styles = databaseEventToScheduleX(event).danceStyles ?? [];
  const price =
    event.price_type === "free" ? "Free" : event.price_type === "paid" && event.price_amount != null ? `$${event.price_amount}` : null;
  const flyer = event.image_url ?? event.image_urls?.[0] ?? null;

  return (
    <li id={itemAnchor(event.id)} className="itinerary-schedule__row" aria-labelledby={titleId}>
      <div className="itinerary-schedule__thumb">{flyer && <img src={flyer} alt="" loading="lazy" />}</div>
      <div className="itinerary-schedule__body">
        <p className="itinerary-schedule__meta">
          <span className="itinerary-schedule__time">{entry.startLabel}</span>
          <span>{featured ? "Featured" : rank ? `Alternative ${rank.at} of ${rank.of}` : "Alternative"}</span>
          {price && <span>{price}</span>}
        </p>
        <p id={titleId} className="itinerary-schedule__title">
          {event.title}
        </p>
        {place && <p className="itinerary-editor__muted">{place}</p>}
        {styles.length > 0 && (
          <ul className="itinerary-schedule__styles" aria-label="Dance styles">
            {styles.map((style) => (
              <li key={style} className="admin-chip">
                {style}
              </li>
            ))}
          </ul>
        )}
        <Warnings warnings={warnings} />
        <NoteField item={item} title={event.title} onNote={actions.onNote} />
      </div>
      <div className="itinerary-schedule__controls">
        {inWeek && (
          <>
            <button
              type="button"
              className="admin-btn admin-btn--secondary admin-btn--sm"
              aria-pressed={featured}
              aria-label={`Featured ${event.title}`}
              onClick={() => actions.onToggleFeatured(event.id)}
            >
              <Star size={14} aria-hidden="true" fill={featured ? "currentColor" : "none"} />
              Featured<span className="admin-visually-hidden"> {event.title}</span>
            </button>
            {rank && (
              <>
                <button
                  type="button"
                  className="admin-btn admin-btn--ghost admin-btn--sm"
                  disabled={rank.at === 1}
                  onClick={() => actions.onMove(event.id, -1)}
                >
                  <ArrowUp size={14} aria-hidden="true" />
                  Move up<span className="admin-visually-hidden"> {event.title}</span>
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn--ghost admin-btn--sm"
                  disabled={rank.at === rank.of}
                  onClick={() => actions.onMove(event.id, 1)}
                >
                  <ArrowDown size={14} aria-hidden="true" />
                  Move down<span className="admin-visually-hidden"> {event.title}</span>
                </button>
              </>
            )}
          </>
        )}
        <RemoveButton eventId={event.id} title={event.title} onRemove={actions.onRemove} />
      </div>
    </li>
  );
}

function Night({
  night,
  warnings,
  actions,
  onUnfeatured,
}: {
  night: ScheduleNight;
  warnings: ItineraryWarning[];
  actions: ScheduleActions;
  onUnfeatured: ItineraryScheduleProps["onUnfeatured"];
}) {
  const headingId = useId();
  const checkboxId = useId();
  const nightWarnings = warnings.filter((warning) => warning.eventId === null && warning.night === night.date);

  return (
    <section id={nightAnchor(night.date)} className="itinerary-schedule__night" aria-labelledby={headingId}>
      <div className="itinerary-schedule__night-head">
        <h3 id={headingId}>{nightLabel(night.date)}</h3>
        <label className="itinerary-schedule__unfeatured" htmlFor={checkboxId}>
          <input
            id={checkboxId}
            type="checkbox"
            checked={night.unfeatured}
            onChange={(event) => onUnfeatured(night.weekday, event.target.checked)}
          />
          No featured pick this day
        </label>
      </div>
      <Warnings warnings={nightWarnings} />
      {night.entries.length === 0 ? (
        <p className="itinerary-editor__muted">No events picked.</p>
      ) : (
        <ol className="itinerary-schedule__rows">
          {night.entries.map((entry) => {
            const at = night.alternatives.indexOf(entry);
            return (
              <EntryRow
                key={entry.event.id}
                entry={entry}
                rank={at === -1 ? null : { at: at + 1, of: night.alternatives.length }}
                warnings={warnings.filter((warning) => warning.eventId === entry.event.id)}
                inWeek
                actions={actions}
              />
            );
          })}
        </ol>
      )}
    </section>
  );
}

/** Every warning once, linking to the row or night it belongs to. Blocking ones first. */
export function ItineraryWarningSummary({ schedule, warnings }: { schedule: Schedule; warnings: ItineraryWarning[] }) {
  const headingId = useId();
  if (warnings.length === 0) return null;
  const titles = new Map(
    [...schedule.nights.flatMap((night) => night.entries), ...schedule.outside].map((entry) => [entry.event.id, entry.event.title])
  );
  const blocking = warnings.filter((warning) => warning.blocking).length;
  const ordered = [...warnings].sort((a, b) => Number(b.blocking) - Number(a.blocking));

  return (
    <section
      className={`admin-card itinerary-warnings${blocking ? " itinerary-warnings--blocking" : ""}`}
      aria-labelledby={headingId}
    >
      <h2 id={headingId}>Warnings</h2>
      <p className="itinerary-editor__muted">
        {blocking > 0
          ? `${blocking} ${blocking === 1 ? "problem blocks" : "problems block"} publishing.`
          : "Nothing blocks publishing."}
      </p>
      <ul>
        {ordered.map((warning, index) => {
          const subject = warning.eventId
            ? (titles.get(warning.eventId) ?? "Unavailable event")
            : nightLabel(warning.night ?? "");
          const href = `#${warning.eventId ? itemAnchor(warning.eventId) : nightAnchor(warning.night ?? "")}`;
          return (
            <li key={`${warning.code}-${warning.eventId ?? warning.night}-${index}`} data-blocking={warning.blocking || undefined}>
              <a href={href}>
                {subject} — {warning.message}
              </a>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Seven nights, Monday first, each listed chronologically. */
export default function ItinerarySchedule({ schedule, warnings, loading, onUnfeatured, ...actions }: ItineraryScheduleProps) {
  const headingId = useId();
  const forEvent = (eventId: string) => warnings.filter((warning) => warning.eventId === eventId);

  return (
    <section className="admin-card itinerary-editor__section" aria-labelledby={headingId}>
      <h2 id={headingId}>Schedule</h2>
      {loading ? (
        <p className="itinerary-editor__empty" role="status">
          Loading the picked events…
        </p>
      ) : (
        <>
          {(schedule.missing.length > 0 || schedule.outside.length > 0) && (
            <div className="itinerary-schedule__stray">
              <h3>Needs attention</h3>
              <ol className="itinerary-schedule__rows">
                {schedule.missing.map((item) => (
                  <li
                    key={item.eventId}
                    id={itemAnchor(item.eventId)}
                    className="itinerary-schedule__row"
                    aria-label="Unavailable event"
                  >
                    <div className="itinerary-schedule__thumb" />
                    <div className="itinerary-schedule__body">
                      <p className="itinerary-schedule__meta">
                        <span>{item.role === "featured" ? "Featured" : "Alternative"}</span>
                      </p>
                      <p className="itinerary-schedule__title">Unavailable event</p>
                      <p className="itinerary-schedule__id">{item.eventId}</p>
                      {item.note && <p className="itinerary-editor__muted">Note: {item.note}</p>}
                      <Warnings warnings={forEvent(item.eventId)} />
                    </div>
                    <div className="itinerary-schedule__controls">
                      <RemoveButton eventId={item.eventId} title="unavailable event" onRemove={actions.onRemove} />
                    </div>
                  </li>
                ))}
                {schedule.outside.map((entry) => (
                  <EntryRow
                    key={entry.event.id}
                    entry={entry}
                    rank={null}
                    warnings={forEvent(entry.event.id)}
                    inWeek={false}
                    actions={actions}
                  />
                ))}
              </ol>
            </div>
          )}
          {schedule.nights.map((night) => (
            <Night key={night.date} night={night} warnings={warnings} actions={actions} onUnfeatured={onUnfeatured} />
          ))}
        </>
      )}
    </section>
  );
}
