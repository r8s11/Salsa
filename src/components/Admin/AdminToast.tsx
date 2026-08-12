import { useEffect } from "react";
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
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [onDismiss]);

  const Icon = ICON[tone];
  const role = tone === "error" ? "alert" : "status";

  return (
    <div className={`admin-toast admin-toast--${tone}`} role={role}>
      <Icon size={18} />
      <span className="admin-toast__message">{message}</span>
      <button type="button" className="admin-icon-btn" aria-label="Dismiss" onClick={onDismiss}>
        <X size={16} />
      </button>
    </div>
  );
}
