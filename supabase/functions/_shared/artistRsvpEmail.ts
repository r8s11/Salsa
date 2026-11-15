import { layout, plainText, type EmailContent } from "./emailLayout.ts";

export type ArtistRsvpNotificationKind = "main_receipt" | "waitlist_receipt" | "capacity_full" | "new_waitlist" | "acceptance" | "withdrawal" | "date_update";
export interface ArtistRsvpFacts {
  event_title: string; event_date: string; time_zone: string; artist_name: string;
  artist_slug: string; event_slug: string; external_url: string | null; is_free: boolean;
  city: string; placement?: "main_list" | "waitlist";
}
export function artistRsvpEmail(kind: ArtistRsvpNotificationKind, facts: ArtistRsvpFacts, eventId: string, artistId: string, siteUrl: string): EmailContent {
  const site = new URL(siteUrl);
  if (!["http:", "https:"].includes(site.protocol) || site.username || site.password) throw Error("Email site configuration unavailable");
  const publicUrl = new URL(`/events/${encodeURIComponent(facts.event_slug || eventId)}`, site).toString();
  const artistUrl = new URL(`/i/${encodeURIComponent(facts.artist_slug)}`, site).toString();
  const portalUrl = new URL(`/host/instructors/${encodeURIComponent(artistId)}/events/${encodeURIComponent(eventId)}/rsvps`, site).toString();
  const headings: Record<ArtistRsvpNotificationKind, string> = {
    main_receipt: "Your RSVP was received", waitlist_receipt: "You’re on the waitlist",
    capacity_full: "Your main signup list is full", new_waitlist: "A guest joined your waitlist",
    acceptance: "The artist confirmed your acceptance", withdrawal: "Your artist acceptance was withdrawn",
    date_update: "Your event date or time changed",
  };
  const paragraphs: Record<ArtistRsvpNotificationKind, string[]> = {
    main_receipt: [`You are on the main signup list for ${facts.event_title}. This is not artist acceptance or verified payment. ${facts.artist_name} manages admission and confirms acceptance separately.`],
    waitlist_receipt: [`The main signup list is full or waiting guests have priority. You are on the waitlist for ${facts.event_title}; no place is confirmed. Contact ${facts.artist_name} before paying.`],
    capacity_full: ["The main-list signup limit has been reached. These are raw signups before artist acceptance, not verified payment, accepted attendance, unknown external sales or venue capacity.", "Review signups in your private artist roster. Removing a signup does not automatically promote a waiting guest."],
    new_waitlist: ["A new guest is waiting for a main-list place. Review the private roster; existing waiting guests take priority over newcomers.", "Promote only when space is available, then contact the guest manually. Promotion does not send acceptance."],
    acceptance: [`${facts.artist_name} has confirmed your acceptance for ${facts.event_title}. This records the artist’s decision, not verified payment. Any payment or other arrangement stays with the artist.`],
    withdrawal: [`${facts.artist_name} has withdrawn your acceptance for ${facts.event_title}. Contact the artist about admission or external payment arrangements. This notice does not process or promise a refund.`],
    date_update: [`The date, time or effective time zone for ${facts.event_title} changed. The current schedule is shown below. Your signup placement and artist acceptance have not changed.`, "Contact the artist if the new schedule does not work for you. This notice does not process or promise a refund."],
  };
  if (!headings[kind]) throw Error("Unsupported notification kind");
  const artistNotice = kind === "capacity_full" || kind === "new_waitlist";
  const copy = [...paragraphs[kind]];
  let external: string | null = null;
  if (facts.external_url) { try { const url = new URL(facts.external_url); if (["http:", "https:"].includes(url.protocol) && !url.username && !url.password) external = url.toString(); } catch { /* Invalid optional external links never block the factual notice. */ } }
  const links = [{ label: "Event details", url: publicUrl }, { label: "Managing artist", url: artistUrl }];
  if (!artistNotice && external && (kind === "main_receipt" || kind === "waitlist_receipt")) {
    links.push({ label: facts.is_free ? "Artist registration site" : "Artist payment site", url: external });
    copy.push("No place is confirmed by the artist link. If you are waitlisted or unsure, contact the artist before paying. Salsa Segura does not process or verify external payments.");
  }
  const when = new Intl.DateTimeFormat("en-US", { dateStyle: "full", timeStyle: "short", timeZone: facts.time_zone }).format(new Date(facts.event_date));
  const params = {
    platformName: "Salsa Segura", heading: headings[kind], paragraphs: copy,
    rows: [["Event", facts.event_title], ["When", `${when} · ${facts.time_zone}`], ["Artist", facts.artist_name], ["City", facts.city]] as Array<[string, string]>,
    links, ...(artistNotice ? { cta: { label: "Open private RSVP roster", url: portalUrl } } : {}),
    footerLines: ["You received this event notice because of a saved signup or your active managing-artist owner role.", "Signup, artist acceptance and externally handled payment are separate."],
  };
  return { subject: `${headings[kind]} · ${facts.event_title.replace(/[\r\n]/g, " ")}`, html: layout(params), text: plainText(params) };
}
