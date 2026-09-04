import { useCallback, useEffect, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { Camera, Download, Link2, Share2, X } from "lucide-react";
import ShareableEventPoster from "../../../components/EventModal/ShareableEventPoster";
import { resolvePosterImageForEvent } from "../../calendar/api/posterFlyers";
import { useEscapeKey } from "../../calendar/hooks/useEscapeKey";
import { useShareablePoster } from "../../calendar/hooks/useShareablePoster";
import type { ScheduleXEvent } from "../model/types";
import "./InstagramStoryShare.css";

interface InstagramStoryShareProps {
  /** Event rendered into the Story poster. */
  event: ScheduleXEvent;
  /** Source flyer for the Story background (`events.image_url`). */
  flyerUrl: string | null;
  /** Platform-normalized flyer cache (`events.poster_image_url`). */
  cachedFlyerUrl: string | null;
  /** Canonical public event URL used for the copied/ shared link. */
  shareUrl: string;
}

type Feedback = { kind: "status" | "error"; message: string };

/** Time for the off-screen poster (and its inlined flyer) to paint before capture. */
const POSTER_PAINT_MS = 300;

/**
 * Story sharing for an event: renders the existing 1080x1920
 * `ShareableEventPoster` off-screen, captures it through the shared
 * `useShareablePoster` pipeline, previews the result, and hands the PNG to the
 * OS share sheet where Instagram can be picked.
 *
 * The web platform cannot publish to a user's Instagram Story directly, so the
 * flow deliberately stops at the native share sheet and always offers the
 * save-image + copy-link fallback instead of implying automatic posting.
 */
export default function InstagramStoryShare({
  event,
  flyerUrl,
  cachedFlyerUrl,
  shareUrl,
}: InstagramStoryShareProps) {
  const { ensureContainer, capturePoster, posterFilename, downloadPoster, removeTarget } =
    useShareablePoster();
  const [isGenerating, setIsGenerating] = useState(false);
  const [story, setStory] = useState<{ blob: Blob; previewUrl: string } | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const releasePreview = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  }, []);

  useEffect(() => releasePreview, [releasePreview]);

  const closePreview = useCallback(() => {
    setStory(null);
    releasePreview();
  }, [releasePreview]);

  useEscapeKey(
    useCallback(() => {
      if (story) closePreview();
    }, [closePreview, story])
  );

  const copyEventLink = useCallback(async (): Promise<boolean> => {
    try {
      if (!navigator.clipboard?.writeText) return false;
      await navigator.clipboard.writeText(shareUrl);
      return true;
    } catch {
      return false;
    }
  }, [shareUrl]);

  const handleGenerate = async () => {
    if (isGenerating) return;
    setIsGenerating(true);
    setFeedback(null);
    let root: Root | null = null;
    try {
      // Story background priority: normalized flyer cache, then the event
      // flyer, then the poster's own designed fallback artwork.
      const resolution = await resolvePosterImageForEvent({
        eventId: String(event.id),
        sourceUrl: flyerUrl,
        cachedUrl: cachedFlyerUrl,
      });
      const posterImageUrl = resolution.status === "ready" ? resolution.dataUrl : undefined;

      const container = ensureContainer();
      root = createRoot(container);
      root.render(<ShareableEventPoster event={event} imageUrl={posterImageUrl} />);
      // Executor form: this project's tsconfig lib (ES2020) has no
      // Promise.withResolvers (see useShareablePoster's identical note).
      await new Promise((resolve) => setTimeout(resolve, POSTER_PAINT_MS));

      const blob = await capturePoster(container);
      releasePreview();
      const previewUrl = URL.createObjectURL(blob);
      previewUrlRef.current = previewUrl;
      setStory({ blob, previewUrl });
    } catch {
      setFeedback({
        kind: "error",
        message: "Could not create the Story image. Please try again.",
      });
    } finally {
      root?.unmount();
      removeTarget();
      setIsGenerating(false);
    }
  };

  const saveWithLinkFallback = async (blob: Blob) => {
    downloadPoster(event, blob);
    const copied = await copyEventLink();
    setFeedback({
      kind: "status",
      message: copied
        ? "Story image ready. Save the image and share it to Instagram. Event link copied."
        : "Story image ready. Save the image and share it to Instagram.",
    });
  };

  const handleShare = async () => {
    if (!story) return;
    setFeedback(null);
    const file = new File([story.blob], posterFilename(event), { type: "image/png" });

    if (!navigator.canShare?.({ files: [file] })) {
      await saveWithLinkFallback(story.blob);
      return;
    }

    try {
      await navigator.share({
        files: [file],
        title: event.title,
        text: `${event.title} — ${shareUrl}`,
      });
      setFeedback({
        kind: "status",
        message: "Story image shared. Pick Instagram in the share sheet to post it.",
      });
    } catch (error) {
      // A dismissed share sheet is a user choice, not a failure.
      if (error instanceof DOMException && error.name === "AbortError") return;
      setFeedback({
        kind: "error",
        message: "Sharing failed. Save the image and share it to Instagram instead.",
      });
    }
  };

  const handleSaveImage = () => {
    if (!story) return;
    downloadPoster(event, story.blob);
    setFeedback({ kind: "status", message: "Story image saved to your downloads." });
  };

  const handleCopyLink = async () => {
    const copied = await copyEventLink();
    setFeedback(
      copied
        ? { kind: "status", message: "Event link copied." }
        : { kind: "error", message: "Could not copy the event link." }
    );
  };

  return (
    <>
      <button
        type="button"
        className="story-share__trigger"
        onClick={handleGenerate}
        disabled={isGenerating}
      >
        <Camera size={16} aria-hidden="true" />
        {isGenerating ? "Creating Story…" : "Instagram Story"}
      </button>
      <p className="story-share__hint">
        Creates a 9:16 Story image you can post from your phone's share sheet.
      </p>
      {feedback && (
        <p
          className="story-share__feedback"
          role={feedback.kind === "error" ? "alert" : "status"}
        >
          {feedback.message}
        </p>
      )}

      {story && (
        <div className="story-share__overlay" role="presentation" onClick={closePreview}>
          <div
            className="story-share__sheet"
            role="dialog"
            aria-modal="true"
            aria-labelledby="story-share-title"
            onClick={(clickEvent) => clickEvent.stopPropagation()}
          >
            <div className="story-share__sheet-head">
              <h2 className="story-share__title" id="story-share-title">
                Story preview
              </h2>
              <button
                type="button"
                className="story-share__close"
                onClick={closePreview}
                aria-label="Close Story preview"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>

            <img
              className="story-share__preview"
              src={story.previewUrl}
              alt={`Instagram Story image for ${event.title}`}
            />

            <div className="story-share__actions">
              <button type="button" className="story-share__action--primary" onClick={handleShare}>
                <Share2 size={16} aria-hidden="true" /> Share
              </button>
              <button type="button" className="story-share__action" onClick={handleSaveImage}>
                <Download size={16} aria-hidden="true" /> Save image
              </button>
              <button type="button" className="story-share__action" onClick={handleCopyLink}>
                <Link2 size={16} aria-hidden="true" /> Copy link
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
