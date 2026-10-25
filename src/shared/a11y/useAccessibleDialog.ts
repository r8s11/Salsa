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

function isRendered(node: HTMLElement): boolean {
  if (node.hasAttribute("hidden") || node.getAttribute("aria-hidden") === "true") return false;
  // Browsers answer from layout, so a control hidden by a stylesheet (a
  // desktop-only or mobile-only action row) drops out of the trap. jsdom has
  // no layout and no checkVisibility, so there only inline styles count.
  if (typeof node.checkVisibility === "function") {
    return node.checkVisibility({ visibilityProperty: true });
  }
  return node.style.display !== "none" && node.style.visibility !== "hidden";
}

function focusableNodes(container: HTMLElement | null): HTMLElement[] {
  if (!container) return [];
  return [...container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)].filter(isRendered);
}

/**
 * Inert every element that is not the dialog, its own subtree, or one of its
 * ancestors, by walking the ancestor chain and inerting each level's other
 * children. This contains assistive-tech and pointer access without moving
 * the dialog into a portal, which would change its styling context.
 */
function inertBackground(dialog: HTMLElement): () => void {
  const inerted: HTMLElement[] = [];
  const levels: { parent: HTMLElement; keep: Element }[] = [];

  const inert = (sibling: Element, keep: Element) => {
    if (sibling === keep || !(sibling instanceof HTMLElement)) return;
    // Never clear an `inert` an outer dialog already owns.
    if (sibling.hasAttribute("inert")) return;
    sibling.setAttribute("inert", "");
    inerted.push(sibling);
  };

  for (let node: HTMLElement = dialog; node !== document.body;) {
    const parent = node.parentElement;
    if (!parent) break;
    for (const sibling of Array.from(parent.children)) inert(sibling, node);
    levels.push({ parent, keep: node });
    node = parent;
  }

  // Background that mounts while the dialog is open (a scroll-revealed
  // floating control, a toast) must be inert too, or focus walks into it.
  const observer =
    typeof MutationObserver === "function"
      ? new MutationObserver((records) => {
          for (const record of records) {
            const level = levels.find((l) => l.parent === record.target);
            if (!level) continue;
            for (const added of Array.from(record.addedNodes)) {
              if (added instanceof Element) inert(added, level.keep);
            }
          }
        })
      : null;
  for (const { parent } of levels) observer?.observe(parent, { childList: true });

  return () => {
    observer?.disconnect();
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
  dialogRef: RefObject<HTMLElement | null>;
  onDismiss: () => void;
  isBusy?: boolean;
  initialFocusRef?: RefObject<HTMLElement | null>;
  dismissOnBackdrop?: boolean;
  isOpen?: boolean;
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
  isOpen = true,
}: AccessibleDialogOptions): AccessibleDialogHandles {
  // Escape reads current handlers without reinstalling the listener on each render.
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
    if (!isOpen) return;
    const releaseScroll = lockBodyScroll();
    const dialog = dialogRef.current;
    const releaseInert = dialog ? inertBackground(dialog) : undefined;

    return () => {
      releaseInert?.();
      releaseScroll();
    };
  }, [dialogRef, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const opener = document.activeElement;
    const target = initialFocusRef?.current ?? focusableNodes(dialogRef.current)[0];
    target?.focus();

    return () => {
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, [dialogRef, initialFocusRef, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || busyRef.current) return;
      dismissRef.current();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const onKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLElement>) => {
      if (!isOpen || event.key !== "Tab") return;
      const focusable = focusableNodes(dialogRef.current);
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && (active === first || !dialogRef.current?.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !dialogRef.current?.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    },
    [dialogRef, isOpen]
  );

  const onBackdropClick = useCallback(
    (event: ReactMouseEvent<HTMLElement>) => {
      if (!isOpen || !dismissOnBackdrop || isBusy) return;
      if (event.target !== event.currentTarget) return;
      onDismiss();
    },
    [dismissOnBackdrop, isBusy, isOpen, onDismiss]
  );

  const onDialogClick = useCallback((event: ReactMouseEvent<HTMLElement>) => {
    event.stopPropagation();
  }, []);

  return { onKeyDown, onBackdropClick, onDialogClick };
}
