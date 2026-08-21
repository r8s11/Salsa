import { ChangeEvent, useEffect, useState } from "react";
import { validateEventFlyer } from "../api/eventFlyers";
import "./EventFlyerField.css";

type EventFlyerFieldProps = {
  currentUrl: string | null;
  onFileChange: (file: File | null) => void;
  disabled?: boolean;
};

export default function EventFlyerField({
  currentUrl,
  onFileChange,
  disabled = false,
}: EventFlyerFieldProps) {
  const [validationError, setValidationError] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    },
    [previewUrl]
  );

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;
    if (!nextFile) {
      setValidationError(null);
      setPreviewError(false);
      setPreviewUrl(null);
      onFileChange(null);
      return;
    }

    const error = validateEventFlyer(nextFile);
    if (error) {
      event.target.value = "";
      setValidationError(error);
      return;
    }

    setValidationError(null);
    setPreviewError(false);
    setPreviewUrl(URL.createObjectURL(nextFile));
    onFileChange(nextFile);
  };

  const imageUrl = previewUrl ?? currentUrl;

  return (
    <div className="event-flyer-field">
      <label htmlFor="event-flyer">Event flyer</label>
      <p className="event-flyer-field__helper">JPEG, PNG, or WebP · up to 5 MB</p>
      {imageUrl && !previewError && (
        <img
          className="event-flyer-field__preview"
          src={imageUrl}
          alt="Event flyer preview"
          onError={() => {
            setPreviewError(true);
            if (previewUrl) {
              URL.revokeObjectURL(previewUrl);
              setPreviewUrl(null);
              onFileChange(null);
            }
          }}
        />
      )}
      <input
        id="event-flyer"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleChange}
        disabled={disabled}
      />
      {(validationError || previewError) && (
        <p role="alert">
          {validationError ?? "The current flyer couldn't load. Choose a replacement image."}
        </p>
      )}
    </div>
  );
}
