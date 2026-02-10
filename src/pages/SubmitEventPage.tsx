import { useState, FormEvent } from "react";
import { supabase } from "../lib/supabase";
import type { EventType } from "../types/events";
import "./SubmitEventPage.css";

interface SubmitForm {
  title: string;
  description: string;
  event_type: EventType | "";
  event_date: string;
  event_time: string;
  location: string;
  address: string;
  price_type: "free" | "paid" | "";
  price_amount: string;
  rsvp_link: string;
  submitter_name: string;
  submitter_email: string;
}

const initialForm: SubmitForm = {
  title: "",
  description: "",
  event_type: "",
  event_date: "",
  event_time: "",
  location: "",
  address: "",
  price_type: "",
  price_amount: "",
  rsvp_link: "",
  submitter_name: "",
  submitter_email: "",
};

export default function SubmitEventPage() {
  const [form, setForm] = useState<SubmitForm>(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (field: keyof SubmitForm, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const validateForm = (): string | null => {
    // Validate price amount when price type is "paid"
    if (form.price_type === "paid") {
      if (!form.price_amount || form.price_amount.trim() === "") {
        return "Please enter a price amount for paid events.";
      }
      const price = parseFloat(form.price_amount);
      if (isNaN(price) || price <= 0) {
        return "Price amount must be a positive number.";
      }
    }

    // Validate RSVP link if provided
    if (form.rsvp_link && form.rsvp_link.trim() !== "") {
      try {
        const url = new URL(form.rsvp_link);
        if (!url.protocol.startsWith("http")) {
          return "RSVP link must be a valid HTTP or HTTPS URL.";
        }
      } catch {
        return "Please enter a valid URL for the RSVP link (e.g., https://example.com).";
      }
    }

    return null;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate form before submission
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);

    try {
      // Combine date + time into an ISO timestamp
      const eventDateTime = form.event_time
        ? `${form.event_date}T${form.event_time}:00`
        : `${form.event_date}T00:00:00`;

      const { error: supabaseError } = await supabase.from("events").insert({
        title: form.title,
        description: form.description || null,
        event_type: form.event_type,
        event_date: eventDateTime,
        event_time: form.event_time || null,
        location: form.location || null,
        address: form.address || null,
        price_type: form.price_type || null,
        price_amount: form.price_amount ? parseFloat(form.price_amount) : null,
        rsvp_link: form.rsvp_link || null,
        status: "pending", // All submissions start as pending
      });

      if (supabaseError) {
        setError(supabaseError.message);
        return;
      }

      setIsSubmitted(true);
      setForm(initialForm);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSubmitted) {
    return (
      <section className="submit-event">
        <div className="container">
          <div className="success-card">
            <h2>🎉 Event Submitted!</h2>
            <p>
              Thank you for contributing to Boston's dance community! Your event is now pending
              review and will appear on the calendar once approved.
            </p>
            <button className="submit-button" onClick={() => setIsSubmitted(false)}>
              Submit Another Event
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="submit-event">
      <div className="container">
        <h1 className="section-title">Submit an Event</h1>
        <p className="submit-intro">
          Know about a salsa, bachata, or dance event in Boston? Share it with the community! All
          submissions are reviewed before appearing on the calendar.
        </p>

        {error && (
          <div className="error-banner">
            <p>❌ {error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="submit-form">
          {/* ── Event Details ── */}
          <fieldset>
            <legend>Event Details</legend>

            <div className="form-group">
              <label htmlFor="title">Event Title *</label>
              <input
                id="title"
                type="text"
                placeholder="e.g. Friday Night Salsa Social"
                value={form.title}
                onChange={(e) => update("title", e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="event_type">Event Type *</label>
              <select
                id="event_type"
                value={form.event_type}
                onChange={(e) => update("event_type", e.target.value)}
                required
              >
                <option value="">Select type</option>
                <option value="social">Social Dance</option>
                <option value="class">Class</option>
                <option value="workshop">Workshop</option>
              </select>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="event_date">Date *</label>
                <input
                  id="event_date"
                  type="date"
                  value={form.event_date}
                  onChange={(e) => update("event_date", e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="event_time">Start Time</label>
                <input
                  id="event_time"
                  type="time"
                  value={form.event_time}
                  onChange={(e) => update("event_time", e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="description">Description</label>
              <textarea
                id="description"
                placeholder="Tell people what to expect..."
                rows={4}
                value={form.description}
                onChange={(e) => update("description", e.target.value)}
              />
            </div>
          </fieldset>

          {/* ── Location ── */}
          <fieldset>
            <legend>Location</legend>

            <div className="form-group">
              <label htmlFor="location">Venue Name</label>
              <input
                id="location"
                type="text"
                placeholder="e.g. Havana Club"
                value={form.location}
                onChange={(e) => update("location", e.target.value)}
              />
            </div>

            <div className="form-group">
              <label htmlFor="address">Address</label>
              <input
                id="address"
                type="text"
                placeholder="e.g. 288 Green St, Cambridge, MA"
                value={form.address}
                onChange={(e) => update("address", e.target.value)}
              />
            </div>
          </fieldset>

          {/* ── Pricing & Link ── */}
          <fieldset>
            <legend>Pricing & Link</legend>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="price_type">Price</label>
                <select
                  id="price_type"
                  value={form.price_type}
                  onChange={(e) => update("price_type", e.target.value)}
                >
                  <option value="">Select</option>
                  <option value="free">Free</option>
                  <option value="paid">Paid</option>
                </select>
              </div>

              {form.price_type === "paid" && (
                <div className="form-group">
                  <label htmlFor="price_amount">Amount ($)</label>
                  <input
                    id="price_amount"
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="15.00"
                    value={form.price_amount}
                    onChange={(e) => update("price_amount", e.target.value)}
                  />
                </div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="rsvp_link">RSVP / Event Link</label>
              <input
                id="rsvp_link"
                type="url"
                placeholder="https://..."
                value={form.rsvp_link}
                onChange={(e) => update("rsvp_link", e.target.value)}
              />
            </div>
          </fieldset>

          {/* ── Your Info ── */}
          <fieldset>
            <legend>Your Info</legend>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="submitter_name">Your Name</label>
                <input
                  id="submitter_name"
                  type="text"
                  placeholder="Your name"
                  value={form.submitter_name}
                  onChange={(e) => update("submitter_name", e.target.value)}
                />
              </div>
              <div className="form-group">
                <label htmlFor="submitter_email">Your Email</label>
                <input
                  id="submitter_email"
                  type="email"
                  placeholder="your@email.com"
                  value={form.submitter_email}
                  onChange={(e) => update("submitter_email", e.target.value)}
                />
              </div>
            </div>
          </fieldset>

          <button type="submit" className="submit-button" disabled={isSubmitting}>
            {isSubmitting ? "Submitting..." : "Submit Event"}
          </button>
        </form>
      </div>
    </section>
  );
}
