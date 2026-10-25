import { useEffect, useRef, useState } from "react";
import { useEscapeKey } from "../../features/calendar/hooks/useEscapeKey";

/**
 * Dropdown open/close state with outside-click and Escape dismissal.
 * Returns state + ref to attach to wrapper element.
 */
export function useDropdown() {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEscapeKey(() => {
    if (open) setOpen(false);
  });

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  const toggle = () => setOpen((prev) => !prev);
  const close = () => setOpen(false);

  return { open, setOpen, toggle, close, wrapRef };
}
