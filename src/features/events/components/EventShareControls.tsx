import { useState } from "react";
import { ExternalLink, Link as LinkIcon, Share2 } from "lucide-react";
import {
  buildEventPromoCaption,
  buildNativeSharePayload,
  buildPublicEventUrl,
  buildShareDestinations,
} from "../model/eventSharing";
import "./EventShareControls.css";

type EventShareControlsProps = {
  eventId: string;
  title: string;
  dateLabel?: string | null;
  location?: string | null;
  origin?: string;
  compact?: boolean;
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
  eventId,
  title,
  dateLabel,
  location,
  origin,
  compact = false,
}: EventShareControlsProps) {
  const [feedback, setFeedback] = useState<Feedback>(null);
  const publicUrl = buildPublicEventUrl(eventId, origin);
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
      await handleCopy(publicUrl, "Event link copied.", "Could not copy event link.");
      return;
    }

    setFeedback(null);
    try {
      await navigator.share(buildNativeSharePayload(input));
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setFeedback({ kind: "error", message: "Could not share event." });
    }
  };

  return (
    <section className={`event-share-controls${compact ? " event-share-controls--compact" : ""}`}>
      {!compact && <h2>Share and promote</h2>}
      <div className="event-share-controls__actions">
        <button type="button" className="admin-btn admin-btn--secondary" onClick={handleShare}>
          <Share2 size={15} aria-hidden="true" />
          Share event
        </button>
        <button
          type="button"
          className="admin-btn admin-btn--secondary"
          onClick={() => handleCopy(publicUrl, "Event link copied.", "Could not copy event link.")}
        >
          <LinkIcon size={15} aria-hidden="true" />
          Copy event link
        </button>
        {!compact && (
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
