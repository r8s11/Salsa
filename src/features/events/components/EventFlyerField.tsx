import { ChangeEvent, DragEvent, useEffect, useId, useRef, useState } from "react";
import { ImageUp, RotateCw, Trash2, Loader2, AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { validateEventFlyer } from "../api/eventFlyers";
import "./EventFlyerField.css";

export type EventFlyerStatus =
  | "empty"
  | "drag-over"
  | "uploading"
  | "uploaded"
  | "upload-error"
  | "replacing"
  | "removing";

type EventFlyerFieldProps = {
  /** Public URL of an already-persisted flyer (if any). */
  currentUrl: string | null;
  /**
   * Receives the chosen File while the user is composing the form (before the
   * parent uploads it), and `null` when the selection is cleared. The parent is
   * responsible for the actual storage upload and for reporting status back via
   * `status` / `errorMessage`.
   */
  onFileChange: (file: File | null) => void;
  /** Current lifecycle status, owned by the parent. */
  status?: EventFlyerStatus;
  /** Human-readable error shown when status is `upload-error`. */
  errorMessage?: string | null;
  /** Disable all interaction (e.g. while the form is submitting). */
  disabled?: boolean;
  /** Accessible label for the file input. */
  label?: string;
  /** Called when the user asks to remove the current flyer. */
  onRemove?: () => void;
  /** Called from the "Try Again" affordance after an upload failure. */
  onRetry?: () => void;
  /** Optional size caption rendered under an uploaded flyer, e.g. "1.8 MB". */
  sizeCaption?: string | null;
};

export default function EventFlyerField({
  currentUrl,
  onFileChange,
  status = "empty",
  errorMessage = null,
  disabled = false,
  label = "Event flyer",
  onRemove,
  onRetry,
  sizeCaption = null,
}: EventFlyerFieldProps) {
  const inputId = useId();
  const [dragOver, setDragOver] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Local object-URL preview for a freshly chosen (not-yet-uploaded) file.
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const isBusy = status === "uploading" || status === "replacing" || status === "removing";

  const handleFiles = (files: FileList | null) => {
    const nextFile = files?.[0] ?? null;
    if (!nextFile) {
      setValidationError(null);
      setPreviewError(false);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      onFileChange(null);
      return;
    }

    const error = validateEventFlyer(nextFile);
    if (error) {
      setValidationError(error);
      return;
    }

    setValidationError(null);
    setPreviewError(false);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(nextFile));
    onFileChange(nextFile);
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    handleFiles(event.target.files);
    // Allow re-selecting the same file after a validation failure.
    event.target.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(false);
    if (disabled || isBusy) return;
    handleFiles(event.dataTransfer.files);
  };

  const openPicker = () => {
    if (disabled || isBusy) return;
    inputRef.current?.click();
  };

  const handleRemove = () => {
    if (disabled || isBusy) return;
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setPreviewError(false);
    setValidationError(null);
    // No confirmation dialog: this only stages a local draft change (clears
    // the selected file / detaches the current URL from the form draft).
    // Nothing persisted is deleted here — the parent (UserEventEditPage)
    // deletes the previously uploaded storage object via removeEventFlyer
    // only after a save mutation succeeds, so an accidental Remove click is
    // fully recoverable by not saving (or by re-selecting/undoing before
    // Save).
    onFileChange(null);
    onRemove?.();
  };

  const displayUrl = previewUrl ?? currentUrl;
  const showPreview = Boolean(displayUrl) && !previewError;
  const showDropzone = !showPreview || status === "empty";
  const captionText = sizeCaption ?? null;

  // Persist-before-ready: only a persisted flyer (currentUrl) or a confirmed
  // successful upload reads as "ready". A still-local selection reads as
  // "Selected", and a failed upload reads as "Upload failed".
  const stateLabel =
    status === "uploading" || status === "replacing"
      ? "Uploading…"
      : status === "removing"
        ? "Removing…"
        : status === "upload-error"
          ? "Upload failed"
          : status === "uploaded"
            ? "Flyer ready"
            : currentUrl
              ? "Flyer ready"
              : "Selected";

  const alertId = `${inputId}-error`;
  const hasAlert = Boolean(validationError || (status === "upload-error" && errorMessage));

  return (
    <div className="event-flyer-field">
      <label htmlFor={inputId} className="event-flyer-field__label">
        {label}
      </label>
      <p className="event-flyer-field__helper">JPG, PNG, or WebP · up to 5 MB</p>

      {showPreview && (
        <figure className="event-flyer-field__preview" aria-live="polite">
          <img
            src={displayUrl as string}
            alt={previewUrl ? "Selected flyer preview" : "Current event flyer"}
            onError={() => {
              setPreviewError(true);
              if (previewUrl) {
                URL.revokeObjectURL(previewUrl);
                setPreviewUrl(null);
                onFileChange(null);
              }
            }}
          />
          <figcaption className="event-flyer-field__preview-meta">
            <CheckCircle2 size={16} aria-hidden className="event-flyer-field__ok-icon" />
            <span>{stateLabel}</span>
            {captionText && <span className="event-flyer-field__size">· {captionText}</span>}
          </figcaption>
        </figure>
      )}

      {showDropzone && (
        <div
          className={[
            "event-flyer-field__dropzone",
            dragOver ? "event-flyer-field__dropzone--drag" : "",
            isBusy ? "event-flyer-field__dropzone--busy" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onDragOver={(event) => {
            event.preventDefault();
            if (!disabled && !isBusy) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          onClick={openPicker}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              openPicker();
            }
          }}
          role="button"
          tabIndex={disabled ? -1 : 0}
          aria-disabled={disabled || isBusy}
          aria-label="Choose a flyer image to upload"
        >
          {status === "uploading" || status === "replacing" ? (
            <Loader2 size={28} aria-hidden className="event-flyer-field__spinner" />
          ) : (
            <ImageUp size={28} aria-hidden />
          )}
          <span className="event-flyer-field__dropzone-text">
            {status === "uploading"
              ? "Uploading flyer…"
              : status === "replacing"
                ? "Replacing flyer…"
                : "Drop your flyer here"}
          </span>
          <span className="event-flyer-field__dropzone-sub">JPG, PNG or WEBP</span>
          <button
            type="button"
            className="event-flyer-field__choose"
            onClick={(event) => {
              event.stopPropagation();
              openPicker();
            }}
            disabled={disabled || isBusy}
          >
            {previewUrl ? "Choose a different flyer" : "Choose Flyer"}
          </button>
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleChange}
            disabled={disabled || isBusy}
            className="event-flyer-field__input"
            tabIndex={-1}
            aria-hidden
            aria-invalid={hasAlert ? "true" : undefined}
            aria-describedby={hasAlert ? alertId : undefined}
          />
        </div>
      )}

      {showPreview && (currentUrl || previewUrl) && (
        <div className="event-flyer-field__actions">
          <button
            type="button"
            className="event-flyer-field__action event-flyer-field__action--replace"
            onClick={openPicker}
            disabled={disabled || isBusy}
          >
            <RotateCw size={16} aria-hidden /> Replace
          </button>
          {status === "upload-error" && onRetry && (
            <button
              type="button"
              className="event-flyer-field__action event-flyer-field__action--retry"
              onClick={onRetry}
              disabled={disabled}
            >
              <RefreshCw size={16} aria-hidden /> Try Again
            </button>
          )}
          <button
            type="button"
            className="event-flyer-field__action event-flyer-field__action--remove"
            onClick={handleRemove}
            disabled={disabled || isBusy}
          >
            {status === "removing" ? (
              <Loader2 size={16} aria-hidden className="event-flyer-field__spinner" />
            ) : (
              <Trash2 size={16} aria-hidden />
            )}
            Remove
          </button>
        </div>
      )}

      {hasAlert && (
        <p className="event-flyer-field__alert" id={alertId} role="alert">
          <AlertTriangle size={16} aria-hidden />
          {validationError ?? errorMessage}
        </p>
      )}
    </div>
  );
}
