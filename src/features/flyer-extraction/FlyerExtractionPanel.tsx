import { CheckCircle2, AlertTriangle, Loader2, RefreshCw, ScanSearch, Sparkles, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import type { ExtractedEvent } from "./types";
import { formatExtractedDate, formatTimeRange, formatInstagram } from "./formatters";
import type { ReconciledExtraction } from "../entity-matching/types";
import type { ReviewState, ReviewField, ReviewFieldKey, ReviewStatus } from "./review";
import type { FieldConfidence } from "./types";
import "./FlyerExtractionPanel.css";

type FlyerExtractionPanelProps = {
  /** Currently analyzed event, or null when nothing has been analyzed yet. */
  event: ExtractedEvent | null;
  /** Phase 4 reconciliation result, or null before reconciliation runs. */
  reconciliation?: ReconciledExtraction | null;
  /** Phase 5 review state, or null before extraction completes. */
  review?: ReviewState | null;
  /** True while the server-side analysis is in flight. */
  isAnalyzing: boolean;
  /** Human-readable failure message, or null. */
  error: string | null;
  /** Re-run analysis on the current flyer. */
  onAnalyze: () => void;
  /** Phase 3 + 5 hand-off: apply the currently accepted subset of extracted details. */
  onUseTheseDetails: () => void;
};

// ── friendly status labels (no AI jargon) ────────────────────────────────────

function statusLabel(status: ReviewStatus, confidence: FieldConfidence | null): string {
  if (status === "invalid") return "Couldn’t verify";
  if (status === "rejected") return "Not included";
  if (status === "accepted") {
    if (confidence === "high") return null; // quiet
    if (confidence === "medium") return "Review suggested";
    return null; // accepted without a cue
  }
  // review
  if (confidence === "low") return "Check this";
  return "Review suggested";
}

function statusToneClass(status: ReviewStatus): string {
  if (status === "invalid") return "flyer-extraction__status flyer-extraction__status--invalid";
  if (status === "rejected") return "flyer-extraction__status flyer-extraction__status--rejected";
  if (status === "accepted") {
    return "flyer-extraction__status flyer-extraction__status--accepted";
  }
  return "flyer-extraction__status flyer-extraction__status--review";
}

function statusGlyph(st: ReviewStatus): ReactNode {
  if (st === "accepted") return <CheckCircle2 size={16} aria-hidden />;
  if (st === "rejected") return <XCircle size={16} aria-hidden />;
  if (st === "invalid") return <AlertTriangle size={16} aria-hidden />;
  return <AlertTriangle size={16} aria-hidden />;
}

// ── value formatting helpers for review fields ────────────────────────────────

function fmtReviewDate(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function fmtReviewVenue(event: ExtractedEvent): (string | null)[] {
  const lines: string[] = [];
  if (event.venue_name) lines.push(event.venue_name);
  const addr = [event.address, event.city].filter(Boolean).join(", ");
  if (addr) lines.push(addr);
  return lines.length > 0 ? lines : [];
}

// ── single-field row ───────────────────────────────────────────────────────────

interface SingleFieldRowProps {
  field: ReviewField;
  value: string;
  onExclude: () => void;
}

function SingleFieldRow({ field, value, onExclude }: SingleFieldRowProps) {
  const label = statusLabel(field.status, field.confidence);
  const toneClass = statusToneClass(field.status);
  return (
    <div className="flyer-extraction__row">
      <h4 className="flyer-extraction__label">{field.label}</h4>
          {field.status === "rejected" ? (
              <p className="flyer-extraction__value flyer-extraction__value--muted">{value || "—"}</p>
            ) : (
              <p className="flyer-extraction__value">{value || "—"}</p>
            )}
            <div className="flyer-extraction__status-row">
              <span className={toneClass}>
                {statusGlyph(field.status)}
                {label && <span>{label}</span>}
              </span>
              {field.status !== "invalid" && (
                <button
                  type="button"
                  className="flyer-extraction__action"
                  onClick={onExclude}
                >
                  {field.status === "rejected" ? "Include" : "Exclude"}
                </button>
              )}
            </div>
    </div>
  );
}

// ── multi-item field row (dance styles, details) ───────────────────────────────

interface MultiFieldRowProps {
  field: ReviewField;
  items: { value: string; note?: string }[];
  onExclude: () => void;
}

function MultiFieldRow({ field, items, onExclude }: MultiFieldRowProps) {
  const label = statusLabel(field.status, field.confidence);
  const toneClass = statusToneClass(field.status);
  return (
    <div className="flyer-extraction__row">
      <h4 className="flyer-extraction__label">{field.label}</h4>
      <ul className="flyer-extraction__list">
        {items.map((item) => (
          <li key={item.value} className="flyer-extraction__list-item">
            {item.value}
            {item.note && <span className="flyer-extraction__note">{item.note}</span>}
          </li>
        ))}
      </ul>
      <div className="flyer-extraction__status-row">
        <span className={toneClass}>
          {statusGlyph(field.status)}
          {label && <span>{label}</span>}
        </span>
        <button
          type="button"
          className="flyer-extraction__action"
          onClick={onExclude}
          aria-pressed={field.status === "rejected"}
        >
          {field.status === "rejected" ? "Include" : "Exclude"}
        </button>
      </div>
    </div>
  );
}

// ── field row dispatcher ───────────────────────────────────────────────────────

function FieldRow({ field, review, onToggle, onExclude }: {
  field: ReviewField;
  review: ReviewState;
  onToggle: (key: ReviewFieldKey, status: ReviewStatus) => void;
  onExclude: (key: ReviewFieldKey) => void;
}) {
  const toggleTo = (next: ReviewStatus) => onToggle(field.key, next);

  if (field.key === "title") {
    const value = typeof field.value === "string" ? field.value : null;
    if (!value) return null;
    return (
      <SingleFieldRow
        field={field}
        value={value}
        onExclude={() => onExclude(field.key)}
      />
    );
  }

  if (field.key === "date" || field.key === "start_time" || field.key === "end_time" || field.key === "venue_name" || field.key === "address" || field.key === "city" || field.key === "event_type" || field.key === "price" || field.key === "organizer_name" || field.key === "instagram" || field.key === "website") {
    const value = typeof field.value === "string" ? field.value : null;
    if (!value) return null;
    let display: string;
    if (field.key === "date") display = fmtReviewDate(value) ?? value;
    else if (field.key === "start_time" || field.key === "end_time") {
      const m = /^(\d{1,2}):(\d{2})$/.exec(value?.trim());
      if (m) {
        const h = Number(m[1]);
        const min = Number(m[2]);
        const period = h >= 12 ? "PM" : "AM";
        const dh = h % 12 === 0 ? 12 : h % 12;
        display = min === 0 ? `${dh}:00 ${period}` : `${dh}:${m[2]} ${period}`;
      } else {
        display = value;
      }
    } else {
      display = value;
    }
    return (
      <SingleFieldRow
        field={field}
        value={display}
        onExclude={() => onExclude(field.key)}
      />
    );
  }

  if (field.key === "venue_name") {
    const lines = field.value != null ? [field.value] : [];
    const addy = fmtReviewVenue({ venue_name: null, address: null, city: null, instagram: null, details: [], event_type: null, price: null, organizer_name: null, website: null, start_time: null, end_time: null, dance_styles: [], date: null, title: null } as ExtractedEvent);
    // If the extraction included address/city, they're already on another row;
    // venue row shows the venue_name.
    const value = lines.length > 0 ? lines.join("\n") : "";
    if (!value) return null;
    return (
      <SingleFieldRow
        field={field}
        value={value}
        onExclude={() => onExclude(field.key)}
      />
    );
  }

  if (field.key === "dance_styles" || field.key === "details") {
    const arr = Array.isArray(field.value) ? field.value : [];
    if (arr.length === 0) return null;
    return (
      <MultiFieldRow
        field={field}
        items={(field.items ?? arr.map((v) => ({ value: v }))).filter((it) => it.value)}
        onExclude={() => onExclude(field.key)}
      />
    );
  }

  return null;
}

// ── panel ──────────────────────────────────────────────────────────────────────

export default function FlyerExtractionPanel({
  event,
  reconciliation,
  review,
  isAnalyzing,
  error,
  onAnalyze,
  onUseTheseDetails,
}: FlyerExtractionPanelProps) {
  if (isAnalyzing) {
    return (
      <section className="flyer-extraction flyer-extraction--analyzing" aria-live="polite">
        <Loader2 size={28} aria-hidden className="flyer-extraction__spinner" />
        <h3 className="flyer-extraction__title">Analyzing your flyer…</h3>
        <p className="flyer-extraction__sub">
          SalsaSegura is reading the image. We're looking for:
        </p>
        <ul className="flyer-extraction__looking">
          {["Event name", "Date & time", "Venue", "Dance styles", "Pricing", "Organizer"].map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </section>
    );
  }

  if (error) {
    return (
      <section className="flyer-extraction flyer-extraction--error" aria-live="assertive">
        <AlertTriangle size={28} aria-hidden className="flyer-extraction__error-icon" />
        <h3 className="flyer-extraction__title">We couldn't read this flyer</h3>
        <p className="flyer-extraction__sub">{error}</p>
        <div className="flyer-extraction__actions">
          <button type="button" className="btn-secondary" onClick={onAnalyze}>
            <RefreshCw size={16} aria-hidden /> Try Again
          </button>
          <button type="button" className="btn-ghost" onClick={onUseTheseDetails}>
            Continue manually
          </button>
        </div>
        <p className="flyer-extraction__note">Your flyer stays set as the event image.</p>
      </section>
    );
  }

  if (event) {
    const found = (event.title ? 1 : 0)
      + (event.date ? 1 : 0)
      + (event.start_time || event.end_time ? 1 : 0)
      + (event.venue_name ? 1 : 0)
      + (event.address || event.city ? 1 : 0)
      + (event.dance_styles.length > 0 ? 1 : 0)
      + (event.event_type ? 1 : 0)
      + (event.price ? 1 : 0)
      + (event.organizer_name ? 1 : 0)
      + (event.instagram ? 1 : 0)
      + (event.website ? 1 : 0)
      + (event.details.length > 0 ? 1 : 0);

    const rows = review?.fields ?? [];

    const excludedAny = rows.some((f) => f.status === "rejected");

    const showAppliedBanner = review && review.acceptedCount > 0 && !excludedAny;
    const showReviewBanner = review && review.pendingReviewCount > 0;
    const showExcludedBanner = review && rows.some((f) => f.status === "rejected");
    const showNoMatchNote = reconciliation && !rows.some((f) => f.status === "accepted");

    return (
      <section
        className="flyer-extraction flyer-extraction--done"
        aria-live="polite"
        aria-label="Review extracted flyer details"
      >
        <div className="flyer-extraction__header">
          <CheckCircle2 size={20} aria-hidden className="flyer-extraction__ok-icon" />
          <h3 className="flyer-extraction__title">Review extracted details</h3>
          <span className="flyer-extraction__count">
            {found} detail{found === 1 ? "" : "s"} found
            {review && review.pendingReviewCount > 0 ? ` · ${review.pendingReviewCount} need review` : ""}
          </span>
        </div>

        {found === 0 && (
          <p className="flyer-extraction__sub">
            We couldn't find readable event details on this flyer. You can add them manually.
          </p>
        )}

        {showReviewBanner && (
          <div className="flyer-extraction__banner flyer-extraction__banner--review" role="status">
            {review.pendingReviewCount === 1
              ? "1 suggestion needs your review before it’s applied."
              : `${review.pendingReviewCount} suggestions need your review before they’re applied.`}
          </div>
        )}

        {showExcludedBanner && (
          <div className="flyer-extraction__banner flyer-extraction__banner--excluded" role="status">
            {excludedAny && (
              <>
                <span className="flyer-extraction__banner-label">Some suggestions excluded —</span>
                {review.acceptedCount > 0
                  ? `${review.acceptedCount} details will be added`
                  : "No details selected for the form"}
                {review.acceptedCount > 0 && review.totalPresent !== review.acceptedCount && (
                  <> of {review.totalPresent}</>
                )}.
              </>
            )}
          </div>
        )}

        <div className="flyer-extraction__results">
          {review && review.fields.map((field) => (
            <FieldRow
              key={field.key}
              field={field}
              review={review}
              onToggle={() => {}}
              onExclude={() => {}}
            />
          ))}
        </div>

        {reconciliation && (
          <p className="flyer-extraction__match-note" aria-live="polite">
            {reconciliation.venue?.status === "exact" && (
              <span className="flyer-extraction__match flyer-extraction__match--venue">
                Venue matched to an existing SalsaSegura venue.
              </span>
            )}
            {reconciliation.venue?.status === "strong" && (
              <span className="flyer-extraction__match flyer-extraction__match--venue">
                Likely matches an existing SalsaSegura venue.
              </span>
            )}
            {reconciliation.venue?.status === "ambiguous" && (
              <span className="flyer-extraction__match flyer-extraction__match--ambiguous">
                Couldn’t verify which existing venue this refers to.
              </span>
            )}
            {reconciliation.organizer?.status === "strong" && reconciliation.organizer?.name && (
              <span className="flyer-extraction__match flyer-extraction__match--organizer">
                Matched organizer: {reconciliation.organizer.name}
              </span>
            )}
            {reconciliation.dance_styles.some((d) => d.slug) && (
              <span className="flyer-extraction__match flyer-extraction__match--taxonomy">
                Dance styles mapped to the SalsaSegura taxonomy.
              </span>
            )}
            {!reconciliation.venue?.status && !reconciliation.organizer?.status && !reconciliation.dance_styles.some((d) => d.slug) && reconciliation.event_type?.slug === null && (
              <span className="flyer-extraction__match flyer-extraction__match--none">
                No existing SalsaSegura matches found — details stay as written.
              </span>
            )}
          </p>
        )}

        <div className="flyer-extraction__actions">
          <button type="button" className="btn-primary" onClick={onUseTheseDetails}>
            <Sparkles size={16} aria-hidden />
            {excludedAny
              ? `Use accepted details (${review?.acceptedCount ?? 0} of ${review?.totalPresent ?? 0})`
              : "Use These Details"}
          </button>
          <button type="button" className="btn-ghost" onClick={onAnalyze}>
            <ScanSearch size={16} aria-hidden />
            {review && review.pendingReviewCount > 0 ? "Review all suggestions" : "Analyze Again"}
          </button>
        </div>
      </section>
    );
  }

  // ── Empty (nothing has happened yet) ──
  return null;
}
