import type { ReactNode } from "react";
import { Loader2, CheckCircle2 } from "lucide-react";
import Button from "../../components/ui/Button";
import type { ExtractedEvent, FlyerExtractionStatus } from "./types";
import {
  countPopulatedFields,
  formatExtractedDate,
  formatInstagramHandle,
  formatTimeRange,
  hasPartialExtraction,
} from "./formatters";
import "./FlyerExtractionPanel.css";

type ResultRow = { label: string; content: ReactNode };

function buildResultRows(result: ExtractedEvent): ResultRow[] {
  const rows: ResultRow[] = [];
  if (result.title) rows.push({ label: "Title", content: result.title });
  const dateLabel = formatExtractedDate(result.date);
  if (dateLabel) rows.push({ label: "Date", content: dateLabel });
  const timeLabel = formatTimeRange(result.start_time, result.end_time);
  if (timeLabel) rows.push({ label: "Time", content: timeLabel });
  if (result.venue_name) rows.push({ label: "Venue", content: result.venue_name });
  if (result.address) rows.push({ label: "Address", content: result.address });
  if (result.city) rows.push({ label: "City", content: result.city });
  if (result.dance_styles.length > 0) {
    rows.push({ label: "Dance styles", content: result.dance_styles.join(", ") });
  }
  if (result.event_type) rows.push({ label: "Event type", content: result.event_type });
  if (result.price) rows.push({ label: "Price", content: result.price });
  if (result.organizer_name) rows.push({ label: "Organizer", content: result.organizer_name });
  const instagramLabel = formatInstagramHandle(result.instagram);
  if (instagramLabel) rows.push({ label: "Instagram", content: instagramLabel });
  if (result.website) {
    rows.push({
      label: "Website",
      content: (
        <a href={result.website} target="_blank" rel="noreferrer" aria-label={`Open website ${result.website}`}>
          {result.website}
        </a>
      ),
    });
  }
  if (result.details.length > 0) rows.push({ label: "Details", content: result.details.join(", ") });
  return rows;
}

type FlyerExtractionPanelProps = {
  status: FlyerExtractionStatus;
  result: ExtractedEvent | null;
  error: string | null;
  onRetry: () => void;
  onDismiss: () => void;
};

export default function FlyerExtractionPanel({
  status,
  result,
  error,
  onRetry,
  onDismiss,
}: FlyerExtractionPanelProps) {
  if (status === "loading") {
    return (
      <div
        className="flyer-extraction-panel flyer-extraction-panel--loading"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <Loader2 className="flyer-extraction-panel__spinner" aria-hidden />
        <p className="flyer-extraction-panel__title">Analyzing your flyer…</p>
        <p className="flyer-extraction-panel__hint">
          Looking for event details, date, time, venue, pricing, and dance styles.
        </p>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flyer-extraction-panel flyer-extraction-panel--error error-banner" role="alert">
        <p>{error ?? "We couldn't read this flyer."}</p>
        <div className="flyer-extraction-panel__actions">
          <Button type="button" variant="secondary" onClick={onRetry}>
            Try Again
          </Button>
          <Button type="button" variant="ghost" onClick={onDismiss}>
            Continue manually
          </Button>
        </div>
      </div>
    );
  }

  if (status === "success" && result) {
    const rows = buildResultRows(result);
    const count = countPopulatedFields(result);
    const partial = hasPartialExtraction(result);
    return (
      <div className="flyer-extraction-panel flyer-extraction-panel--success">
        <div className="flyer-extraction-panel__header">
          <p className="flyer-extraction-panel__title">
            <CheckCircle2 size={16} aria-hidden /> Flyer analyzed
          </p>
          {count > 0 && (
            <p className="flyer-extraction-panel__count">
              {count} {count === 1 ? "detail" : "details"} found
            </p>
          )}
        </div>
        {rows.length > 0 ? (
          <dl className="flyer-extraction-panel__fields">
            {rows.map((row) => (
              <div className="flyer-extraction-panel__field" key={row.label}>
                <dt>{row.label}</dt>
                <dd>{row.content}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="flyer-extraction-panel__empty">We couldn't find any details on this flyer.</p>
        )}
        {partial && (
          <p className="flyer-extraction-panel__partial-note">
            Some information wasn't visible on the flyer.
          </p>
        )}
        <div className="flyer-extraction-panel__actions">
          <Button type="button" variant="secondary" onClick={onRetry}>
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return null;
}
