import { useRef, useState } from "react";
import type { DragEvent } from "react";
import { UploadCloud } from "lucide-react";
import "./AdminImportDropzone.css";

interface AdminImportDropzoneProps {
  onFileSelected: (file: File) => void;
  disabled?: boolean;
}

export default function AdminImportDropzone({ onFileSelected, disabled = false }: AdminImportDropzoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
    if (disabled) return;
    const file = event.dataTransfer.files[0];
    if (file) onFileSelected(file);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    if (!disabled) setIsDragOver(true);
  };

  const handleDragLeave = () => setIsDragOver(false);

  const handleInputChange = () => {
    const file = inputRef.current?.files?.[0];
    if (file) onFileSelected(file);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div
      className="admin-import-dropzone"
      data-drag-over={isDragOver}
      data-disabled={disabled}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(event) => {
        if (!disabled && (event.key === "Enter" || event.key === " ")) {
          event.preventDefault();
          inputRef.current?.click();
        }
      }}
    >
      <UploadCloud size={28} />
      <p className="admin-import-dropzone__title">Drag and drop your CSV here</p>
      <p className="admin-import-dropzone__hint">or click to choose a file — .csv only</p>
      <input
        ref={inputRef}
        type="file"
        accept=".csv,text/csv"
        className="admin-visually-hidden"
        onChange={handleInputChange}
        disabled={disabled}
        aria-label="Upload CSV file"
      />
    </div>
  );
}
