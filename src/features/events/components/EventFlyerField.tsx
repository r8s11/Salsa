import { ChangeEvent, useEffect, useState } from "react";
import { validateEventFlyer } from "../api/eventFlyers";

type EventFlyerFieldProps = {
  currentUrl: string | null;
  file: File | null;
  onFileChange: (file: File | null) => void;
  disabled?: boolean;
};

export default function EventFlyerField({
  currentUrl,
  file,
  onFileChange,
  disabled = false,
}: EventFlyerFieldProps) {
  const [validationError, setValidationError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] ?? null;
    if (!nextFile) {
      setValidationError(null);
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
    onFileChange(nextFile);
  };

  const imageUrl = previewUrl ?? currentUrl;

  return (
    <div className="event-flyer-field">
      <label htmlFor="event-flyer">Event flyer</label>
      <p className="event-flyer-field__helper">JPEG, PNG, or WebP · up to 5 MB</p>
      {imageUrl && (
        <img className="event-flyer-field__preview" src={imageUrl} alt="Event flyer preview" />
      )}
      <input
        id="event-flyer"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleChange}
        disabled={disabled}
      />
      {validationError && <p role="alert">{validationError}</p>}
    </div>
  );
}
