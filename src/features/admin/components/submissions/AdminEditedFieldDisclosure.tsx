import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

export default function AdminEditedFieldDisclosure({
  label,
  value,
  originalValue,
}: {
  label: string;
  value: string;
  originalValue: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="admin-field">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <label style={{ fontWeight: 500 }}>{label}</label>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="admin-chip"
          style={{ display: "flex", alignItems: "center", gap: "var(--admin-space-1)" }}
          aria-expanded={isOpen}
        >
          Edited {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      </div>
      <div style={{ fontWeight: 500 }}>{value}</div>
      {isOpen && (
        <div
          className="admin-card"
          style={{ marginTop: "var(--admin-space-2)", padding: "var(--admin-space-2)" }}
        >
          <div className="admin-text-xs" style={{ color: "var(--admin-text-secondary)" }}>
            Original value:
          </div>
          <div style={{ color: "var(--admin-text-secondary)" }}>{originalValue}</div>
          <div
            className="admin-text-xs"
            style={{ color: "var(--admin-text-secondary)", marginTop: "var(--admin-space-2)" }}
          >
            Updated value:
          </div>
          <div style={{ color: "var(--admin-text-secondary)" }}>{value}</div>
        </div>
      )}
    </div>
  );
}
