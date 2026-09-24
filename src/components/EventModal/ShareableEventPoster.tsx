import { useMemo } from "react";
import { create as createQr } from "qrcode";
import type { ScheduleXEvent } from "../../types/events";
import type { PosterFormat } from "./posterFormat";
import SleeveCover from "./SleeveCover";
import "./ShareableEventPoster.css";

interface ShareableEventPosterProps {
  event: ScheduleXEvent;
  /** Cover art. A real flyer is shown whole; fallback art fills the square. */
  imageUrl: string;
  artKind: "flyer" | "fallback";
  /** Short event URL the QR encodes, e.g. https://salsasegura.com/e/1a2b3c4d */
  shortUrl: string;
  /** The same URL as printed: host and path, no scheme. */
  shortLabel: string;
  format?: PosterFormat;
}

const CITY_CODE: Record<string, string> = { boston: "BOS", "new-york-city": "NYC" };

const toDate = (val: unknown): Date => {
  if (typeof val === "string") return new Date(val.replace(" ", "T"));
  if (val && typeof val === "object" && "epochMilliseconds" in val) {
    return new Date(Number(val.epochMilliseconds));
  }
  return new Date(String(val));
};

function QrCode({ value }: { value: string }) {
  const { size, path } = useMemo(() => {
    const { modules } = createQr(value, { errorCorrectionLevel: "M" });
    let d = "";
    for (let row = 0; row < modules.size; row++) {
      for (let col = 0; col < modules.size; col++) {
        if (modules.get(row, col)) d += `M${col + 2} ${row + 2}h1v1h-1z`;
      }
    }
    return { size: modules.size + 4, path: d };
  }, [value]);

  return (
    <svg
      className="sleeve-qr"
      viewBox={`0 0 ${size} ${size}`}
      shapeRendering="crispEdges"
      aria-hidden="true"
    >
      <rect width={size} height={size} fill="currentColor" className="sleeve-qr__ground" />
      <path d={path} className="sleeve-qr__ink" />
    </svg>
  );
}

/**
 * The shared event poster, pressed as a salsa LP sleeve: a label masthead,
 * the square front cover, and a back-cover track list that carries the
 * night's facts. Rendered at export size (Story 1080×1920 or feed 1080×1350)
 * and captured to PNG.
 */
export default function ShareableEventPoster({
  event,
  imageUrl,
  artKind,
  shortUrl,
  shortLabel,
  format = "story",
}: ShareableEventPosterProps) {
  const start = toDate(event.start);
  const end = toDate(event.end);
  const dateLabel = start.toLocaleDateString("en-US", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  const catalogue = `SS-${String(start.getMonth() + 1).padStart(2, "0")}${String(
    start.getDate()
  ).padStart(2, "0")}${event.city ? ` · ${CITY_CODE[event.city] ?? ""}` : ""}`;
  const styles = event.danceStyles?.length ? event.danceStyles.join(" · ") : event.calendarId;

  const tracks = [
    { side: "A1", label: "Date", value: dateLabel },
    {
      side: "A2",
      label: "Time",
      value: [start, end]
        .map((date) => date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }))
        .join(" – "),
    },
    ...(event.location
      ? [{ side: "A3", label: "Venue", value: event.location, note: event.address }]
      : []),
    { side: event.location ? "A4" : "A3", label: "Styles", value: styles },
  ];

  return (
    <div
      className={`shareable-poster sleeve sleeve--${format} sleeve--${event.calendarId}`}
      role="img"
      aria-label={`${format === "story" ? "Instagram Story" : "Feed"} poster for ${event.title}`}
    >
      <header className="sleeve-masthead">
        <span className="sleeve-masthead__label">Salsa Segura</span>
        <span className="sleeve-masthead__catalogue">{catalogue}</span>
      </header>

      <div className="sleeve-front">
        <SleeveCover event={event} imageUrl={imageUrl} artKind={artKind} format={format} />
        {format === "feed" && (
          <div className="sleeve-spine" aria-hidden="true">
            <span>{event.title}</span>
          </div>
        )}
      </div>

      <section className="sleeve-back">
        <div className="sleeve-back__side">
          <p className="sleeve-back__side-label">Side A</p>
          <ol className="sleeve-tracks">
            {tracks.map((track) => (
              <li key={track.side} className="sleeve-track">
                <span className="sleeve-track__no">{track.side}</span>
                <span className="sleeve-track__label">{track.label}</span>
                <span className="sleeve-track__leader" aria-hidden="true" />
                <span className="sleeve-track__value">
                  {track.value}
                  {"note" in track && track.note && format === "story" && (
                    <span className="sleeve-track__note">{track.note}</span>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="sleeve-back__side sleeve-back__side--b">
          <p className="sleeve-back__side-label">Side B</p>
          <div className="sleeve-scan">
            <QrCode value={shortUrl} />
            <div className="sleeve-scan__text">
              <span className="sleeve-scan__cta">Scan for the night</span>
              <span className="sleeve-scan__url">{shortLabel}</span>
              {event.host && <span className="sleeve-scan__credit">Hosted by {event.host}</span>}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
