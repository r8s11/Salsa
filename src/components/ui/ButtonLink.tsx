import { type AnchorHTMLAttributes, type MouseEvent, type ReactNode } from "react";
import { Link, type LinkProps } from "react-router-dom";
import "./Button.css";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "md" | "compact";

interface ButtonLinkBaseProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  block?: boolean;
  className?: string;
  children: ReactNode;
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
}

interface ButtonLinkInternalProps
  extends ButtonLinkBaseProps,
    Omit<LinkProps, "to" | "className" | "children" | "onClick"> {
  to: string;
  href?: never;
  external?: false;
}

interface ButtonLinkExternalProps
  extends ButtonLinkBaseProps,
    Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href" | "className" | "children" | "onClick" | "target" | "rel"> {
  href: string;
  to?: never;
  external?: true;
}

type ButtonLinkProps = ButtonLinkInternalProps | ButtonLinkExternalProps;

function ButtonLink({
  variant = "primary",
  size = "md",
  block = false,
  className,
  children,
  onClick,
  ...rest
}: ButtonLinkProps) {
  const classes = [
    "ui-button",
    `ui-button--${variant}`,
    size !== "md" && `ui-button--${size}`,
    block && "ui-button--block",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if ("href" in rest && rest.href) {
    const { href, external, ...linkRest } = rest as ButtonLinkExternalProps & { href: string; external?: boolean };
    return (
      <a
        href={href}
        className={classes}
        target={external ? "_blank" : undefined}
        rel={external ? "noopener noreferrer" : undefined}
        onClick={onClick}
        {...linkRest}
      >
        {children}
      </a>
    );
  }

  const { to, ...routerRest } = rest as ButtonLinkInternalProps & { to: string };
  return (
    <Link to={to} className={classes} onClick={onClick} {...routerRest}>
      {children}
    </Link>
  );
}

export default ButtonLink;
export type { ButtonLinkProps, ButtonVariant, ButtonSize };
