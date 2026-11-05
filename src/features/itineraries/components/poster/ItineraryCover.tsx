import type { CSSProperties } from "react";
import { resolveEventFlyer } from "../../../events/components/event-modal/eventModalImage";
import { weekLabelLines, type PosterTile } from "../../model/itineraryPoster";
import "../../../events/components/event-modal/ShareableEventPoster.css";
import "./ShareableItineraryPoster.css";

interface ItineraryCoverProps {
  title: string;
  weekLabel: string;
  /** Featured flyers in spotlight order; empty prints the neutral fallback art. */
  tiles: PosterTile[];
}

/**
 * Title size as a share of the cover's width (cqi), so one title reads the
 * same on the 968px story cover, the 728px feed cover and the 630px card.
 * The steps are the event cover's (SleeveCover) at 968px.
 */
function titleSize(title: string): number {
  const n = title.length;
  const px =
    n <= 14 ? 128 : n <= 24 ? 104 : n <= 40 ? 84 : n <= 64 ? 68 : Math.max(24, Math.floor(4320 / n));
  return Math.round((px / 968) * 1000) / 10;
}

/**
 * The compilation's square front cover: a mosaic of the week's featured
 * flyers, each framed in its own event's pressing, the lettered title band
 * and a sticker carrying the week. Shared by the story, feed and card cuts.
 */
export default function ItineraryCover({ title, weekLabel, tiles }: ItineraryCoverProps) {
  const weekLines = weekLabelLines(weekLabel);
  const longest = Math.max(...weekLines.map((line) => line.length));
  const titleStyle = { "--title-size": `${titleSize(title)}cqi` } as CSSProperties;
  const stickerStyle = { "--sticker-fit": Math.min(0.3, 1.6 / longest) } as CSSProperties;

  return (
    <div className="sleeve-cover itinerary-cover">
      <div className={`itinerary-cover__mosaic itinerary-cover__mosaic--${Math.max(1, tiles.length)}`}>
        {tiles.length > 0 ? (
          tiles.map((tile, index) => (
            <div
              key={index}
              className={`itinerary-cover__tile itinerary-cover__tile--${tile.artKind} sleeve--${tile.pressing}`}
            >
              <img src={tile.imageUrl} alt="" />
            </div>
          ))
        ) : (
          // No featured night means no pressing to claim: the neutral art, unframed.
          <div className="itinerary-cover__tile itinerary-cover__tile--fallback itinerary-cover__tile--unpressed">
            <img src={resolveEventFlyer({})} alt="" />
          </div>
        )}
      </div>
      <div className="sleeve-cover__band">
        <p className="sleeve-cover__title" style={titleStyle}>
          {title}
        </p>
      </div>
      <div className="sleeve-sticker" style={stickerStyle}>
        <span className="sleeve-sticker__label">Week</span>
        <span className="sleeve-sticker__price">
          {weekLines.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </span>
      </div>
    </div>
  );
}
