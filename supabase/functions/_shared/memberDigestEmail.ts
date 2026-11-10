import { type EmailContent, layout, plainText } from "./emailLayout.ts";
export interface DigestEvent {
  title: string;
  startsAt: string;
  timeZone: string | null;
  venueName: string | null;
  path: string;
}
export function memberDigestEmail(
  input: {
    siteUrl: string;
    metroName: string;
    events: DigestEvent[];
    unsubscribeUrl: string;
  },
): EmailContent & { headers: Record<string, string> } {
  const site = new URL(input.siteUrl),
    unsubscribe = new URL(input.unsubscribeUrl);
  if (
    site.protocol !== "https:" || site.username || site.password ||
    unsubscribe.protocol !== "https:" || unsubscribe.username ||
    unsubscribe.password
  ) throw Error("Invalid email URL");
  const events = input.events.slice(0, 12);
  const links = events.map((event) => {
    const url = new URL(event.path, site.origin);
    if (
      !event.path.startsWith("/events/") || url.origin !== site.origin ||
      url.username || url.password
    ) throw Error("Invalid event path");
    const options: Intl.DateTimeFormatOptions = {
      timeZone: event.timeZone ?? "America/New_York",
      weekday: "short", month: "short", day: "numeric",
      hour: "numeric", minute: "2-digit", timeZoneName: "short",
    };
    let formatter: Intl.DateTimeFormat;
    try {
      formatter = new Intl.DateTimeFormat("en-US", options);
    } catch {
      options.timeZone = "America/New_York";
      formatter = new Intl.DateTimeFormat("en-US", options);
    }
    const date = new Date(event.startsAt);
    // Stable punctuation across runtimes; Intl owns locale/timezone/DST conversion.
    const parts = formatter.formatToParts(date);
    const part = (name: string) =>
      parts.find((p) => p.type === name)?.value ?? "";
    const time = part("weekday") + ", " + part("month") + " " + part("day") +
      ", " + part("hour") + ":" + part("minute") + " " + part("dayPeriod") +
      " " + part("timeZoneName");
    return {
      label: event.title + " — " + time +
        (event.venueName ? " — " + event.venueName : ""),
      url: url.href,
    };
  });
  const heading = "This week in " + input.metroName + ": " + events.length +
    " " + (events.length === 1 ? "event" : "events");
  const parts = {
    platformName: "Salsa Segura",
    heading,
    paragraphs: ["Upcoming events in your city over the next seven days."],
    links,
    cta: { label: "Unsubscribe from the weekly digest", url: unsubscribe.href },
    footerLines: [
      "You're receiving this because you turned on the weekly digest. Required account, security and submission emails are separate.",
    ],
  };
  return {
    subject: heading.replace(/[\r\n]/g, " "),
    html: layout(parts),
    text: plainText(parts),
    headers: {
      "List-Unsubscribe": "<" + unsubscribe.href + ">",
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  };
}
