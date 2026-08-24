import type { ReactNode } from "react";
import type { EventTaxonomyTerm } from "../../model/types";
import type { EventFormCapabilities, EventFormDraft } from "./types";
import "./EventForm.css";

type Props = {
  draft: EventFormDraft;
  capabilities: EventFormCapabilities;
  onChange: (draft: EventFormDraft) => void;
  renderVenueField?: () => ReactNode;
  renderFlyerField?: () => ReactNode;
  taxonomyTerms?: {
    danceStyles: EventTaxonomyTerm[];
    attributes: EventTaxonomyTerm[];
    archived: EventTaxonomyTerm[];
  };
};

const styles = [
  ["salsa", "Salsa"],
  ["bachata", "Bachata"],
  ["kizomba", "Kizomba"],
  ["merengue", "Merengue"],
  ["cha-cha", "Cha-Cha"],
  ["zouk", "Zouk"],
  ["afro-cuban", "Afro-Cuban"],
] as const;

export default function EventForm({
  draft,
  capabilities,
  onChange,
  renderVenueField,
  renderFlyerField,
  taxonomyTerms,
}: Props) {
  const update = <K extends keyof EventFormDraft>(key: K, value: EventFormDraft[K]) =>
    onChange({ ...draft, [key]: value });
  const toggleStyle = (style: string) =>
    update(
      "dance_styles",
      draft.dance_styles.includes(style)
        ? draft.dance_styles.filter((item) => item !== style)
        : [...draft.dance_styles, style]
    );
  const toggleTaxonomyTerm = (termId: string) =>
    update(
      "taxonomy_term_ids",
      draft.taxonomy_term_ids.includes(termId)
        ? draft.taxonomy_term_ids.filter((id) => id !== termId)
        : [...draft.taxonomy_term_ids, termId]
    );

  return (
    <div className="event-form">
      <section className="event-form__section">
        <h2>Basics</h2>
        <label>
          Event Title *
          <input
            value={draft.title}
            onChange={(event) => update("title", event.target.value)}
            required
          />
        </label>
        <div className="event-form__field">
          <span className="event-form__label">Event type *</span>
          <div className="event-form__segmented" role="group" aria-label="Event type">
            {(
              [
                ["social", "Social"],
                ["class", "Class"],
                ["workshop", "Workshop"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={draft.event_type === value}
                onClick={() => update("event_type", value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="event-form__field">
          <span className="event-form__label">City *</span>
          <div className="event-form__segmented" role="group" aria-label="City">
            {(
              [
                ["boston", "Boston"],
                ["new-york-city", "New York City"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={draft.city === value}
                onClick={() => update("city", value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <label>
          Description
          <textarea
            value={draft.description}
            onChange={(event) => update("description", event.target.value)}
          />
        </label>
      </section>
      {capabilities.styles !== "none" && (
        <section className="event-form__section">
          <h2>Styles & tags</h2>
          {capabilities.styles === "slug-chips" && (
            <div className="event-form__chips">
              {styles.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={draft.dance_styles.includes(value)}
                  onClick={() => toggleStyle(value)}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          {capabilities.styles === "taxonomy-chips" && taxonomyTerms && (
            <>
              {taxonomyTerms.archived.length > 0 && (
                <p>
                  Archived existing terms:{" "}
                  {taxonomyTerms.archived.map((term) => term.name).join(", ")}
                </p>
              )}
              <div className="event-form__taxonomy">
                <h3>Dance Styles</h3>
                {taxonomyTerms.danceStyles.map((term) => (
                  <label key={term.id}>
                    <input
                      type="checkbox"
                      checked={draft.taxonomy_term_ids.includes(term.id)}
                      onChange={() => toggleTaxonomyTerm(term.id)}
                    />
                    {term.name}
                  </label>
                ))}
              </div>
              {capabilities.attributes && (
                <div className="event-form__taxonomy">
                  <h3>Attributes</h3>
                  {taxonomyTerms.attributes.map((term) => (
                    <label key={term.id}>
                      <input
                        type="checkbox"
                        checked={draft.taxonomy_term_ids.includes(term.id)}
                        onChange={() => toggleTaxonomyTerm(term.id)}
                      />
                      {term.name}
                    </label>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      )}
      <section className="event-form__section">
        <h2>When</h2>
        <label>
          Date *
          <input
            type="date"
            value={draft.event_date}
            onChange={(event) => update("event_date", event.target.value)}
            required
          />
        </label>
        <label>
          Start Time
          <input
            type="time"
            value={draft.event_time}
            onChange={(event) => update("event_time", event.target.value)}
          />
        </label>
        <label className="event-form__check">
          <input
            type="checkbox"
            checked={draft.recurrence === "weekly"}
            onChange={(event) => update("recurrence", event.target.checked ? "weekly" : "")}
          />
          Repeats weekly
        </label>
      </section>
      <section className="event-form__section">
        <h2>Where</h2>
        {renderVenueField ? (
          renderVenueField()
        ) : (
          <>
            <label>
              Venue Name
              <input
                value={draft.location}
                onChange={(event) => update("location", event.target.value)}
              />
            </label>
            <label>
              Address
              <input
                value={draft.address}
                onChange={(event) => update("address", event.target.value)}
              />
            </label>
          </>
        )}
      </section>
      <section className="event-form__section">
        <h2>Pricing & RSVP</h2>
        <div className="event-form__field">
          <span className="event-form__label">Price</span>
          <div className="event-form__segmented" role="group" aria-label="Price">
            {(
              [
                ["", "Not specified"],
                ["free", "Free"],
                ["paid", "Paid"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={label}
                type="button"
                aria-pressed={draft.price_type === value}
                onClick={() => update("price_type", value)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {draft.price_type === "paid" && (
          <label>
            Amount
            <input
              type="number"
              min="0"
              value={draft.price_amount}
              onChange={(event) => update("price_amount", event.target.value)}
            />
          </label>
        )}
        <label>
          RSVP link
          <input
            type="url"
            value={draft.rsvp_link}
            onChange={(event) => update("rsvp_link", event.target.value)}
          />
        </label>
      </section>
      {capabilities.flyer && (
        <section className="event-form__section">
          <h2>Artwork</h2>
          {renderFlyerField ? (
            renderFlyerField()
          ) : (
            <label>
              Image URL
              <input
                type="url"
                value={draft.image_url}
                onChange={(event) => update("image_url", event.target.value)}
              />
            </label>
          )}
        </section>
      )}
      {capabilities.hostAndContact && (
        <section className="event-form__section">
          <h2>Host & contact</h2>
          <label>
            Host
            <input value={draft.host} onChange={(event) => update("host", event.target.value)} />
          </label>
          <label>
            Contact email
            <input
              type="email"
              value={draft.contact_email}
              onChange={(event) => update("contact_email", event.target.value)}
            />
          </label>
          <label>
            Instagram
            <input
              value={draft.contact_instagram}
              onChange={(event) => update("contact_instagram", event.target.value)}
            />
          </label>
          <label>
            Website
            <input
              type="url"
              value={draft.contact_website}
              onChange={(event) => update("contact_website", event.target.value)}
            />
          </label>
        </section>
      )}
      {capabilities.submitterInfo && (
        <section className="event-form__section">
          <h2>Your info</h2>
          <label>
            Your name
            <input
              value={draft.submitter_name}
              onChange={(event) => update("submitter_name", event.target.value)}
            />
          </label>
          <label>
            Email
            <input
              type="email"
              value={draft.submitter_email}
              onChange={(event) => update("submitter_email", event.target.value)}
            />
          </label>
        </section>
      )}
    </div>
  );
}
