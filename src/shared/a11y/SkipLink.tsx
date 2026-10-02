import type { MouseEvent, ReactNode } from "react";

interface SkipLinkProps {
  targetId: string;
  children: ReactNode;
}

export default function SkipLink({ targetId, children }: SkipLinkProps) {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    const target = document.getElementById(targetId);
    if (!target) return;
    event.preventDefault();
    // Focus, not just scroll: the next Tab must continue from the target.
    if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1");
    target.focus();
  };

  return (
    <a className="skip-link" href={`#${targetId}`} onClick={handleClick}>
      {children}
    </a>
  );
}
