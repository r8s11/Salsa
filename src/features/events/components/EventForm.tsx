import type { EventFormDraft } from "../model/eventFormAdapters";
import "./EventForm.css";

export type EventFormCapabilities = {
  styles: "slug-chips" | "taxonomy-chips" | "none";
  attributes: boolean;
  venue: "free-text" | "combobox";
  flyer: boolean;
  hostAndContact: boolean;
  submitterInfo: boolean;
};

type Props = {
  draft: EventFormDraft;
  capabilities: EventFormCapabilities;
  onChange: (draft: EventFormDraft) => void;
};

const styles = [
  ["salsa", "Salsa"], ["bachata", "Bachata"], ["kizomba", "Kizomba"], ["merengue", "Merengue"], ["cha-cha", "Cha-Cha"], ["zouk", "Zouk"], ["afro-cuban", "Afro-Cuban"],
] as const;

export default function EventForm({ draft, capabilities, onChange }: Props) {
  const update = <K extends keyof EventFormDraft>(key: K, value: EventFormDraft[K]) => onChange({ ...draft, [key]: value });
  const toggleStyle = (style: string) => update("dance_styles", draft.dance_styles.includes(style) ? draft.dance_styles.filter((item) => item !== style) : [...draft.dance_styles, style]);

  return <div className="event-form">
    <section className="event-form__section"><h2>Basics</h2>
      <label>Title<input value={draft.title} onChange={(event) => update("title", event.target.value)} required /></label>
      <label>Event type<select value={draft.event_type} onChange={(event) => update("event_type", event.target.value as EventFormDraft["event_type"])} required><option value="">Select type</option><option value="social">Social</option><option value="class">Class</option><option value="workshop">Workshop</option></select></label>
      <label>City<select value={draft.city} onChange={(event) => update("city", event.target.value as EventFormDraft["city"])}><option value="boston">Boston</option><option value="new-york-city">New York City</option></select></label>
      <label>Description<textarea value={draft.description} onChange={(event) => update("description", event.target.value)} /></label>
    </section>
    {capabilities.styles !== "none" && <section className="event-form__section"><h2>Styles & tags</h2><div className="event-form__chips">{styles.map(([value, label]) => <button key={value} type="button" aria-pressed={draft.dance_styles.includes(value)} onClick={() => toggleStyle(value)}>{label}</button>)}</div></section>}
    <section className="event-form__section"><h2>When</h2><label>Date<input type="date" value={draft.event_date} onChange={(event) => update("event_date", event.target.value)} required /></label><label>Time<input type="time" value={draft.event_time} onChange={(event) => update("event_time", event.target.value)} /></label><label className="event-form__check"><input type="checkbox" checked={draft.recurrence === "weekly"} onChange={(event) => update("recurrence", event.target.checked ? "weekly" : "")} />Repeats weekly</label></section>
    <section className="event-form__section"><h2>Where</h2><label>Venue name<input value={draft.location} onChange={(event) => update("location", event.target.value)} /></label><label>Address<input value={draft.address} onChange={(event) => update("address", event.target.value)} /></label></section>
    <section className="event-form__section"><h2>Pricing & RSVP</h2><label>Price<select value={draft.price_type} onChange={(event) => update("price_type", event.target.value as EventFormDraft["price_type"])}><option value="">Select price</option><option value="free">Free</option><option value="paid">Paid</option></select></label>{draft.price_type === "paid" && <label>Amount<input type="number" min="0" value={draft.price_amount} onChange={(event) => update("price_amount", event.target.value)} /></label>}<label>RSVP link<input type="url" value={draft.rsvp_link} onChange={(event) => update("rsvp_link", event.target.value)} /></label></section>
    {capabilities.submitterInfo && <section className="event-form__section"><h2>Your info</h2><label>Your name<input value={draft.submitter_name} onChange={(event) => update("submitter_name", event.target.value)} /></label><label>Email<input type="email" value={draft.submitter_email} onChange={(event) => update("submitter_email", event.target.value)} /></label></section>}
    {capabilities.flyer && <section className="event-form__section"><h2>Artwork</h2><label>Image URL<input type="url" value={draft.image_url} onChange={(event) => update("image_url", event.target.value)} /></label></section>}
    {capabilities.hostAndContact && <section className="event-form__section"><h2>Host & contact</h2><label>Host<input value={draft.host} onChange={(event) => update("host", event.target.value)} /></label><label>Contact email<input type="email" value={draft.contact_email} onChange={(event) => update("contact_email", event.target.value)} /></label><label>Instagram<input value={draft.contact_instagram} onChange={(event) => update("contact_instagram", event.target.value)} /></label><label>Website<input type="url" value={draft.contact_website} onChange={(event) => update("contact_website", event.target.value)} /></label></section>}
  </div>;
}
