import { Link } from "react-router-dom";
import { X } from "lucide-react";
import "./QuickEventModal.css";

export type QuickEvent = {
  id: string;
  title: string;
  typeLabel: string;
  /** "class" and "workshop" get the level / style / teacher chips. */
  kind: "social" | "class" | "workshop";
  weekday: string;
  day: string;
  month: string;
  time: string;
  venue: string;
  price: string;
  description: string;
  level?: string;
  style?: string;
  teacher?: string;
};

type Props = {
  event: QuickEvent;
  onClose: () => void;
};

/**
 * Quick look at an event before the full page — opened by feed and
 * calendar cards. Centred on desktop, bottom sheet on mobile.
 */
export default function QuickEventModal({ event, onClose }: Props) {
  const isClass = event.kind === "class" || event.kind === "workshop";

  return (
    <div className="quick-modal" role="dialog" aria-modal="true" aria-label={event.title}>
      <button
        type="button"
        className="quick-modal__scrim"
        aria-label="Close"
        onClick={onClose}
      />
      <div className="quick-modal__sheet">
        <div className="quick-modal__head">
          <div className="quick-modal__date">
            <span className="quick-modal__weekday">{event.weekday}</span>
            <span className="quick-modal__day">{event.day}</span>
            <span className="quick-modal__month">{event.month}</span>
          </div>
          <div className="quick-modal__heading">
            <span className="ss-badge ss-badge--live">{event.typeLabel}</span>
            <h2 className="quick-modal__title">{event.title}</h2>
          </div>
          <button type="button" className="quick-modal__close" aria-label="Close" onClick={onClose}>
            <X size={15} aria-hidden="true" />
          </button>
        </div>

        <div className="quick-modal__facts">
          <span>🕐 {event.time}</span>
          <span>📍 {event.venue}</span>
          <span>💵 {event.price}</span>
        </div>

        {isClass && (
          <div className="ss-chips">
            {event.level && <span className="ss-badge ss-badge--warn">{event.level}</span>}
            {event.style && <span className="ss-badge">{event.style}</span>}
            {event.teacher && <span className="ss-badge">{event.teacher}</span>}
          </div>
        )}

        <p className="quick-modal__desc">{event.description}</p>

        <div className="quick-modal__actions">
          <Link to={`/events/${event.id}`} className="ss-btn ss-btn--primary quick-modal__full">
            Full details
          </Link>
          <button type="button" className="ss-btn ss-btn--ghost" onClick={onClose}>
            Not now
          </button>
        </div>
      </div>
    </div>
  );
}
