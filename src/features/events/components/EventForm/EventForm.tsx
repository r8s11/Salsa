import type { ReactNode } from "react";
import type { EventTaxonomyTerm } from "../../model/types";
import type { EventFormCapabilities, EventFormDraft } from "./types";
import type { SubmitFieldErrors } from "../../../submit-event/validation";
import FormFieldError from "../../../../shared/forms/FormFieldError";
import { fieldErrorProps } from "../../../../shared/forms/fieldErrorProps";
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
  /**
   * Marks the "Your info" name/email inputs as required. Set for anonymous
   * public submission, where those two fields are the only way to reach the
   * submitter about their own event. Defaults to false so admin and
   * authenticated forms are unaffected.
   */
  requireSubmitterContact?: boolean;
  /**
   * Per-field validation errors, keyed the same way as
   * `validateSubmitFormFields`. Only `/submit` passes this today — admin and
   * organizer-edit surfaces render without it and see no error UI.
   */
  errors?: SubmitFieldErrors;
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
  requireSubmitterContact = false,
  errors = {},
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
        <div className="event-form__field">
          <label htmlFor="event-title">Event Title *</label>
          <input
            id="event-title"
            value={draft.title}
            onChange={(event) => update("title", event.target.value)}
            required
            {...fieldErrorProps("event-title-error", errors.title)}
          />
          <FormFieldError id="event-title-error" message={errors.title} />
        </div>
        <div className="event-form__field">
          <span className="event-form__label" id="event-type-label">
            Event type *
          </span>
          <div
            id="event-type"
            className="event-form__segmented"
            role="group"
            aria-labelledby="event-type-label"
            aria-required="true"
            {...fieldErrorProps("event-type-error", errors.event_type)}
          >
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
          <FormFieldError id="event-type-error" message={errors.event_type} />
        </div>
        <div className="event-form__field">
          <span className="event-form__label" id="event-city-label">
            City *
          </span>
          <div
            id="event-city"
            className="event-form__segmented"
            role="group"
            aria-labelledby="event-city-label"
            aria-required="true"
            {...fieldErrorProps("event-city-error", errors.city)}
          >
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
          <FormFieldError id="event-city-error" message={errors.city} />
        </div>
        <div className="event-form__field">
          <label htmlFor="event-description">Description</label>
          <textarea
            id="event-description"
            value={draft.description}
            onChange={(event) => update("description", event.target.value)}
            {...fieldErrorProps("event-description-error", errors.description)}
          />
          <FormFieldError id="event-description-error" message={errors.description} />
        </div>
      </section>
      {capabilities.styles !== "none" && (
        <section className="event-form__section">
          <h2>Styles & tags</h2>
          {capabilities.styles === "slug-chips" && (
            <div className="event-form__field">
              <span className="event-form__label" id="event-dance-styles-label">
                Dance Styles
              </span>
              <div
                id="event-dance-styles"
                className="event-form__chips"
                role="group"
                aria-labelledby="event-dance-styles-label"
                {...fieldErrorProps("event-dance-styles-error", errors.dance_styles)}
              >
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
              <FormFieldError id="event-dance-styles-error" message={errors.dance_styles} />
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
        <div className="event-form__field">
          <label htmlFor="event-date">Date *</label>
          <input
            id="event-date"
            type="date"
            value={draft.event_date}
            onChange={(event) => update("event_date", event.target.value)}
            required
            {...fieldErrorProps("event-date-error", errors.event_date)}
          />
          <FormFieldError id="event-date-error" message={errors.event_date} />
        </div>
        <div className="event-form__field">
          <label htmlFor="event-time">Start Time</label>
          <input
            id="event-time"
            type="time"
            value={draft.event_time}
            onChange={(event) => update("event_time", event.target.value)}
          />
        </div>
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
            <div className="event-form__field">
              <label htmlFor="event-location">Venue Name</label>
              <input
                id="event-location"
                value={draft.location}
                onChange={(event) => update("location", event.target.value)}
                {...fieldErrorProps("event-location-error", errors.location)}
              />
              <FormFieldError id="event-location-error" message={errors.location} />
            </div>
            <div className="event-form__field">
              <label htmlFor="event-address">Address</label>
              <input
                id="event-address"
                value={draft.address}
                onChange={(event) => update("address", event.target.value)}
                {...fieldErrorProps("event-address-error", errors.address)}
              />
              <FormFieldError id="event-address-error" message={errors.address} />
            </div>
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
          <div className="event-form__field">
            <label htmlFor="event-price-amount">Amount</label>
            <input
              id="event-price-amount"
              type="number"
              min="0"
              value={draft.price_amount}
              onChange={(event) => update("price_amount", event.target.value)}
              {...fieldErrorProps("event-price-amount-error", errors.price_amount)}
            />
            <FormFieldError id="event-price-amount-error" message={errors.price_amount} />
          </div>
        )}
        <div className="event-form__field">
          <label htmlFor="event-rsvp-link">RSVP link</label>
          <input
            id="event-rsvp-link"
            type="url"
            value={draft.rsvp_link}
            onChange={(event) => update("rsvp_link", event.target.value)}
            {...fieldErrorProps("event-rsvp-link-error", errors.rsvp_link)}
          />
          <FormFieldError id="event-rsvp-link-error" message={errors.rsvp_link} />
        </div>
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
          {requireSubmitterContact && (
            <p className="event-form__hint">
              We use these to confirm we got your event and to tell you once it has been
              reviewed. No account needed.
            </p>
          )}
          <div className="event-form__field">
            <label htmlFor="submitter-name">Your name</label>
            <input
              id="submitter-name"
              value={draft.submitter_name}
              onChange={(event) => update("submitter_name", event.target.value)}
              required={requireSubmitterContact}
              maxLength={300}
              {...fieldErrorProps("submitter-name-error", errors.submitter_name)}
            />
            <FormFieldError id="submitter-name-error" message={errors.submitter_name} />
          </div>
          <div className="event-form__field">
            <label htmlFor="submitter-email">Email</label>
            <input
              id="submitter-email"
              type="email"
              value={draft.submitter_email}
              onChange={(event) => update("submitter_email", event.target.value)}
              required={requireSubmitterContact}
              maxLength={300}
              autoComplete="email"
              {...fieldErrorProps("submitter-email-error", errors.submitter_email)}
            />
            <FormFieldError id="submitter-email-error" message={errors.submitter_email} />
          </div>
        </section>
      )}
    </div>
  );
}
