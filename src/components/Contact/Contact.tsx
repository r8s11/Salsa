import { useState, FormEvent, useRef } from "react";
import FormFieldError from "../../shared/forms/FormFieldError";
import { fieldErrorProps } from "../../shared/forms/fieldErrorProps";
import { publicErrorMessage } from "../../shared/forms/errorMessage";
import "./Contact.css";

interface FormErrors {
  name?: string | null;
  email?: string | null;
  interest?: string | null;
  message?: string | null;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Contact() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    interest: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});

  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const interestRef = useRef<HTMLSelectElement>(null);
  const messageRef = useRef<HTMLTextAreaElement>(null);

  const submitButtonText = isSubmitting
    ? "Sending..."
    : isSubmitted
      ? "Message Sent! ✓"
      : "Send Message";

  const validate = (): FormErrors => {
    const next: FormErrors = {};
    if (!form.name.trim()) next.name = "Please enter your name.";
    if (!form.email.trim()) {
      next.email = "Please enter your email.";
    } else if (!EMAIL_RE.test(form.email.trim())) {
      next.email = "Please enter a valid email address.";
    }
    if (!form.interest) next.interest = "Please choose what you're interested in.";
    if (!form.message.trim()) next.message = "Please enter a message.";
    return next;
  };

  const focusFirstInvalid = (fieldErrors: FormErrors) => {
    if (fieldErrors.name) nameRef.current?.focus();
    else if (fieldErrors.email) emailRef.current?.focus();
    else if (fieldErrors.interest) interestRef.current?.focus();
    else if (fieldErrors.message) messageRef.current?.focus();
  };

  const clearFieldError = (field: keyof FormErrors) => {
    setErrors((prev) => (prev[field] ? { ...prev, [field]: null } : prev));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    const fieldErrors = validate();
    if (Object.values(fieldErrors).some(Boolean)) {
      setErrors(fieldErrors);
      focusFirstInvalid(fieldErrors);
      return;
    }
    setErrors({});
    setIsSubmitting(true);

    const accessKey = import.meta.env.VITE_WEB3FORMS_ACCESS_KEY;

    try {
      const response = await fetch("https://api.web3forms.com/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          access_key: accessKey,
          name: form.name,
          email: form.email,
          interest: form.interest,
          message: form.message,
        }),
      });

      if (!response.ok) {
        throw new Error();
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error();
      }

      setIsSubmitted(true);
      setTimeout(() => {
        setForm({ name: "", email: "", interest: "", message: "" });
        setIsSubmitted(false);
      }, 3000);
    } catch (err) {
      setError(
        publicErrorMessage(err, {
          fallback: "We couldn't send your message. Please try again in a moment.",
          networkFallback:
            "We couldn't send your message. Check your connection and try again.",
        })
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section id="contact" className="contact">
      <div className="container">
        <h1 className="section-title">Ready to Dance?</h1>
        <p className="contact-intro">
          Get in touch — say hello, share an event, or join the floor.
        </p>

        <div className="contact-grid">
          <div className="contact-form-card">
            <h2>📬 Send a Message</h2>
            {error && (
              <div role="alert" className="contact-error-banner">
                {error}
              </div>
            )}
            <form onSubmit={handleSubmit} className="contact-form" noValidate>
              <p className="contact-required-legend">* Required</p>
              <div className="form-group">
                <label htmlFor="name">Name *</label>
                <input
                  id="name"
                  ref={nameRef}
                  value={form.name}
                  onChange={(e) => {
                    setForm({ ...form, name: e.target.value });
                    clearFieldError("name");
                  }}
                  type="text"
                  placeholder="Your name"
                  required
                  {...fieldErrorProps("contact-name-error", errors.name)}
                />
                <FormFieldError id="contact-name-error" message={errors.name} />
              </div>
              <div className="form-group">
                <label htmlFor="email">Email *</label>
                <input
                  id="email"
                  ref={emailRef}
                  value={form.email}
                  onChange={(e) => {
                    setForm({ ...form, email: e.target.value });
                    clearFieldError("email");
                  }}
                  type="email"
                  placeholder="your@email.com"
                  required
                  {...fieldErrorProps("contact-email-error", errors.email)}
                />
                <FormFieldError id="contact-email-error" message={errors.email} />
              </div>
              <div className="form-group">
                <label htmlFor="interest">I'm interested in... *</label>
                <select
                  id="interest"
                  ref={interestRef}
                  value={form.interest}
                  onChange={(e) => {
                    setForm({ ...form, interest: e.target.value });
                    clearFieldError("interest");
                  }}
                  required
                  {...fieldErrorProps("contact-interest-error", errors.interest)}
                >
                  <option value="">Select an option</option>
                  <option value="corporate">Corporate Events</option>
                  <option value="popup">Pop-up Classes</option>
                  <option value="event">Hosting An Event</option>
                  <option value="other">Other</option>
                </select>
                <FormFieldError id="contact-interest-error" message={errors.interest} />
              </div>
              <div className="form-group">
                <label htmlFor="message">Message *</label>
                <textarea
                  id="message"
                  ref={messageRef}
                  value={form.message}
                  onChange={(e) => {
                    setForm({ ...form, message: e.target.value });
                    clearFieldError("message");
                  }}
                  placeholder=""
                  rows={4}
                  required
                  {...fieldErrorProps("contact-message-error", errors.message)}
                ></textarea>
                <FormFieldError id="contact-message-error" message={errors.message} />
              </div>
              <button type="submit" className="btn-primary btn-block" disabled={isSubmitting}>
                {submitButtonText}
              </button>
            </form>
          </div>

          <div className="contact-info-cards">
            <div className="contact-card" style={{ wordBreak: "break-all" }}>
              <div className="contact-icon">📧</div>
              <h2>Email</h2>
              <a
                href="mailto:info@SalsaSegura.com"
                style={{
                  maxWidth: "100%",
                  overflowWrap: "break-word",
                }}
              >
                info@SalsaSegura.com
              </a>
            </div>

            <div className="contact-card">
              <div className="contact-icon">📞</div>
              <h2>Phone</h2>
              <a href="tel:+19784440922">(978) 444-0922</a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Contact;
