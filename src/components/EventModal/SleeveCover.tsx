import type { CSSProperties } from "react";
import type { ScheduleXEvent } from "../../types/events";
import type { PosterFormat } from "./posterFormat";
import "./ShareableEventPoster.css";

interface SleeveCoverProps {
  event: ScheduleXEvent;
  /** Cover art. A real flyer is shown whole; fallback art fills the square. */
  imageUrl: string;
  artKind: "flyer" | "fallback";
  format?: PosterFormat;
}

/** Title size steps for the lettered cover band, by character count. */
function titleSize(title: string, format: PosterFormat): number {
  const n = title.length;
  const size = n <= 14 ? 128 : n <= 24 ? 104 : n <= 40 ? 84 : n <= 64 ? 68 : 54;
  return format === "feed" ? Math.round(size * 0.8) : size;
}

/**
 * The square front cover: flyer art, the lettered title band and the price
 * sticker. Used whole on the exported poster and as the thumbnail in the
 * event modal, so what a dancer sees is what their friends receive. Kept
 * apart from the full poster so the modal can show it without loading the
 * QR encoder.
 */
export default function SleeveCover({
  event,
  imageUrl,
  artKind,
  format = "story",
}: SleeveCoverProps) {
  const isFree = event.priceType === "free" || event.priceAmount == null;
  const titleStyle = { "--title-size": `${titleSize(event.title, format)}px` } as CSSProperties;
  return (
    <div className="sleeve-cover">
      <div className={`sleeve-cover__art sleeve-cover__art--${artKind}`}>
        <img src={imageUrl} alt="" />
      </div>
      <div className="sleeve-cover__band">
        <h1 className="sleeve-cover__title" style={titleStyle}>
          {event.title}
        </h1>
      </div>
      <div className="sleeve-sticker">
        <span className="sleeve-sticker__label">Entry</span>
        <span className="sleeve-sticker__price">{isFree ? "Free" : `$${event.priceAmount}`}</span>
      </div>
    </div>
  );
}
