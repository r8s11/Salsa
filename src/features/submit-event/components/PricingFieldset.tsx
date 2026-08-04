import type { SubmitForm } from "../validation";

interface Props {
  form: SubmitForm;
  update: (field: keyof SubmitForm, value: string) => void;
}

export default function PricingFieldset({ form, update }: Props) {
  return (
    <fieldset>
      <legend>Pricing & Link</legend>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="price_type">Price</label>
          <select
            id="price_type"
            value={form.price_type}
            onChange={(e) => update("price_type", e.target.value)}
          >
            <option value="">Select</option>
            <option value="free">Free</option>
            <option value="paid">Paid</option>
          </select>
        </div>

        {form.price_type === "paid" && (
          <div className="form-group">
            <label htmlFor="price_amount">Amount ($)</label>
            <input
              id="price_amount"
              type="number"
              min="0"
              step="0.01"
              placeholder="15.00"
              value={form.price_amount}
              onChange={(e) => update("price_amount", e.target.value)}
            />
          </div>
        )}
      </div>

      <div className="form-group">
        <label htmlFor="rsvp_link">RSVP / Event Link</label>
        <input
          id="rsvp_link"
          type="url"
          placeholder="https://..."
          value={form.rsvp_link}
          onChange={(e) => update("rsvp_link", e.target.value)}
        />
      </div>
    </fieldset>
  );
}
