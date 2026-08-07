import type { SubmitForm } from "../validation";

interface Props {
  form: SubmitForm;
  update: (field: keyof SubmitForm, value: string) => void;
}

export default function LocationFieldset({ form, update }: Props) {
  return (
    <fieldset>
      <legend>Location</legend>

      <div className="form-group">
        <label htmlFor="location">Venue Name</label>
        <input
          id="location"
          type="text"
          placeholder="e.g. Havana Club"
          value={form.location}
          onChange={(e) => update("location", e.target.value)}
        />
      </div>

      <div className="form-group">
        <label htmlFor="address">Address</label>
        <input
          id="address"
          type="text"
          placeholder="e.g. 288 Green St, Cambridge, MA"
          value={form.address}
          onChange={(e) => update("address", e.target.value)}
        />
      </div>
    </fieldset>
  );
}
