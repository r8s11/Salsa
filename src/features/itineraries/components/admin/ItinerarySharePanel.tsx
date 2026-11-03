import { useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Download, Link2, Share2 } from "lucide-react";
import { useShareablePoster } from "../../../calendar/hooks/useShareablePoster";
import { sharePosterFile } from "../../../events/model/sharePosterFile";
import { loadItineraryPoster, type ItineraryPosterInputs } from "../../hooks/usePublishItinerary";
import { buildItineraryPosterModel, ITINERARY_POSTER_SIZE } from "../../model/itineraryPoster";
import { buildPublicItineraryUrl, itineraryPosterFilename } from "../../model/itinerarySharing";
import ShareableItineraryPoster from "../poster/ShareableItineraryPoster";

type SharedFormat = "story" | "feed";
type Feedback = { kind: "status" | "error"; message: string };

/**
 * Shows an export-size poster scaled to the width it is given (as the event
 * modal's PosterStage does), so the preview is the real artwork.
 */
function PosterStage({ format, children }: { format: SharedFormat; children: ReactNode }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const size = ITINERARY_POSTER_SIZE[format];

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    setWidth(stage.clientWidth);
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(stage);
    return () => observer.disconnect();
  }, [format]);

  const scale = width / size.width;
  return (
    <div ref={stageRef} className={`itinerary-share__stage itinerary-share__stage--${format}`} style={{ height: size.height * scale }}>
      <div
        className="itinerary-share__canvas"
        style={{ width: size.width, height: size.height, transform: `scale(${scale})` }}
      >
        {children}
      </div>
    </div>
  );
}

/** Story and feed posters for the week. Drafts can download; only a published week has a link to share. */
export default function ItinerarySharePanel({ inputs, published }: { inputs: ItineraryPosterInputs; published: boolean }) {
  const headingId = useId();
  const { capturePosterElement, downloadBlob } = useShareablePoster();
  const [format, setFormat] = useState<SharedFormat>("story");
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [fallback, setFallback] = useState<{ blob: Blob; filename: string } | null>(null);

  const { city, weekStart, title } = inputs.itinerary;
  const url = buildPublicItineraryUrl(city, weekStart);
  const filename = itineraryPosterFilename(city, weekStart, format);
  // The on-screen preview can load flyers directly; captures inline them as data URLs.
  const model = useMemo(() => {
    const flyers = new Map(
      inputs.nights.flatMap((night) =>
        night.featured ? [[night.featured.event.id, night.featured.event.image_url ?? night.featured.event.image_urls?.[0] ?? null] as const] : []
      )
    );
    return buildItineraryPosterModel({ ...inputs, flyers, format });
  }, [inputs, format]);

  const createPoster = () => capturePosterElement(() => loadItineraryPoster(inputs, format));

  const run = async (action: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setFeedback(null);
    setFallback(null);
    try {
      await action();
    } catch {
      setFeedback({ kind: "error", message: "Could not create the poster. Please try again." });
    } finally {
      setBusy(false);
    }
  };

  const download = () =>
    run(async () => {
      downloadBlob(await createPoster(), filename);
      setFeedback({ kind: "status", message: "Poster saved to your downloads." });
    });

  const share = () =>
    run(async () => {
      const blob = await createPoster();
      const outcome = await sharePosterFile({ blob, filename, title, url });
      if (outcome === "needs_fresh_tap") {
        setFallback({ blob, filename });
        setFeedback({ kind: "error", message: "Sharing needs a fresh tap. Download the poster instead." });
      } else if (outcome === "failed") {
        setFeedback({ kind: "error", message: "Sending the poster failed. Please try again." });
      } else if (outcome === "unsupported") {
        downloadBlob(blob, filename);
        setFeedback({ kind: "status", message: "Sharing isn't available here, so the poster was downloaded instead." });
      }
    });

  const downloadFallback = () => {
    if (!fallback) return;
    try {
      downloadBlob(fallback.blob, fallback.filename);
      setFallback(null);
      setFeedback({ kind: "status", message: "Poster saved to your downloads." });
    } catch {
      setFeedback({ kind: "error", message: "Could not download the poster. Please try again." });
    }
  };

  const copyLink = async () => {
    setFeedback(null);
    try {
      await navigator.clipboard.writeText(url);
      setFeedback({ kind: "status", message: "Link copied." });
    } catch {
      setFeedback({ kind: "error", message: "Couldn't copy the link. Copy it from the address above." });
    }
  };

  return (
    <section className="admin-card itinerary-share" aria-labelledby={headingId}>
      <h2 id={headingId}>Share posters</h2>

      <div className="itinerary-share__formats" role="group" aria-label="Poster format">
        {(["story", "feed"] as const).map((option) => (
          <button
            key={option}
            type="button"
            className="itinerary-share__format"
            aria-pressed={format === option}
            onClick={() => setFormat(option)}
          >
            {option === "story" ? "Story · 9:16" : "Feed · 4:5"}
          </button>
        ))}
      </div>

      <PosterStage format={format}>
        <ShareableItineraryPoster model={model} />
      </PosterStage>

      {published && <p className="itinerary-share__url">{url}</p>}

      <div className="itinerary-share__actions">
        <button type="button" className="admin-btn admin-btn--secondary" disabled={busy} onClick={() => void download()}>
          <Download size={16} aria-hidden="true" />
          {busy ? "Pressing poster…" : "Download"}
        </button>
        {published && (
          <>
            <button type="button" className="admin-btn admin-btn--primary" disabled={busy} onClick={() => void share()}>
              <Share2 size={16} aria-hidden="true" />
              Share
            </button>
            <button type="button" className="admin-btn admin-btn--secondary" onClick={() => void copyLink()}>
              <Link2 size={16} aria-hidden="true" />
              Copy link
            </button>
          </>
        )}
      </div>
      {!published && <p className="itinerary-editor__muted">Publish the week to share it with a link.</p>}

      {feedback && (
        <p
          className={feedback.kind === "error" ? "itinerary-share__feedback itinerary-share__feedback--error" : "itinerary-share__feedback"}
          role={feedback.kind === "error" ? "alert" : "status"}
        >
          {feedback.message}
        </p>
      )}
      {fallback && (
        <button type="button" className="admin-btn admin-btn--secondary admin-btn--sm" onClick={downloadFallback}>
          <Download size={14} aria-hidden="true" />
          Download poster
        </button>
      )}
    </section>
  );
}
