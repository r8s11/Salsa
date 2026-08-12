import { describe, expect, it } from "vitest";
import { validateSubmitForm, buildInitialForm, type SubmitForm } from "./validation";

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
