import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { ChevronDown } from "lucide-react";
import {
  buildEmptyVenueForm,
  buildVenueFormFromRow,
  validateVenueForm,
  type VenueForm,
  type VenueDetailRow,
  type VenueRow,
  COUNTRY_OPTIONS,
  venueDisplayAddress,
} from "../../features/admin/model/venuesQuery";
import { searchVenues } from "../../features/admin/api/venuesRepo";

interface AdminVenueFormProps {
  initial?: VenueDetailRow;
  isSaving?: boolean;
  error?: string | null;
  onSubmit: (form: VenueForm) => void;
  onCancel: () => void;
}

export default function AdminVenueForm({
  initial,
  isSaving = false,
  error = null,
  onSubmit,
  onCancel,
}: AdminVenueFormProps) {
  const [form, setForm] = useState<VenueForm>(() => {
    if (initial) {
      return buildVenueFormFromRow(initial);
    }
    return buildEmptyVenueForm();
  });

  const update = (field: keyof VenueForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // --- Duplicate detection (as-you-type, debounced) ---
  const [duplicateResults, setDuplicateResults] = useState<VenueRow[]>([]);

  useEffect(() => {
    const query = form.name.trim();
    if (query.length < 2) {
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const results = await searchVenues(query);
        if (!controller.signal.aborted) {
          setDuplicateResults(results.filter((v) => v.id !== initial?.id));
        }
      } catch {
        // Duplicate search is best-effort — fail silently
      }
    }, 500);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [form.name, initial?.id]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const validationError = validateVenueForm(form);
    if (validationError) {
      // Could surface via a banner — for now the parent passes `error`
      return;
    }
    onSubmit(form);
  };

  return (
    <form className="admin-form" onSubmit={handleSubmit} noValidate>
      <div className="admin-form__header">
        <h2>{initial ? "Edit Venue" : "New Venue"}</h2>
      </div>

      {error && (
        <div className="admin-banner admin-banner--error" role="alert">
          <p>{error}</p>
        </div>
      )}

      {/* Duplicate detection — shown above the form when matches exist */}
      {!initial?.id && duplicateResults.length > 0 && (
        <div className="admin-banner admin-banner--warning" role="alert">
          <p>Possible existing venues:</p>
          <ul className="admin-venue-form__duplicate-list">
            {duplicateResults.slice(0, 3).map((v) => (
              <li key={v.id}>
                <span>
                  <strong>{v.name}</strong> — {venueDisplayAddress(v)}
                </span>
              </li>
            ))}
          </ul>
          <p className="admin-form__helper">
            Review these matches before creating a new venue.
          </p>
        </div>
      )}

      <fieldset className="admin-form__fieldset">
        <legend>Venue Details</legend>

        <div className="admin-field">
          <label htmlFor="venue-name">Venue Name *</label>
          <input
            id="venue-name"
            type="text"
            className="admin-input"
            placeholder="e.g. Havana Club"
            value={form.name}
            onChange={(event) => update("name", event.target.value)}
            required
          />
        </div>

        <div className="admin-field">
          <label htmlFor="venue-website">Website</label>
          <input
            id="venue-website"
            type="url"
            className="admin-input"
            placeholder="https://..."
            value={form.website}
            onChange={(event) => update("website", event.target.value)}
          />
        </div>

        <div className="admin-field">
          <label htmlFor="venue-instagram">Instagram</label>
          <input
            id="venue-instagram"
            type="text"
            className="admin-input"
            placeholder="@handle"
            value={form.instagram}
            onChange={(event) => update("instagram", event.target.value)}
          />
        </div>

        <div className="admin-field">
          <label htmlFor="venue-phone">Phone</label>
          <input
            id="venue-phone"
            type="tel"
            className="admin-input"
            placeholder="+1 (617) 555-0123"
            value={form.phone}
            onChange={(event) => update("phone", event.target.value)}
          />
        </div>
      </fieldset>

      <fieldset className="admin-form__fieldset">
        <legend>Address</legend>

        <div className="admin-field">
          <label htmlFor="venue-address-line1">Address Line 1 *</label>
          <input
            id="venue-address-line1"
            type="text"
            className="admin-input"
            placeholder="e.g. 288 Green St"
            value={form.address_line1}
            onChange={(event) => update("address_line1", event.target.value)}
            required
          />
        </div>

        <div className="admin-field">
          <label htmlFor="venue-address-line2">Address Line 2</label>
          <input
            id="venue-address-line2"
            type="text"
            className="admin-input"
            placeholder="Apt 2, Suite 100, etc."
            value={form.address_line2}
            onChange={(event) => update("address_line2", event.target.value)}
          />
        </div>

        <div className="admin-form__row">
          <div className="admin-field">
            <label htmlFor="venue-city">City *</label>
            <input
              id="venue-city"
              type="text"
              className="admin-input"
              value={form.city}
              onChange={(event) => update("city", event.target.value)}
              required
            />
          </div>
          <div className="admin-field">
            <label htmlFor="venue-state">State / Region *</label>
            <input
              id="venue-state"
              type="text"
              className="admin-input"
              placeholder="e.g. MA"
              value={form.state_region}
              onChange={(event) => update("state_region", event.target.value)}
              required
            />
          </div>
        </div>

        <div className="admin-form__row">
          <div className="admin-field">
            <label htmlFor="venue-postal">ZIP / Postal Code</label>
            <input
              id="venue-postal"
              type="text"
              className="admin-input"
              placeholder="e.g. 02139"
              value={form.postal_code}
              onChange={(event) => update("postal_code", event.target.value)}
            />
          </div>
          <div className="admin-field">
            <label htmlFor="venue-country">Country *</label>
            <div className="admin-select-wrap">
              <select
                id="venue-country"
                className="admin-select"
                value={form.country}
                onChange={(event) => update("country", event.target.value)}
                required
              >
                <option value="">Select</option>
                {COUNTRY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={16} />
            </div>
          </div>
        </div>

        {/* Address normalization confirmation (brief §5) */}
        {form.address_line1 && (
          <div className="admin-venue-form__address-confirmation">
            <div className="admin-venue-form__confirmation-card">
              <strong>{form.name || "Venue Name"}</strong>
              <span className="admin-venue-form__confirmation-address">
                {[form.address_line1, form.address_line2, form.city, form.state_region, form.postal_code, form.country]
                  .filter((part) => part && part.trim())
                  .join(", ")}
              </span>
              {form.timezone && (
                <span className="admin-venue-form__confirmation-tz">Timezone: {form.timezone}</span>
              )}
              <button
                type="button"
                className="admin-btn admin-btn--secondary admin-btn--small"
                onClick={() => {
                  /* In the real impl, this opens the geocoding correction flow */
                }}
              >
                Edit
              </button>
            </div>
          </div>
        )}
      </fieldset>

      <div className="admin-form__actions">
        <button type="submit" className="admin-btn admin-btn--primary" disabled={isSaving}>
          {isSaving ? "Saving…" : initial ? "Save Changes" : "Create Venue"}
        </button>
        <button type="button" className="admin-btn admin-btn--secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
