import { useCallback, useEffect, useRef } from "react";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";
import "./AdminToast.css";

const AUTO_DISMISS_MS = 4000;

const ICON = { success: CheckCircle2, error: XCircle, info: Info } as const;

export default function AdminToast({
  message,
  tone = "success",
  onDismiss,
}: {
  message: string;
  tone?: "success" | "error" | "info";
  onDismiss: () => void;
}) {
  const timerRef = useRef(0);
  const pausedRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current != null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = 0;
    }
  }, []);

  const startTimer = useCallback(() => {
    clearTimer();
    timerRef.current = window.setTimeout(onDismiss, AUTO_DISMISS_MS);
  }, [onDismiss, clearTimer]);

  useEffect(() => {
    startTimer();
    return clearTimer;
  }, [startTimer, clearTimer]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onDismiss]);

  const Icon = ICON[tone];
  const role = tone === "error" ? "alert" : "status";

  return (
    <div
      className={`admin-toast admin-toast--${tone}`}
      role={role}
      onMouseEnter={() => {
        pausedRef.current = true;
        clearTimer();
      }}
      onMouseLeave={() => {
        pausedRef.current = false;
        startTimer();
      }}
      onFocus={() => {
        pausedRef.current = true;
        clearTimer();
      }}
      onBlur={() => {
        pausedRef.current = false;
        startTimer();
      }}
    >
      <Icon size={18} />
      <span className="admin-toast__message">{message}</span>
      <button type="button" className="admin-icon-btn" aria-label="Dismiss" onClick={onDismiss}>
        <X size={16} />
      </button>
    </div>
  );
}
