import { ArrowDown, ArrowUp } from "lucide-react";
import type { OfferingStatus } from "../model";

type OfferingActionsProps = {
  /** What the row is, e.g. "Salsa On2" — spoken in every control's name. */
  name: string;
  status: OfferingStatus;
  disabled?: boolean;
  onEdit: () => void;
  onToggleStatus: () => void;
  onDelete: () => void;
  move?: { canUp: boolean; canDown: boolean; onUp: () => void; onDown: () => void };
};

/** Row controls: edit, pause or resume, delete, and (ordered lists) move. */
export default function OfferingActions({
  name,
  status,
  disabled = false,
  onEdit,
  onToggleStatus,
  onDelete,
  move,
}: OfferingActionsProps) {
  return (
    <div className="ws-row__actions">
      {move && (
        <span className="ws-row__move">
          <button
            type="button"
            className="desk__action ws-row__icon"
            aria-label={`Move ${name} up`}
            disabled={disabled || !move.canUp}
            onClick={move.onUp}
          >
            <ArrowUp size={15} aria-hidden />
          </button>
          <button
            type="button"
            className="desk__action ws-row__icon"
            aria-label={`Move ${name} down`}
            disabled={disabled || !move.canDown}
            onClick={move.onDown}
          >
            <ArrowDown size={15} aria-hidden />
          </button>
        </span>
      )}
      <button
        type="button"
        className="desk__action"
        aria-label={`Edit ${name}`}
        disabled={disabled}
        onClick={onEdit}
      >
        Edit
      </button>
      <button
        type="button"
        className="desk__action"
        aria-label={`${status === "active" ? "Pause" : "Resume"} ${name}`}
        disabled={disabled}
        onClick={onToggleStatus}
      >
        {status === "active" ? "Pause" : "Resume"}
      </button>
      <button
        type="button"
        className="desk__action"
        aria-label={`Delete ${name}`}
        disabled={disabled}
        onClick={onDelete}
      >
        Delete
      </button>
    </div>
  );
}
