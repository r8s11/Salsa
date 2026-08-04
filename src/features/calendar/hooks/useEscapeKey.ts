import { useEffect } from "react";

// Invokes `handler` whenever the Escape key is pressed while mounted.
export function useEscapeKey(handler: () => void) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handler();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handler]);
}
