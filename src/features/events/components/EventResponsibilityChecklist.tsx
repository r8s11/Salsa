import { EVENT_RESPONSIBILITIES, type EventResponsibilityAck } from "../model/eventResponsibility";
import "./EventResponsibilityChecklist.css";

type Props = { value: EventResponsibilityAck; onChange: (value: EventResponsibilityAck) => void; disabled?: boolean };
export default function EventResponsibilityChecklist({ value, onChange, disabled = false }: Props) {
  return (
    <fieldset className="event-responsibility" disabled={disabled}>
      <legend>Before you publish</legend>
      {EVENT_RESPONSIBILITIES.map(([key, label]) => (
        <label key={key} className="event-responsibility__check">
          <input type="checkbox" checked={value[key]} onChange={(event) => onChange({ ...value, [key]: event.target.checked })} />
          <span>{label}</span>
        </label>
      ))}
      <p>Required to publish, not to save a private draft. These acknowledgements do not replace event terms or transfer every legal responsibility.</p>
    </fieldset>
  );
}
