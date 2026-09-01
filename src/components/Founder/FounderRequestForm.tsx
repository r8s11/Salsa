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

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (submitting) return; // prevent double submission

    const validationErrors = validateFounderRequest(payload);
    setErrors(validationErrors);
    if (hasErrors(validationErrors)) return;

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

      <form onSubmit={handleSubmit} className="founder-form" noValidate>
        {/* Honeypot: visually hidden, ignored by humans and screen readers;
            bots that fill it get a silent success from the server. */}
        <div className="honeypot" aria-hidden="true">
          <label htmlFor="companyWebsite">Company website</label>
          <input
            id="companyWebsite"
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
              type="text"
              value={payload.applicantName}
              onChange={(e) => handleChange("applicantName", e.target.value)}
              required
              autoComplete="name"
              disabled={submitting}
              aria-invalid={errors.applicantName ? "true" : "false"}
              aria-describedby={errors.applicantName ? "applicantName-error" : undefined}
            />
            {errors.applicantName && (
              <span id="applicantName-error" className="field-error" role="alert">
                {errors.applicantName}
              </span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="email">
              Email <span className="required" aria-hidden="true">*</span>
            </label>
            <input
              id="email"
              type="email"
              value={payload.email}
              onChange={(e) => handleChange("email", e.target.value)}
              required
              autoComplete="email"
              disabled={submitting}
              aria-invalid={errors.email ? "true" : "false"}
              aria-describedby={errors.email ? "email-error" : undefined}
            />
            {errors.email && (
              <span id="email-error" className="field-error" role="alert">
                {errors.email}
              </span>
            )}
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="organizationName">
            Organization / Event Brand <span className="required" aria-hidden="true">*</span>
          </label>
          <input
            id="organizationName"
            type="text"
            value={payload.organizationName}
            onChange={(e) => handleChange("organizationName", e.target.value)}
            required
            autoComplete="organization"
            disabled={submitting}
            aria-invalid={errors.organizationName ? "true" : "false"}
            aria-describedby={errors.organizationName ? "organizationName-error" : undefined}
          />
          {errors.organizationName && (
            <span id="organizationName-error" className="field-error" role="alert">
              {errors.organizationName}
            </span>
          )}
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="instagram">Instagram</label>
            <div className="instagram-input">
              <span className="instagram-prefix" aria-hidden="true">@</span>
              <input
                id="instagram"
                type="text"
                value={payload.instagram ?? ""}
                onChange={(e) => handleChange("instagram", e.target.value)}
                placeholder="yourhandle"
                disabled={submitting}
                aria-invalid={errors.instagram ? "true" : "false"}
                aria-describedby={errors.instagram ? "instagram-error" : "instagram-hint"}
              />
            </div>
            <span id="instagram-hint" className="field-hint">
              Handle only (e.g., salsanights)
            </span>
            {errors.instagram && (
              <span id="instagram-error" className="field-error" role="alert">
                {errors.instagram}
              </span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="website">Website</label>
            <input
              id="website"
              type="url"
              value={payload.website ?? ""}
              onChange={(e) => handleChange("website", e.target.value)}
              placeholder="https://example.com"
              disabled={submitting}
              aria-invalid={errors.website ? "true" : "false"}
              aria-describedby={errors.website ? "website-error" : undefined}
            />
            {errors.website && (
              <span id="website-error" className="field-error" role="alert">
                {errors.website}
              </span>
            )}
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label htmlFor="city">City</label>
            <input
              id="city"
              type="text"
              value={payload.city ?? ""}
              onChange={(e) => handleChange("city", e.target.value)}
              disabled={submitting}
              aria-invalid={errors.city ? "true" : "false"}
              aria-describedby={errors.city ? "city-error" : undefined}
            />
            {errors.city && (
              <span id="city-error" className="field-error" role="alert">
                {errors.city}
              </span>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="region">Region / State</label>
            <input
              id="region"
              type="text"
              value={payload.region ?? ""}
              onChange={(e) => handleChange("region", e.target.value)}
              placeholder="MA, NY, etc."
              disabled={submitting}
              aria-invalid={errors.region ? "true" : "false"}
              aria-describedby={errors.region ? "region-error" : undefined}
            />
            {errors.region && (
              <span id="region-error" className="field-error" role="alert">
                {errors.region}
              </span>
            )}
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="description">Tell us about your events</label>
          <textarea
            id="description"
            value={payload.description ?? ""}
            onChange={(e) => handleChange("description", e.target.value)}
            rows={4}
            placeholder="What kinds of events do you organize? (socials, classes, festivals, venues, etc.)"
            disabled={submitting}
            aria-invalid={errors.description ? "true" : "false"}
            aria-describedby={errors.description ? "description-error" : undefined}
          />
          {errors.description && (
            <span id="description-error" className="field-error" role="alert">
              {errors.description}
            </span>
          )}
        </div>

        <div className="form-group">
          <label htmlFor="message">Anything else you&rsquo;d like us to know?</label>
          <textarea
            id="message"
            value={payload.message ?? ""}
            onChange={(e) => handleChange("message", e.target.value)}
            rows={3}
            placeholder="Venue capacity, typical attendance, special requirements, etc."
            disabled={submitting}
            aria-invalid={errors.message ? "true" : "false"}
            aria-describedby={errors.message ? "message-error" : undefined}
          />
          {errors.message && (
            <span id="message-error" className="field-error" role="alert">
              {errors.message}
            </span>
          )}
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