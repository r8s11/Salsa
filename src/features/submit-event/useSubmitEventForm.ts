import { useState, FormEvent } from "react";
import { submitEvent } from "../events/api/eventsRepo";
import type { EventType } from "../../types/events";
import { useCity } from "../../contexts/CityContext";
import { validateSubmitForm, buildInitialForm, SubmitForm } from "./validation";

export function useSubmitEventForm() {
  const { city: defaultCity } = useCity();
  const [form, setForm] = useState<SubmitForm>(() => buildInitialForm(defaultCity));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (field: keyof SubmitForm, value: string) =>
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
      // Combine date + time into an ISO timestamp
      const eventDateTime = form.event_time
        ? `${form.event_date}T${form.event_time}:00`
        : `${form.event_date}T00:00:00`;

      await submitEvent({
        title: form.title,
        description: form.description || null,
        event_type: form.event_type as EventType,
        city: form.city,
        event_date: eventDateTime,
        event_time: form.event_time || null,
        location: form.location || null,
        address: form.address || null,
        price_type: (form.price_type === "free" || form.price_type === "paid") ? form.price_type : null,
        price_amount: form.price_amount ? parseFloat(form.price_amount) : null,
        rsvp_link: form.rsvp_link || null,
        submitter_name: form.submitter_name || null,
        submitter_email: form.submitter_email || null,
      });
      setIsSubmitted(true);
      setForm(buildInitialForm(defaultCity));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetSubmitted = () => setIsSubmitted(false);

  return { form, update, handleSubmit, isSubmitting, isSubmitted, error, resetSubmitted };
}
