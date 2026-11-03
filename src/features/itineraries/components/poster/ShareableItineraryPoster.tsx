import { useMemo } from "react";
import { create as createQr } from "qrcode";
import { weekLabelLines, type ItineraryPosterModel } from "../../model/itineraryPoster";
import ItineraryCover from "./ItineraryCover";
import "../../../events/components/event-modal/ShareableEventPoster.css";
import "./ShareableItineraryPoster.css";

/** Width a card panel's type sets in: 285px less its 26px margins. */
const CARD_PANEL_MEASURE = 233;
/** Story link column: 968px back cover less the 210px QR and its 32px gap. */
const STORY_LINK_MEASURE = 726;
/** Feed link column: 984px less the 232px QR column and its 24px gap. */
const FEED_LINK_MEASURE = 728;

/** Story nights beyond this set a size smaller, so a full week leaves the cover room. */
const DENSE_TRACKS = 5;

/**
 * Largest size, up to `max`, at which `chars` condensed glyphs (about `em`
 * wide each) hold one unbroken line inside `measure`.
 */
function fitSize(chars: number, measure: number, max: number, em = 0.52): number {
  return Math.min(max, Math.floor(measure / (chars * em)));
}

/** The same QR rendering as the event sleeve: crisp modules on cream. */
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

function SleeveCut({ model }: { model: ItineraryPosterModel }) {
  const story = model.format === "story";
  const sides = [
    { label: "Side A", tracks: model.tracks.filter((track) => track.code.startsWith("A")) },
    { label: "Side B", tracks: model.tracks.filter((track) => track.code.startsWith("B")) },
  ].filter((side) => side.tracks.length > 0);
  const linkSize = story
    ? fitSize(model.urlLabel.length, STORY_LINK_MEASURE, 44, 0.48)
    : fitSize(model.urlLabel.length, FEED_LINK_MEASURE, 30, 0.48);

  return (
    <>
      <header className="sleeve-masthead">
        <span className="sleeve-masthead__label">Salsa Segura</span>
        <div className="sleeve-masthead__details">
          <span className="sleeve-masthead__catalogue">{model.catalogue}</span>
          <span className="sleeve-masthead__type">The Week</span>
        </div>
      </header>

      <div className="sleeve-front">
        <ItineraryCover title={model.title} weekLabel={model.weekLabel} tiles={model.tiles} />
        {!story && (
          <div className="sleeve-spine" aria-hidden="true">
            <span>{model.weekLabel}</span>
          </div>
        )}
      </div>

      <section className="sleeve-back">
        <div
          className={`sleeve-back__side itinerary-sides${story && model.tracks.length > DENSE_TRACKS ? " itinerary-sides--dense" : ""}`}
        >
          {sides.map((side) => (
            <div key={side.label} className="itinerary-side">
              <p className="sleeve-back__side-label">{side.label}</p>
              <ol className="sleeve-tracks">
                {side.tracks.map((track) => (
                  <li key={track.code} className="sleeve-track">
                    <span className="sleeve-track__no">{track.code}</span>
                    <span className="sleeve-track__label">{track.day}</span>
                    <span className="itinerary-track__main">
                      <span className="itinerary-track__title">{track.title}</span>
                      <span className="sleeve-track__leader" aria-hidden="true" />
                      <span className="sleeve-track__value">{track.time}</span>
                      {story && track.venue && <span className="sleeve-track__note">{track.venue}</span>}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>

        <div className="sleeve-scan">
          <QrCode value={model.url} />
          <div className="sleeve-scan__text">
            <span className="sleeve-scan__cta">{story ? "Scan for the full week" : "Scan"}</span>
            <span className="sleeve-scan__url" style={{ fontSize: `${linkSize}px` }}>
              {model.urlLabel}
            </span>
          </div>
        </div>
      </section>
    </>
  );
}

/** The 1200×630 link card: the sleeve opened out as a gatefold, no QR. */
function GatefoldCut({ model }: { model: ItineraryPosterModel }) {
  const weekLines = weekLabelLines(model.weekLabel);
  const longestWord = Math.max(...model.cityName.split(/\s+/).map((word) => word.length));
  const citySize = fitSize(longestWord, CARD_PANEL_MEASURE, 54);
  const rangeSize = fitSize(Math.max(...weekLines.map((line) => line.length)), CARD_PANEL_MEASURE, 68);

  return (
    <>
      <div className="itinerary-panel">
        <header className="sleeve-masthead">
          <span className="sleeve-masthead__label">Salsa Segura</span>
          <span className="sleeve-masthead__catalogue">{model.catalogue}</span>
        </header>
        <div className="itinerary-panel__week">
          <p className="sleeve-back__side-label">The Week</p>
          <p className="itinerary-panel__city" style={{ fontSize: `${citySize}px` }}>
            {model.cityName}
          </p>
          <p className="itinerary-panel__range" style={{ fontSize: `${rangeSize}px` }}>
            {weekLines.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </p>
        </div>
      </div>

      <ItineraryCover title={model.title} weekLabel={model.weekLabel} tiles={model.tiles} />

      <div className="itinerary-panel">
        {model.tracks.length > 0 && (
          <div className="itinerary-panel__tracks">
            <p className="sleeve-back__side-label">Featured</p>
            <ol className="sleeve-tracks">
              {model.tracks.map((track) => (
                <li key={track.code} className="sleeve-track">
                  <span className="sleeve-track__no">{track.day}</span>
                  <span className="itinerary-track__title">{track.title}</span>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
    </>
  );
}

/**
 * The week's shared poster, pressed as a compilation LP: one sleeve whose
 * track list is the week. Rendered at export size — Story 1080×1920, feed
 * 1080×1350, or the 1200×630 gatefold link card — and captured to an image.
 */
export default function ShareableItineraryPoster({ model }: { model: ItineraryPosterModel }) {
  return (
    <div
      className={`sleeve sleeve--compilation sleeve--${model.format}`}
      role="img"
      aria-label={`${model.title}, ${model.cityName}, ${model.weekLabel}. ${model.tracks.length} nights. Full week: ${model.url}`}
    >
      {model.format === "card" ? <GatefoldCut model={model} /> : <SleeveCut model={model} />}
    </div>
  );
}
