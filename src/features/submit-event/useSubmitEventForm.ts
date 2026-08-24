import type { FormEvent } from "react";
import { useState } from "react";
import { createSubmission } from "../admin/api/submissionsRepo";
import { useCity } from "../../contexts/useCity";
import { useAuth } from "../../contexts/useAuth";
import { buildInitialForm, validateSubmitForm } from "./validation";
import { notifyAdminsOfNewSubmission } from "./submissionNotification";
import type { EventFormDraft } from "../events/components/EventForm";
import { draftToSubmission } from "../events/components/EventForm";

function buildSubmitDraft(city: EventFormDraft["city"]): EventFormDraft {
  return {
    ...buildInitialForm(city),
    venue_id: "",
    image_url: "",
    host: "",
    contact_email: "",
    contact_instagram: "",
    contact_website: "",
    taxonomy_term_ids: [],
  };
}

export function useSubmitEventForm() {
  const { city: defaultCity } = useCity();
  const { user } = useAuth();
  const [form, setForm] = useState<EventFormDraft>(() => buildSubmitDraft(defaultCity));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = <K extends keyof EventFormDraft>(field: K, value: EventFormDraft[K]) =>
    setForm((previous) => ({ ...previous, [field]: value }));
  const onChange = (draft: EventFormDraft) => setForm(draft);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const validationError = validateSubmitForm({
      title: form.title,
      description: form.description,
      event_type: form.event_type,
      city: form.city,
      event_date: form.event_date,
      event_time: form.event_time,
      location: form.location,
      address: form.address,
      price_type: form.price_type,
      price_amount: form.price_amount,
      rsvp_link: form.rsvp_link,
      submitter_name: form.submitter_name,
      submitter_email: form.submitter_email,
      recurrence: form.recurrence,
      dance_styles: form.dance_styles,
    });
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSubmitting(true);
    try {
      const submission = draftToSubmission(
        form,
        user ? { id: user.id, email: user.email ?? null } : null
      );
      await createSubmission(submission);
      void notifyAdminsOfNewSubmission(submission);
      setIsSubmitted(true);
      setForm(buildSubmitDraft(defaultCity));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetSubmitted = () => setIsSubmitted(false);

  return { form, update, onChange, handleSubmit, isSubmitting, isSubmitted, error, resetSubmitted };
}
