import { type ButtonHTMLAttributes, type ReactNode } from "react";
import "./IconButton.css";

type IconButtonVariant = "ghost" | "outline" | "danger";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: IconButtonVariant;
  children: ReactNode;
}

function IconButton({
  variant = "ghost",
  disabled,
  className,
  children,
  type,
  ...rest
}: IconButtonProps) {
  const resolvedType = type ?? "button";

  const classes = [
    "ui-icon-button",
    `ui-icon-button--${variant}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type={resolvedType}
      className={classes}
      disabled={disabled}
      {...rest}
    >
      {children}
    </button>
  );
}

export default IconButton;
export type { IconButtonProps, IconButtonVariant };
