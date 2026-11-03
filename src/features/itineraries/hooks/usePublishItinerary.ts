import { createElement, useCallback, useState, type ReactElement } from "react";
import { resolvePosterImageForEvent } from "../../calendar/api/posterFlyers";
import { useShareablePoster } from "../../calendar/hooks/useShareablePoster";
import {
  itineraryErrorMessage,
  setItineraryCover,
  setItineraryStatus,
  uploadItineraryCover,
} from "../api/itinerariesRepo";
import ShareableItineraryPoster from "../components/poster/ShareableItineraryPoster";
import { buildItineraryPosterModel, type ItineraryPosterFormat } from "../model/itineraryPoster";
import { encodeLinkCard } from "../model/linkCard";
import type { ScheduleNight } from "../model/schedule";
import type { Itinerary } from "../model/types";

export type PublishItineraryStatus = "idle" | "rendering" | "uploading" | "publishing" | "error";

/** What every itinerary poster cut is pressed from. */
export interface ItineraryPosterInputs {
  itinerary: Pick<Itinerary, "city" | "weekStart" | "timeZone" | "title">;
  cityName: string;
  nights: ScheduleNight[];
}

/**
 * The poster element for a capture. Featured flyers are inlined as data URLs
 * so the capture never hits CORS; one that can't be fetched gets the
 * fallback art.
 */
export async function loadItineraryPoster(
  inputs: ItineraryPosterInputs,
  format: ItineraryPosterFormat
): Promise<ReactElement> {
  const featured = inputs.nights.flatMap((night) => (night.featured ? [night.featured.event] : []));
  const flyers = new Map(
    await Promise.all(
      featured.map(async (event) => {
        const resolution = await resolvePosterImageForEvent({
          eventId: event.id,
          sourceUrl: event.image_url ?? event.image_urls?.[0] ?? null,
          cachedUrl: event.poster_image_url ?? null,
        });
        return [event.id, resolution.status === "ready" ? resolution.dataUrl : null] as const;
      })
    )
  );
  return createElement(ShareableItineraryPoster, {
    model: buildItineraryPosterModel({ ...inputs, flyers, format }),
  });
}

/**
 * Renders, uploads and stores the 1200×630 link card, then (for publish)
 * makes the week public. Stops at the first failed step and rethrows its
 * error; `error` carries that step's message.
 */
export function usePublishItinerary() {
  const { capturePosterElement } = useShareablePoster();
  const [status, setStatus] = useState<PublishItineraryStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (id: string, inputs: ItineraryPosterInputs, publish: boolean) => {
      setError(null);
      try {
        setStatus("rendering");
        const element = await loadItineraryPoster(inputs, "card");
        const png = await capturePosterElement(async () => element);
        const jpeg = await encodeLinkCard(png);
        setStatus("uploading");
        const url = await uploadItineraryCover(id, jpeg);
        await setItineraryCover(id, url);
        if (publish) {
          setStatus("publishing");
          await setItineraryStatus(id, "published");
        }
        setStatus("idle");
      } catch (err) {
        setStatus("error");
        setError(itineraryErrorMessage(err));
        throw err;
      }
    },
    [capturePosterElement]
  );

  const publish = useCallback(
    (id: string, inputs: ItineraryPosterInputs) => run(id, inputs, true),
    [run]
  );
  const refreshCard = useCallback(
    (id: string, inputs: ItineraryPosterInputs) => run(id, inputs, false),
    [run]
  );

  return { publish, refreshCard, status, error };
}
