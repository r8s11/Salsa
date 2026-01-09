import { useState, FormEvent } from "react";
import "./Contact.css";

function Contact() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    interest: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const submitButtonText = isSubmitting
    ? "Sending..."
    : isSubmitted
    ? "Message Sent! ✓"
    : "Send Message";

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    const accessKey = import.meta.env.VITE_WEB3FORMS_ACCESS_KEY;
    console.log("Access Key:", accessKey);

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

    const result = await response.json();
    if (result.success) {
      console.log("Success:", result);
    } else {
      console.error("Failed:", result);
    }

    setIsSubmitting(false);
    setIsSubmitted(true);

    setTimeout(() => {
      setForm({ name: "", email: "", interest: "", message: "" });
      setIsSubmitted(false);
    }, 3000);
  };

  return (
    <section id="contact" className="contact">
      <div className="container">
        <h2 className="section-title">Ready to Dance?</h2>
        <p className="contact-intro">Contact us!</p>

        <div className="contact-grid">
          <div className="contact-form-card">
            <h3>📬 Send a Message</h3>
            <form onSubmit={handleSubmit} className="contact-form">
              <div className="form-group">
                <label htmlFor="name">Name</label>
                <input
                  id="name"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  type="text"
                  placeholder="Your name"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="email">Email</label>
                <input
                  id="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  type="email"
                  placeholder="your@email.com"
                  required
                />
              </div>
              <div className="form-group">
                <label htmlFor="interest">I'm interested in...</label>
                <select
                  id="interest"
                  value={form.interest}
                  onChange={(e) =>
                    setForm({ ...form, interest: e.target.value })
                  }
                  required
                >
                  <option value="">Select an option</option>
                  <option value="corporate">Corporate Events</option>
                  <option value="popup">Pop-up Classes</option>
                  <option value="event">Hosting An Event</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="message">Message</label>
                <textarea
                  id="message"
                  value={form.message}
                  onChange={(e) =>
                    setForm({ ...form, message: e.target.value })
                  }
                  placeholder=""
                  rows={4}
                  required
                ></textarea>
              </div>
              <button
                type="submit"
                className="submit-button"
                disabled={isSubmitting}
              >
                {submitButtonText}
              </button>
            </form>
          </div>

          <div className="contact-info-cards">
            <div className="contact-card" style={{ wordBreak: "break-all" }}>
              <div className="contact-icon">📧</div>
              <h3>Email</h3>
              <a
                href="mailto:info@SalsaSegura.com"
                style={{
                  display: "inline-block",
                  maxWidth: "100%",
                  overflowWrap: "break-word",
                }}
              >
                info@SalsaSegura.com
              </a>
            </div>

            <div className="contact-card">
              <div className="contact-icon">📞</div>
              <h3>Phone</h3>
              <a href="tel:+19784440922">(978) 444-0922</a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Contact;
