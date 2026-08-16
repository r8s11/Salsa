import type { SubmitForm } from "../validation";

interface Props {
  form: SubmitForm;
  update: (field: keyof SubmitForm, value: string) => void;
  email: string;
}

export default function YourInfoFieldset({ form, update, email }: Props) {
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
            value={email || form.submitter_email}
            readOnly={email !== ""}
            required={email === ""}
            onChange={(event) => update("submitter_email", event.target.value)}
          />
        </div>
      </div>
    </fieldset>
  );
}
