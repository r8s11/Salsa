import { describe, expect, it } from "vitest";
import {
  validateSubmitForm,
  validateSubmitFormFields,
  buildInitialForm,
  type SubmitForm,
} from "./validation";
import type { City } from "../../types/events";

describe("validateSubmitForm — dance_styles", () => {
  const validForm = (): SubmitForm => ({
    ...buildInitialForm("boston"),
    title: "Test Event",
    event_type: "social",
    event_date: "2026-08-20",
    event_time: "20:00",
  });

  it("passes with a reasonable number of dance styles", () => {
    const form = validForm();
    form.dance_styles = ["salsa", "bachata"];
    expect(validateSubmitForm(form)).toBeNull();
  });

  it("passes with an empty dance styles array", () => {
    const form = validForm();
    form.dance_styles = [];
    expect(validateSubmitForm(form)).toBeNull();
  });

  it("rejects more than 10 dance styles", () => {
    const form = validForm();
    form.dance_styles = Array.from({ length: 11 }, (_, i) => `style-${i}`);
    expect(validateSubmitForm(form)).toBe("You can select up to 10 dance styles.");
  });

  it("passes with exactly 10 dance styles", () => {
    const form = validForm();
    form.dance_styles = Array.from({ length: 10 }, (_, i) => `style-${i}`);
    expect(validateSubmitForm(form)).toBeNull();
  });
});

describe("validateSubmitFormFields", () => {
  const validForm = (): SubmitForm => ({
    ...buildInitialForm("boston"),
    title: "Test Event",
    event_type: "social",
    event_date: "2026-08-20",
    event_time: "20:00",
  });

  it("returns no errors for a fully valid form", () => {
    expect(validateSubmitFormFields(validForm())).toEqual({});
  });

  it("reports every missing required field at once, including event type and city", () => {
    const form = { ...buildInitialForm("boston" as City), city: "" as unknown as City };
    const errors = validateSubmitFormFields(form);

    expect(errors.title).toMatch(/enter an event title/i);
    expect(errors.event_type).toBe("Choose an event type.");
    expect(errors.city).toBe("Choose a city.");
    expect(errors.event_date).toBe("Choose an event date.");
    // Fields without a specific rule triggered are absent, not empty strings.
    expect(errors.description).toBeUndefined();
  });

  it("does not require a future event date — no date is ever rejected for being in the past", () => {
    const form = { ...validForm(), event_date: "2000-01-01" };
    expect(validateSubmitFormFields(form).event_date).toBeUndefined();
  });

  it("rejects a title over the max length independently of other fields", () => {
    const form = { ...validForm(), title: "x".repeat(121) };
    const errors = validateSubmitFormFields(form);
    expect(errors.title).toBe("Event title must be 120 characters or fewer.");
    expect(errors.event_type).toBeUndefined();
  });

  it("rejects more than 10 dance styles", () => {
    const form = validForm();
    form.dance_styles = Array.from({ length: 11 }, (_, i) => `style-${i}`);
    expect(validateSubmitFormFields(form).dance_styles).toBe(
      "You can select up to 10 dance styles."
    );
  });

  it("requires a positive price amount for paid events", () => {
    const form = { ...validForm(), price_type: "paid" as const, price_amount: "" };
    expect(validateSubmitFormFields(form).price_amount).toBe(
      "Please enter a price amount for paid events."
    );

    const negative = { ...validForm(), price_type: "paid" as const, price_amount: "-5" };
    expect(validateSubmitFormFields(negative).price_amount).toBe(
      "Price amount must be a positive number."
    );
  });

  it("rejects a non-http(s) RSVP link", () => {
    const form = { ...validForm(), rsvp_link: "ftp://example.com" };
    expect(validateSubmitFormFields(form).rsvp_link).toBe(
      "RSVP link must be a valid HTTP or HTTPS URL."
    );
  });

  it("rejects a malformed RSVP link", () => {
    const form = { ...validForm(), rsvp_link: "not a url" };
    expect(validateSubmitFormFields(form).rsvp_link).toBe(
      "Please enter a valid URL for the RSVP link (e.g., https://example.com)."
    );
  });

  it("requires anonymous submitter name and email, together with other errors", () => {
    const form = { ...validForm() };
    const errors = validateSubmitFormFields(form, true);
    expect(errors.submitter_name).toMatch(/name/i);
    expect(errors.submitter_email).toMatch(/email/i);
    // Anonymous-only rules do not block unrelated required-field checks.
    expect(errors.title).toBeUndefined();
  });

  it("rejects a malformed anonymous submitter email", () => {
    const form = {
      ...validForm(),
      submitter_name: "Anon Dancer",
      submitter_email: "not-an-email",
    };
    expect(validateSubmitFormFields(form, true).submitter_email).toMatch(/valid email/i);
  });

  it("leaves submitter contact optional for an authenticated submitter", () => {
    expect(validateSubmitFormFields(validForm(), false)).toEqual({});
  });
});
