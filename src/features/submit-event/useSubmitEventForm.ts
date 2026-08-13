import { useState, FormEvent } from "react";

import { createSubmission } from "../admin/api/submissionsRepo";
import type { EventType } from "../../types/events";
import { useCity } from "../../contexts/useCity";
import { useAuth } from "../../contexts/useAuth";
import { validateSubmitForm, buildInitialForm, SubmitForm } from "./validation";
import { toEventDateInstant } from "../events/model/eventDateTime";

export function useSubmitEventForm() {
  const { city: defaultCity } = useCity();
  const { user } = useAuth();
  const [form, setForm] = useState<SubmitForm>(() => buildInitialForm(defaultCity));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (field: keyof SubmitForm, value: string | string[]) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    // Validate form before submission

    const validationError = validateSubmitForm(form);
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    try {
      const eventDateTime = toEventDateInstant(form.event_date, form.event_time);
      await createSubmission({
        title: form.title,
        description: form.description || null,
        event_type: form.event_type as EventType,
        city: form.city,
        event_date: eventDateTime,
        event_time: form.event_time || null,
        location: form.location || null,
        address: form.address || null,
        price_type:
          form.price_type === "free" || form.price_type === "paid" ? form.price_type : null,
        price_amount: form.price_amount ? parseFloat(form.price_amount) : null,
        rsvp_link: form.rsvp_link || null,
        submitter_name: form.submitter_name || null,
        submitter_email: user!.email ?? null,
        submitter_id: user!.id,
        recurrence: form.recurrence || null,
        dance_styles: form.dance_styles.length > 0 ? form.dance_styles : [],
      });
      setIsSubmitted(true);
      setForm(buildInitialForm(defaultCity));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      console.log("error", message);
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetSubmitted = () => setIsSubmitted(false);

  return { form, update, handleSubmit, isSubmitting, isSubmitted, error, resetSubmitted };
}
