import { ChangeEvent, DragEvent, useId, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  ImageUp,
  Loader2,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { validateEventFlyer } from "../api/eventFlyers";
import { MAX_FLYERS_PER_EVENT } from "../model/eventFlyers";
import "./EventFlyerField.css";
import "./EventFlyersField.css";

export type FlyerItem = {
  id: string;
  /** Preview/persisted URL. May be empty while nothing is previewable yet. */
  url: string;
  status?: "uploading" | "uploaded" | "upload-error" | "removing";
  errorMessage?: string | null;
  /** Optional size caption rendered under the tile, e.g. "1.8 MB". */
  sizeCaption?: string | null;
};

export type EventFlyersFieldProps = {
  /** Ordered flyers; `items[0]` is the PRIMARY flyer. */
  items: FlyerItem[];
  /** Receives only files that passed validation and fit under the cap. */
  onAddFiles: (files: File[]) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, direction: "earlier" | "later") => void;
  onRetry?: (id: string) => void;
  disabled?: boolean;
  label?: string;
};

const OVER_CAP_MESSAGE = `You can add up to ${MAX_FLYERS_PER_EVENT} flyers.`;

export default function EventFlyersField({
  items,
  onAddFiles,
  onRemove,
  onMove,
  onRetry,
  disabled = false,
  label = "Event flyers",
}: EventFlyersFieldProps) {
  const inputId = useId();
  const alertId = `${inputId}-error`;
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [messages, setMessages] = useState<string[]>([]);

  const remaining = Math.max(0, MAX_FLYERS_PER_EVENT - items.length);
  const isFull = remaining === 0;
  const hasUploading = items.some((item) => item.status === "uploading");

  const handleFiles = (list: FileList | File[] | null) => {
    const files = list ? Array.from(list) : [];
    if (files.length === 0) return;

    const errors: string[] = [];
    const valid: File[] = [];
    for (const file of files) {
      const error = validateEventFlyer(file);
      if (error) errors.push(`${file.name}: ${error}`);
      else valid.push(file);
    }

    const accepted = valid.slice(0, remaining);
    if (accepted.length < valid.length) errors.push(OVER_CAP_MESSAGE);

    setMessages(errors);
    if (accepted.length > 0) onAddFiles(accepted);
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    handleFiles(event.target.files);
    // Allow re-selecting the same file after a validation failure.
    event.target.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragOver(false);
    if (disabled || isFull) return;
    handleFiles(event.dataTransfer.files);
  };

  const openPicker = () => {
    if (disabled || isFull) return;
    inputRef.current?.click();
  };

  const hasAlert = messages.length > 0;

  return (
    <div className="event-flyers-field">
      <label htmlFor={inputId} className="event-flyer-field__label">
        {label}
      </label>
      <p className="event-flyer-field__helper">
        JPG, PNG, or WebP · up to 5 MB each · the first flyer is the primary
      </p>
      <p className="event-flyers-field__count" aria-live="polite">
        {items.length} of {MAX_FLYERS_PER_EVENT} flyers
      </p>

      {items.length > 0 && (
        <ul className="event-flyers-field__grid" aria-label="Flyer order">
          {items.map((item, index) => {
            const position = index + 1;
            const isUploading = item.status === "uploading";
            const isRemoving = item.status === "removing";
            const isError = item.status === "upload-error";
            const locked = disabled || isUploading || isRemoving;
            return (
              <li
                key={item.id}
                className={[
                  "event-flyers-field__tile",
                  isError ? "event-flyers-field__tile--error" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <div className="event-flyers-field__thumb">
                  {item.url ? (
                    <img src={item.url} alt={`Flyer ${position}`} />
                  ) : (
                    <span
                      className="event-flyers-field__placeholder"
                      role="img"
                      aria-label={`Flyer ${position} (no preview yet)`}
                    >
                      <ImageUp size={28} aria-hidden />
                    </span>
                  )}
                  {index === 0 && <span className="event-flyers-field__badge">Primary</span>}
                  {(isUploading || isRemoving) && (
                    <span className="event-flyers-field__overlay" role="status">
                      <Loader2 size={24} aria-hidden className="event-flyer-field__spinner" />
                      <span>{isRemoving ? "Removing…" : "Uploading…"}</span>
                    </span>
                  )}
                </div>
                {(isError || item.sizeCaption) && (
                  <p className="event-flyers-field__caption">
                    {isError && "Upload failed"}
                    {isError && item.sizeCaption && " · "}
                    {item.sizeCaption}
                  </p>
                )}
                {isError && item.errorMessage && (
                  <p className="event-flyer-field__alert" role="alert">
                    <AlertTriangle size={16} aria-hidden />
                    {item.errorMessage}
                  </p>
                )}
                <div className="event-flyers-field__actions">
                  <button
                    type="button"
                    className="event-flyers-field__btn"
                    aria-label={`Move flyer ${position} earlier`}
                    onClick={() => onMove(item.id, "earlier")}
                    disabled={locked || index === 0}
                  >
                    <ArrowLeft size={18} aria-hidden />
                  </button>
                  <button
                    type="button"
                    className="event-flyers-field__btn"
                    aria-label={`Move flyer ${position} later`}
                    onClick={() => onMove(item.id, "later")}
                    disabled={locked || index === items.length - 1}
                  >
                    <ArrowRight size={18} aria-hidden />
                  </button>
                  {isError && onRetry && (
                    <button
                      type="button"
                      className="event-flyers-field__btn event-flyers-field__btn--retry"
                      aria-label={`Retry flyer ${position}`}
                      onClick={() => onRetry(item.id)}
                      disabled={disabled}
                    >
                      <RefreshCw size={18} aria-hidden />
                    </button>
                  )}
                  <button
                    type="button"
                    className="event-flyers-field__btn event-flyers-field__btn--remove"
                    aria-label={`Remove flyer ${position}`}
                    onClick={() => onRemove(item.id)}
                    disabled={locked}
                  >
                    <Trash2 size={18} aria-hidden />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {!isFull && (
        <div
          className={[
            "event-flyer-field__dropzone",
            dragOver ? "event-flyer-field__dropzone--drag" : "",
            disabled ? "event-flyer-field__dropzone--busy" : "",
          ]
            .filter(Boolean)
            .join(" ")}
          onDragOver={(event) => {
            event.preventDefault();
            if (!disabled) setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          {hasUploading ? (
            <Loader2 size={28} aria-hidden className="event-flyer-field__spinner" />
          ) : (
            <ImageUp size={28} aria-hidden />
          )}
          <span className="event-flyer-field__dropzone-text">
            {items.length === 0 ? "Drop your flyers here" : "Drop more flyers here"}
          </span>
          <span className="event-flyer-field__dropzone-sub">
            {remaining === 1 ? "1 more flyer" : `Up to ${remaining} more flyers`}
          </span>
          <button
            type="button"
            className="event-flyer-field__choose event-flyers-field__add"
            onClick={openPicker}
            disabled={disabled}
          >
            <ImageUp size={16} aria-hidden /> Add flyer
          </button>
        </div>
      )}

      {/* Always mounted so the label stays associated; disabled at the cap. */}
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp"
        onChange={handleChange}
        disabled={disabled || isFull}
        className="event-flyer-field__input"
        tabIndex={-1}
        aria-hidden
        aria-invalid={hasAlert ? "true" : undefined}
        aria-describedby={hasAlert ? alertId : undefined}
      />

      {hasAlert && (
        <div className="event-flyers-field__alerts" id={alertId} role="alert">
          {messages.map((message) => (
            <p key={message} className="event-flyer-field__alert">
              <AlertTriangle size={16} aria-hidden />
              {message}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
