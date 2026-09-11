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
      <div className="flex items-center justify-between">
        <label className="font-medium">{label}</label>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="admin-chip flex items-center gap-1"
          aria-expanded={isOpen}
        >
          Edited {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      </div>
      <div className="font-medium">{value}</div>
      {isOpen && (
        <div className="admin-card mt-2 p-2 text-sm bg-gray-50">
          <div className="text-xs text-gray-500">Original value:</div>
          <div className="text-gray-700">{originalValue}</div>
          <div className="text-xs text-gray-500 mt-2">Updated value:</div>
          <div className="text-gray-700">{value}</div>
        </div>
      )}
    </div>
  );
}
