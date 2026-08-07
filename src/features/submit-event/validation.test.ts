import { describe, it, expect } from "vitest";
import { validateSubmitForm, buildInitialForm, SubmitForm } from "./validation";

const validForm: SubmitForm = {
  ...buildInitialForm("boston"),
  title: "Friday Night Salsa Social",
  description: "A fun night of dancing",
  event_type: "social",
  event_date: "2026-08-01",
  event_time: "20:00",
  location: "Havana Club",
  address: "288 Green St, Cambridge, MA",
  price_type: "free",
  price_amount: "",
  rsvp_link: "https://example.com/rsvp",
  submitter_name: "Jane Doe",
  submitter_email: "jane@example.com",
};

describe("validateSubmitForm", () => {
  it("rejects paid event submitted without an amount", () => {
    const form: SubmitForm = { ...validForm, price_type: "paid", price_amount: "" };
    expect(validateSubmitForm(form)).toBe("Please enter a price amount for paid events.");
  });

  it("rejects negative amount", () => {
    const form: SubmitForm = { ...validForm, price_type: "paid", price_amount: "-5" };
    expect(validateSubmitForm(form)).toBe("Price amount must be a positive number.");
  });

  it("rejects malformed URL", () => {
    const form: SubmitForm = { ...validForm, rsvp_link: "not a url" };
    expect(validateSubmitForm(form)).toBe(
      "Please enter a valid URL for the RSVP link (e.g., https://example.com)."
    );
  });

  it("rejects non-http(s) URL protocol", () => {
    const form: SubmitForm = { ...validForm, rsvp_link: "ftp://example.com/file" };
    expect(validateSubmitForm(form)).toBe("RSVP link must be a valid HTTP or HTTPS URL.");
  });

  it("rejects over-length title", () => {
    const form: SubmitForm = { ...validForm, title: "a".repeat(121) };
    expect(validateSubmitForm(form)).toBe("Event title must be 120 characters or fewer.");
  });

  it("accepts a fully valid form", () => {
    expect(validateSubmitForm(validForm)).toBeNull();
  });
});
