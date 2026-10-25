import { type ButtonHTMLAttributes, type ReactNode, type Ref } from "react";
import "./IconButton.css";

type IconButtonVariant = "ghost" | "outline" | "danger";

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: IconButtonVariant;
  children: ReactNode;
  ref?: Ref<HTMLButtonElement>;
}

function IconButton({
  variant = "ghost",
  disabled,
  className,
  children,
  type,
  ref,
  ...rest
}: IconButtonProps) {
  const resolvedType = type ?? "button";

  const classes = ["ui-icon-button", `ui-icon-button--${variant}`, className]
    .filter(Boolean)
    .join(" ");

  return (
    <button type={resolvedType} ref={ref} className={classes} disabled={disabled} {...rest}>
      {children}
    </button>
  );
}

export default IconButton;
export type { IconButtonProps, IconButtonVariant };
