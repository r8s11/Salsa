import "./VinylRecord.css";

interface VinylRecordProps {
  /** "sm" ≈ 24px, "md" ≈ 48px, "lg" ≈ 96px, "xl" ≈ 160px. Default "md". */
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

/**
 * Decorative spinning vinyl record — pure CSS, no images.
 * Always renders with `aria-hidden="true"` since it carries no information.
 */
export default function VinylRecord({ size = "md", className }: VinylRecordProps) {
  const classes = ["vinyl", `vinyl--${size}`, className].filter(Boolean).join(" ");

  return (
    <div className={classes} aria-hidden="true">
      <div className="vinyl__glow" />
      <div className="vinyl__disc">
        <div className="vinyl__grooves" />
        <div className="vinyl__label" />
      </div>
      <div className="vinyl__sheen" />
    </div>
  );
}
