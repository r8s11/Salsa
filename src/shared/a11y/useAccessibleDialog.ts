import { useCallback, useEffect, useRef } from "react";
import type {
  MouseEvent as ReactMouseEvent,
  KeyboardEvent as ReactKeyboardEvent,
  RefObject,
} from "react";

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

/**
 * Inert every element that is not the dialog, its own subtree, or one of its
 * ancestors, by walking the ancestor chain and inerting each level's other
 * children. This contains assistive-tech and pointer access without moving
 * the dialog into a portal, which would change its styling context.
 */
function inertBackground(dialog: HTMLElement): () => void {
  const inerted: HTMLElement[] = [];

  for (let node: HTMLElement = dialog; node !== document.body;) {
    const parent = node.parentElement;
    if (!parent) break;
    for (const sibling of Array.from(parent.children)) {
      if (sibling === node || !(sibling instanceof HTMLElement)) continue;
      // Never clear an `inert` an outer dialog already owns.
      if (sibling.hasAttribute("inert")) continue;
      sibling.setAttribute("inert", "");
      inerted.push(sibling);
    }
    node = parent;
  }

  return () => {
    for (const node of inerted) node.removeAttribute("inert");
  };
}

/**
 * Scroll lock is refcounted: stacked dialogs must not let the innermost one
 * hand the background its scrollbar back while an outer dialog is still open.
 */
let scrollLockCount = 0;
let scrollLockRestore = "";

function lockBodyScroll(): () => void {
  if (scrollLockCount === 0) {
    scrollLockRestore = document.body.style.overflow;
    // The stylesheet locks only overflow-x; the vertical axis is what lets a
    // sheet slide over moving content.
    document.body.style.overflow = "hidden";
  }
  scrollLockCount += 1;

  return () => {
    scrollLockCount -= 1;
    if (scrollLockCount === 0) document.body.style.overflow = scrollLockRestore;
  };
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

  // Declared before the focus effect deliberately: React runs cleanups in
  // declaration order, so the background must leave `inert` before focus is
  // handed back — focusing a still-inert opener silently does nothing.
  useEffect(() => {
    const releaseScroll = lockBodyScroll();
    const dialog = dialogRef.current;
    const releaseInert = dialog ? inertBackground(dialog) : undefined;

    return () => {
      releaseInert?.();
      releaseScroll();
    };
    // Containment is established once per mount, alongside focus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
