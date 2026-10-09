import "./InstructorPortrait.css";
import { useState } from "react";

type Props = { name: string; imageUrl: string | null; alt?: string; className?: string };

export function InstructorPortrait({ name, imageUrl, alt = "", className = "" }: Props) {
  const [failed, setFailed] = useState(false);
  const initial = Array.from(name.trim())[0]?.toLocaleUpperCase() ?? "";
  return (
    <div className={`instructor-portrait ${className}`.trim()}>
      {imageUrl && !failed ? (
        <img src={imageUrl} alt={alt} loading="lazy" onError={() => setFailed(true)} />
      ) : (
        <span className="instructor-portrait__initial" aria-hidden="true">{initial}</span>
      )}
    </div>
  );
}
