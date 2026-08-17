import markBrand from "../../assets/brand/mark-brand.png";
import markWhite from "../../assets/brand/mark-white.png";
import "./SalsaSeguraLogo.css";

export type LogoVariant = "full" | "mark";
export type LogoSize = "sm" | "md" | "lg";
export type LogoTone = "brand" | "white";

interface SalsaSeguraLogoProps {
  /** "full" (mark + wordmark) or "mark" (icon only). Default "full". */
  variant?: LogoVariant;
  /** sm ≈ 24px, md ≈ 32px, lg ≈ 44px mark height. Default "md". */
  size?: LogoSize;
  /** Which mark colorway to render. Default "brand". */
  tone?: LogoTone;
  className?: string;
  /**
   * Accessible name for the mark image. Omit when this component is
   * already wrapped by an element that provides its own accessible name
   * (a link with visible text, or a link/element with its own aria-label) —
   * the mark then renders as decorative (empty alt). Set it when the mark
   * is used standalone, with no other accessible name in its container.
   */
  ariaLabel?: string;
}

const MARK_SRC: Record<LogoTone, string> = {
  brand: markBrand,
  white: markWhite,
};

export default function SalsaSeguraLogo({
  variant = "full",
  size = "md",
  tone = "brand",
  className,
  ariaLabel,
}: SalsaSeguraLogoProps) {
  const classes = ["ss-logo", `ss-logo--${size}`, className].filter(Boolean).join(" ");

  return (
    <span className={classes}>
      <img
        className="ss-logo__mark"
        src={MARK_SRC[tone]}
        alt={ariaLabel ?? ""}
        width={160}
        height={160}
      />
      {variant === "full" && <span className="ss-logo__wordmark">Salsa Segura</span>}
    </span>
  );
}
