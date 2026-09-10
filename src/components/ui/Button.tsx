import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import "./Button.css";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "md" | "compact";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  loadingLabel?: string;
  block?: boolean;
  children: ReactNode;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      loadingLabel,
      block = false,
      disabled,
      className,
      children,
      type,
      ...rest
    },
    ref,
  ) => {
    const resolvedType = type ?? "button";
    const isDisabled = disabled || loading;

    const classes = [
      "ui-button",
      `ui-button--${variant}`,
      size !== "md" && `ui-button--${size}`,
      block && "ui-button--block",
      loading && "ui-button--loading",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <button
        ref={ref}
        type={resolvedType}
        className={classes}
        disabled={isDisabled}
        aria-busy={loading || undefined}
        {...rest}
      >
        {loading && (
          <Loader2 className="ui-button__spinner" aria-hidden="true" />
        )}
        {loading && loadingLabel ? loadingLabel : children}
      </button>
    );
  },
);

Button.displayName = "Button";

export default Button;
export type { ButtonProps, ButtonVariant, ButtonSize };
