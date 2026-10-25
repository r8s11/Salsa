import { CANONICAL_ORIGIN } from "../../../utils/seo";

export type NativeEventSharePayload = {
  title: string;
  text: string;
  url: string;
};

export type EventShareInput = {
  title: string;
  dateLabel?: string | null;
  location?: string | null;
  publicUrl: string;
};

export function buildPublicEventUrl(eventId: string, origin?: string): string {
  return new URL(
    `/events/${encodeURIComponent(eventId)}`,
    origin ?? CANONICAL_ORIGIN
  ).toString();
}

function truthfulShareText({ title, dateLabel, location }: EventShareInput): string {
  let text = `Join us for ${title}`;
  if (dateLabel && dateLabel !== "Date unavailable") text += ` on ${dateLabel}`;
  if (location) text += ` at ${location}`;
  return `${text}.`;
}

export function buildEventPromoCaption(input: EventShareInput): string {
  return `${truthfulShareText(input)}\n\nEvent details:\n${input.publicUrl}`;
}

export function buildNativeSharePayload(input: EventShareInput): NativeEventSharePayload {
  return {
    title: input.title,
    text: truthfulShareText(input),
    url: input.publicUrl,
  };
}

export function buildShareDestinations(input: EventShareInput): {
  whatsApp: string;
  email: string;
  facebook: string;
} {
  const caption = buildEventPromoCaption(input);
  return {
    whatsApp: `https://wa.me/?text=${encodeURIComponent(caption)}`,
    email: `mailto:?subject=${encodeURIComponent(input.title)}&body=${encodeURIComponent(caption)}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(input.publicUrl)}`,
  };
}
