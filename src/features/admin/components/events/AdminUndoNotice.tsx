import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import "./AdminUndoNotice.css";

const UNDO_WINDOW_MS = 6000;

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))
  );
}

interface AdminUndoNoticeProps {
  message: string;
  /** Omit for a plain confirmation that has nothing to undo. */
  onUndo?: () => void;
  onDismiss: () => void;
}

/**
 * The outcome of a decision, docked with the list rather than floating over it.
 * The message is also announced by the page's live region; this copy is
 * visual only. Undo stays reachable for six seconds by pointer, by Tab, and
 * by Ctrl/Cmd+Z, and the clock pauses while the notice is hovered or focused.
 */
export default function AdminUndoNotice({ message, onUndo, onDismiss }: AdminUndoNoticeProps) {
  const timerRef = useRef(0);
  const onDismissRef = useRef(onDismiss);
  const onUndoRef = useRef(onUndo);
  useEffect(() => {
    onDismissRef.current = onDismiss;
    onUndoRef.current = onUndo;
  });

  const stop = () => window.clearTimeout(timerRef.current);
  const start = () => {
    stop();
    timerRef.current = window.setTimeout(() => onDismissRef.current(), UNDO_WINDOW_MS);
  };

  // The page keys this component by notice, so mounting is the start of the window.
  useEffect(() => {
    timerRef.current = window.setTimeout(() => onDismissRef.current(), UNDO_WINDOW_MS);
    return () => window.clearTimeout(timerRef.current);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== "z" || !(event.ctrlKey || event.metaKey) || event.shiftKey) {
        return;
      }
      if (!onUndoRef.current || isTypingTarget(event.target)) return;
      event.preventDefault();
      onUndoRef.current();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div
      className="admin-events-notice"
      onMouseEnter={stop}
      onMouseLeave={start}
      onFocus={stop}
      onBlur={start}
    >
      <p className="admin-events-notice__message" aria-hidden="true">
        {message}
      </p>
      {onUndo && (
        <button
          type="button"
          className="admin-events-notice__undo"
          aria-keyshortcuts="Control+Z Meta+Z"
          onClick={onUndo}
        >
          Undo
        </button>
      )}
      <button
        type="button"
        className="admin-icon-btn admin-events-notice__dismiss"
        aria-label="Dismiss"
        onClick={onDismiss}
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
