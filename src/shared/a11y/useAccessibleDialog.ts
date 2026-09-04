import { useCallback, useEffect, useRef } from "react";
import type { MouseEvent as ReactMouseEvent, KeyboardEvent as ReactKeyboardEvent, RefObject } from "react";

/**
 * Every interactive descendant a modal can contain. Disabled controls are
 * excluded here; hidden ones are filtered at call time (a selector cannot
 * express "rendered").
 */
const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

function focusableNodes(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return [...container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter(
    (node) =>
      !node.hasAttribute("hidden") &&
      node.getAttribute("aria-hidden") !== "true" &&
      // jsdom reports no layout boxes, so treat an unstyled node as visible and
      // only drop nodes explicitly hidden by their computed style.
      node.style.display !== "none" &&
      node.style.visibility !== "hidden"
  );
}

export interface AccessibleDialogOptions {
  /** Container carrying `role="dialog"`. */
  dialogRef: RefObject<HTMLElement | null>;
  /** Escape / backdrop dismissal. Never invoked while `isBusy`. */
  onDismiss: () => void;
  /**
   * Mutation in flight: Escape and backdrop clicks are ignored so the result
   * or error stays on screen. Callers must also disable their Cancel control.
   */
  isBusy?: boolean;
  /** Focused on mount; falls back to the first focusable descendant. */
  initialFocusRef?: RefObject<HTMLElement | null>;
  /** Dialogs holding unsaved input can opt out of backdrop dismissal. */
  dismissOnBackdrop?: boolean;
}

export interface AccessibleDialogHandles {
  /** Bind to the dialog container: Tab/Shift+Tab focus trap. */
  onKeyDown: (event: ReactKeyboardEvent<HTMLElement>) => void;
  /** Bind to the overlay element. */
  onBackdropClick: (event: ReactMouseEvent<HTMLElement>) => void;
  /** Bind to the dialog container so inner clicks never reach the overlay. */
  onDialogClick: (event: ReactMouseEvent<HTMLElement>) => void;
}

/**
 * Shared modal-dialog mechanics: initial focus, a complete Tab focus trap,
 * Escape handling, a busy-state close guard, and opener focus restoration.
 *
 * This is the single implementation of that keyboard behavior — dialogs wire
 * their own markup and business logic and take these handles instead of
 * re-deriving focusable nodes.
 */
export function useAccessibleDialog({
  dialogRef,
  onDismiss,
  isBusy = false,
  initialFocusRef,
  dismissOnBackdrop = true,
}: AccessibleDialogOptions): AccessibleDialogHandles {
  // The Escape listener is bound once per mount, so it reads the latest busy
  // flag and dismiss handler through refs synced after each render.
  const busyRef = useRef(isBusy);
  const dismissRef = useRef(onDismiss);

  useEffect(() => {
    busyRef.current = isBusy;
    dismissRef.current = onDismiss;
  }, [isBusy, onDismiss]);

  useEffect(() => {
    const opener = document.activeElement;
    const target = initialFocusRef?.current ?? focusableNodes(dialogRef.current)[0];
    target?.focus();

    return () => {
      if (opener instanceof HTMLElement) opener.focus();
    };
    // Focus is placed once per mount: re-running on ref identity would steal
    // focus back mid-interaction.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || busyRef.current) return;
      dismissRef.current();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>) => {
      if (event.key !== "Tab") return;
      const focusable = focusableNodes(dialogRef.current);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || !dialogRef.current?.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    },
    [dialogRef]
  );

  const onBackdropClick = useCallback(
    (event: ReactMouseEvent<HTMLElement>) => {
      if (!dismissOnBackdrop || isBusy) return;
      if (event.target !== event.currentTarget) return;
      onDismiss();
    },
    [dismissOnBackdrop, isBusy, onDismiss]
  );

  const onDialogClick = useCallback((event: ReactMouseEvent<HTMLElement>) => {
    event.stopPropagation();
  }, []);

  return { onKeyDown, onBackdropClick, onDialogClick };
}
