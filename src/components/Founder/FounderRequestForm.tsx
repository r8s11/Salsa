import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { Link } from "react-router-dom";
import { CheckCircle, Loader2 } from "lucide-react";
import {
  validateFounderRequest,
  hasErrors,
  normalizePayload,
  type FounderRequestPayload,
  type FounderRequestErrors,
} from "../../lib/founderRequest";
import FormFieldError from "../../shared/forms/FormFieldError";
import "./FounderRequestForm.css";

interface Props {
  onSubmit: (payload: FounderRequestPayload) => Promise<{ success: boolean }>;
}

export default function FounderRequestForm({ onSubmit }: Props) {
  const [payload, setPayload] = useState<FounderRequestPayload>({
    applicantName: "",
    email: "",
    organizationName: "",
    instagram: "",
    website: "",
    city: "",
    region: "",
    description: "",
    message: "",
  });
  const [errors, setErrors] = useState<FounderRequestErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const successHeadingRef = useRef<HTMLHeadingElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  // Move focus to the success heading so screen readers announce the
  // outcome of the submission.
  useEffect(() => {
    if (submitted) {
      successHeadingRef.current?.focus();
    }
  }, [submitted]);

  const handleChange = (field: keyof FounderRequestPayload, value: string) => {
    setPayload((prev) => ({ ...prev, [field]: value }));
    // Clear this field's error as the user edits it.
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  /**
   * Focuses the first control whose field carries an error, using DOM order so
   * it always matches what the reader sees.
   */
  const focusFirstInvalidField = (fieldErrors: FounderRequestErrors) => {
    const form = formRef.current;
    if (!form) return;
    const controls = form.querySelectorAll<HTMLElement>("input[id], textarea[id]");
    for (const control of controls) {
      if (fieldErrors[control.id as keyof FounderRequestErrors]) {
        control.focus();
        return;
      }
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (submitting) return; // prevent double submission

    const validationErrors = validateFounderRequest(payload);
    setErrors(validationErrors);
    if (hasErrors(validationErrors)) {
      // Short form: land the user on the first field that needs fixing rather
      // than leaving focus on the submit button (P2-4).
      focusFirstInvalidField(validationErrors);
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const normalized = normalizePayload(payload);
      const result = await onSubmit(normalized);
      if (result.success) {
        setSubmitted(true);
      } else {
        setSubmitError("We couldn't submit your request right now. Please try again.");
      }
    } catch {
      // Generic on purpose — raw network/server errors are never shown.
      setSubmitError("We couldn't submit your request right now. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <section className="founder-request-card">
        <div className="success-state">
          <CheckCircle className="success-icon" aria-hidden="true" />
          {/* tabIndex makes the heading a valid focus target (see effect above). */}
          <h1 ref={successHeadingRef} tabIndex={-1}>
            Request received
          </h1>
          <p className="success-message">
            Thanks for your interest in hosting events on SalsaSegura.
            We&rsquo;ll review your request before granting access.
          </p>
          <p className="duplicate-notice">
            If you&rsquo;ve already submitted a request, there&rsquo;s no need to submit again.
          </p>
          <Link to="/" className="btn-primary btn-block">
            Return Home
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="founder-request-card">
      <header className="founder-header">
        <h1>Request Host Access</h1>
        <p className="founder-tagline">
          SalsaSegura is gradually opening organizer access to dance brands, venues,
          promoters, and event organizers. Approved hosts will be able to manage and
          promote their events. Submitting a request doesn&rsquo;t create an account —
          requests are reviewed before access is granted.
        </p>
      </header>

      {submitError && (
        <div className="form-error" role="alert">
          {submitError}
        </div>
      )}

      <form ref={formRef} onSubmit={handleSubmit} className="founder-form" noValidate>
        {/* Honeypot: visually hidden, ignored by humans and screen readers;
            bots that fill it get a silent success from the server. */}
        <div className="honeypot" aria-hidden="true">
          <label htmlFor="companyWebsite">Company website</label>
          <input
            id="companyWebsite"
            name="companyWebsite"
            type="text"
            tabIndex={-1}
            autoComplete="off"
            value={payload.companyWebsite ?? ""}
            onChange={(e) => handleChange("companyWebsite", e.target.value)}
            disabled={submitting}
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="applicantName">
              Your name <span className="required" aria-hidden="true">*</span>
            </label>
            <input
              id="applicantName"
              name="applicantName"
              type="text"
              value={payload.applicantName}
              onChange={(e) => handleChange("applicantName", e.target.value)}
              required
              autoComplete="name"
              disabled={submitting}
              aria-invalid={errors.applicantName ? "true" : "false"}
              aria-describedby={errors.applicantName ? "applicantName-error" : undefined}
            />
            <FormFieldError id="applicantName-error" message={errors.applicantName} />
          </div>

          <div className="form-group">
            <label htmlFor="email">
              Email <span className="required" aria-hidden="true">*</span>
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={payload.email}
              onChange={(e) => handleChange("email", e.target.value)}
              required
              autoComplete="email"
              spellCheck={false}
              disabled={submitting}
              aria-invalid={errors.email ? "true" : "false"}
              aria-describedby={errors.email ? "email-error" : undefined}
            />
            <FormFieldError id="email-error" message={errors.email} />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="organizationName">
            Organization / Event Brand <span className="required" aria-hidden="true">*</span>
          </label>
          <input
            id="organizationName"
            name="organizationName"
            type="text"
            value={payload.organizationName}
            onChange={(e) => handleChange("organizationName", e.target.value)}
            required
            autoComplete="organization"
            disabled={submitting}
            aria-invalid={errors.organizationName ? "true" : "false"}
            aria-describedby={errors.organizationName ? "organizationName-error" : undefined}
          />
          <FormFieldError id="organizationName-error" message={errors.organizationName} />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="instagram">Instagram</label>
            <div className="instagram-input">
              <span className="instagram-prefix" aria-hidden="true">@</span>
              <input
                id="instagram"
                name="instagram"
                type="text"
                value={payload.instagram ?? ""}
                onChange={(e) => handleChange("instagram", e.target.value)}
                placeholder="yourhandle"
                autoComplete="off"
                autoCapitalize="none"
                spellCheck={false}
                disabled={submitting}
                aria-invalid={errors.instagram ? "true" : "false"}
                aria-describedby={errors.instagram ? "instagram-error" : "instagram-hint"}
              />
            </div>
            <span id="instagram-hint" className="field-hint">
              Handle only (e.g., salsanights)
            </span>
            <FormFieldError id="instagram-error" message={errors.instagram} />
          </div>

          <div className="form-group">
            <label htmlFor="website">Website</label>
            <input
              id="website"
              name="website"
              type="url"
              value={payload.website ?? ""}
              onChange={(e) => handleChange("website", e.target.value)}
              placeholder="https://example.com"
              autoComplete="url"
              disabled={submitting}
              aria-invalid={errors.website ? "true" : "false"}
              aria-describedby={errors.website ? "website-error" : undefined}
            />
            <FormFieldError id="website-error" message={errors.website} />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="city">City</label>
            <input
              id="city"
              name="city"
              type="text"
              value={payload.city ?? ""}
              onChange={(e) => handleChange("city", e.target.value)}
              autoComplete="address-level2"
              disabled={submitting}
              aria-invalid={errors.city ? "true" : "false"}
              aria-describedby={errors.city ? "city-error" : undefined}
            />
            <FormFieldError id="city-error" message={errors.city} />
          </div>

          <div className="form-group">
            <label htmlFor="region">Region / State</label>
            <input
              id="region"
              name="region"
              type="text"
              value={payload.region ?? ""}
              onChange={(e) => handleChange("region", e.target.value)}
              placeholder="MA, NY, etc."
              autoComplete="address-level1"
              disabled={submitting}
              aria-invalid={errors.region ? "true" : "false"}
              aria-describedby={errors.region ? "region-error" : undefined}
            />
            <FormFieldError id="region-error" message={errors.region} />
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="description">Tell us about your events</label>
          <textarea
            id="description"
            name="description"
            value={payload.description ?? ""}
            onChange={(e) => handleChange("description", e.target.value)}
            rows={4}
            placeholder="What kinds of events do you organize? (socials, classes, festivals, venues, etc.)"
            autoComplete="off"
            disabled={submitting}
            aria-invalid={errors.description ? "true" : "false"}
            aria-describedby={errors.description ? "description-error" : undefined}
          />
          <FormFieldError id="description-error" message={errors.description} />
        </div>

        <div className="form-group">
          <label htmlFor="message">Anything else you&rsquo;d like us to know?</label>
          <textarea
            id="message"
            name="message"
            value={payload.message ?? ""}
            onChange={(e) => handleChange("message", e.target.value)}
            rows={3}
            placeholder="Venue capacity, typical attendance, special requirements, etc."
            autoComplete="off"
            disabled={submitting}
            aria-invalid={errors.message ? "true" : "false"}
            aria-describedby={errors.message ? "message-error" : undefined}
          />
          <FormFieldError id="message-error" message={errors.message} />
        </div>

        <button type="submit" className="btn-primary btn-block founder-submit" disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="btn-spinner" aria-hidden="true" />
              Submitting…
            </>
          ) : (
            "Submit Request"
          )}
        </button>

        <p className="form-footer">
          By submitting, you agree to be contacted about organizer access.
          We don&rsquo;t share your information.
        </p>
      </form>
    </section>
  );
}