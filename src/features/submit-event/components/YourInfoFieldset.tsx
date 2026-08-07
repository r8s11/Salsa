import type { SubmitForm } from "../validation";

interface Props {
  form: SubmitForm;
  update: (field: keyof SubmitForm, value: string) => void;
}

export default function YourInfoFieldset({ form, update }: Props) {
  return (
    <fieldset>
      <legend>Your Info</legend>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="submitter_name">Your Name</label>
          <input
            id="submitter_name"
            type="text"
            placeholder="Your name"
            value={form.submitter_name}
            onChange={(e) => update("submitter_name", e.target.value)}
          />
        </div>
        <div className="form-group">
          <label htmlFor="submitter_email">Your Email</label>
          <input
            id="submitter_email"
            type="email"
            placeholder="your@email.com"
            value={form.submitter_email}
            onChange={(e) => update("submitter_email", e.target.value)}
          />
        </div>
      </div>
    </fieldset>
  );
}
