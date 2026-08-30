import { useMemo, useState } from "react";
import type { JSX } from "react";
import {
  createEventTitleImage,
  getEventTitleImageAlt,
  type EventTitleImageInput,
} from "./eventTitleImage";

export type EventImageProps = EventTitleImageInput & {
  imageUrl?: string | null;
  alt?: string;
  className?: string;
  loading?: "eager" | "lazy";
};

export default function EventImage({
  id,
  title,
  eventType,
  city,
  start,
  imageUrl,
  alt,
  className,
  loading,
}: EventImageProps): JSX.Element {
  const input = useMemo<EventTitleImageInput>(
    () => ({ id, title, eventType, city, start }),
    [id, title, eventType, city, start]
  );
  const fallbackSrc = useMemo(() => createEventTitleImage(input), [input]);
  const flyerSrc = imageUrl?.trim() || fallbackSrc;
  const source = useMemo(() => ({ input, flyerSrc }), [input, flyerSrc]);
  const [failedSource, setFailedSource] = useState<typeof source | null>(null);
  const src = failedSource === source ? fallbackSrc : flyerSrc;
  const isFallback = src === fallbackSrc;

  return (
    <img
      className={className}
      src={src}
      alt={isFallback ? getEventTitleImageAlt(input) : alt ?? `${title ?? "Event"} flyer`}
      loading={loading}
      onError={isFallback ? undefined : () => setFailedSource(source)}
    />
  );
}
