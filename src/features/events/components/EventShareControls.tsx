import { useState } from "react";
import { ExternalLink, Link as LinkIcon, Share2 } from "lucide-react";
import {
  buildEventPromoCaption,
  buildNativeSharePayload,
  buildShareDestinations,
} from "../model/eventSharing";
import "./EventShareControls.css";

type EventShareControlsProps = {
  /** The public page being shared, e.g. `buildPublicEventUrl(id)`. */
  url: string;
  title: string;
  dateLabel?: string | null;
  location?: string | null;
  compact?: boolean;
  /** "week" relabels the actions for an itinerary and drops the event promo caption. */
  subject?: "event" | "week";
};

const LABELS = {
  event: {
    share: "Share event",
    copy: "Copy event link",
    copied: "Event link copied.",
    copyFailed: "Could not copy event link.",
    shareFailed: "Could not share event.",
  },
  week: {
    share: "Share this week",
    copy: "Copy week link",
    copied: "Week link copied.",
    copyFailed: "Could not copy week link.",
    shareFailed: "Could not share this week.",
  },
};

type Feedback = { kind: "status" | "error"; message: string } | null;

async function copyText(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) throw new Error("Clipboard unavailable");
}

export default function EventShareControls({
  url: publicUrl,
  title,
  dateLabel,
  location,
  compact = false,
  subject = "event",
}: EventShareControlsProps) {
  const labels = LABELS[subject];
  const [feedback, setFeedback] = useState<Feedback>(null);
  const input = { title, dateLabel, location, publicUrl };
  const destinations = buildShareDestinations(input);
  const nativeShareAvailable =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  const handleCopy = async (value: string, successMessage: string, failureMessage: string) => {
    setFeedback(null);
    try {
      await copyText(value);
      setFeedback({ kind: "status", message: successMessage });
    } catch {
      setFeedback({ kind: "error", message: failureMessage });
    }
  };

  const handleShare = async () => {
    if (!nativeShareAvailable) {
      await handleCopy(publicUrl, labels.copied, labels.copyFailed);
      return;
    }

    setFeedback(null);
    try {
      await navigator.share(buildNativeSharePayload(input));
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setFeedback({ kind: "error", message: labels.shareFailed });
    }
  };

  return (
    <section className={`event-share-controls${compact ? " event-share-controls--compact" : ""}`}>
      {!compact && <h2>Share and promote</h2>}
      <div className="event-share-controls__actions">
        <button type="button" className="admin-btn admin-btn--secondary" onClick={handleShare}>
          <Share2 size={15} aria-hidden="true" />
          {labels.share}
        </button>
        <button
          type="button"
          className="admin-btn admin-btn--secondary"
          onClick={() => handleCopy(publicUrl, labels.copied, labels.copyFailed)}
        >
          <LinkIcon size={15} aria-hidden="true" />
          {labels.copy}
        </button>
        {!compact && subject === "event" && (
          <button
            type="button"
            className="admin-btn admin-btn--ghost"
            onClick={() =>
              handleCopy(
                buildEventPromoCaption(input),
                "Promotional text copied.",
                "Could not copy promotional text."
              )
            }
          >
            Copy promotional text
          </button>
        )}
      </div>

      {!compact && (
        <div className="event-share-controls__destinations" aria-label="Share destinations">
          <a href={destinations.whatsApp} target="_blank" rel="noopener noreferrer">
            Share on WhatsApp <ExternalLink size={12} aria-hidden="true" />
          </a>
          <a href={destinations.email}>Share by email</a>
          <a href={destinations.facebook} target="_blank" rel="noopener noreferrer">
            Share on Facebook <ExternalLink size={12} aria-hidden="true" />
          </a>
        </div>
      )}

      {feedback && (
        <p
          role={feedback.kind === "error" ? "alert" : "status"}
          className="event-share-controls__feedback"
        >
          {feedback.message}
        </p>
      )}
    </section>
  );
}
