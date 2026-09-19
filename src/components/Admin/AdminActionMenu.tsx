import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
  type KeyboardEvent,
} from "react";
import { ChevronDown, MoreHorizontal } from "lucide-react";
import { createPortal } from "react-dom";
import { useEscapeKey } from "../../features/calendar/hooks/useEscapeKey";
import "./AdminActionMenu.css";

export interface ActionMenuItem {
  id: string;
  label: string;
  icon?: ComponentType<{ size?: number }>;
  onSelect: () => void;
  tone?: "default" | "danger";
  separatorBefore?: boolean;
}

interface AdminActionMenuProps {
  label: string; // e.g. "Actions for Salsa at the Anchor"
  items: ActionMenuItem[];
  disabled?: boolean;
  triggerText?: string;
}

export default function AdminActionMenu({
  label,
  items,
  disabled,
  triggerText,
}: AdminActionMenuProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLUListElement>(null);
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const close = () => {
    setOpen(false);
    triggerRef.current?.focus();
  };

  useEscapeKey(() => {
    if (open) close();
  });

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!wrapperRef.current?.contains(target) && !panelRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const closeForViewportChange = () => setOpen(false);
    window.addEventListener("scroll", closeForViewportChange, true);
    window.addEventListener("resize", closeForViewportChange, true);
    return () => {
      window.removeEventListener("scroll", closeForViewportChange, true);
      window.removeEventListener("resize", closeForViewportChange, true);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!trigger || !panel) return;

    const triggerRect = trigger.getBoundingClientRect();
    const panelWidth = panel.offsetWidth || panel.getBoundingClientRect().width;
    const panelHeight = panel.offsetHeight || panel.getBoundingClientRect().height;
    const gutter = 8;
    const gap = 4;
    const maxLeft = Math.max(gutter, window.innerWidth - panelWidth - gutter);
    const left = Math.min(Math.max(triggerRect.right - panelWidth, gutter), maxLeft);
    const below = triggerRect.bottom + gap;
    const above = triggerRect.top - panelHeight - gap;
    const maxTop = Math.max(gutter, window.innerHeight - panelHeight - gutter);
    const top =
      below + panelHeight <= window.innerHeight - gutter || above < gutter
        ? Math.min(Math.max(below, gutter), maxTop)
        : Math.max(above, gutter);

    setPosition({ top, left });
    itemRefs.current[0]?.focus();
  }, [open]);

  const focusItem = (index: number) => {
    const count = items.length;
    const next = ((index % count) + count) % count;
    itemRefs.current[next]?.focus();
  };

  const handleItemKeyDown = (event: KeyboardEvent, index: number) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        focusItem(index + 1);
        break;
      case "ArrowUp":
        event.preventDefault();
        focusItem(index - 1);
        break;
      case "Home":
        event.preventDefault();
        focusItem(0);
        break;
      case "End":
        event.preventDefault();
        focusItem(items.length - 1);
        break;
    }
  };


  const panel = open ? (
    <ul
      className="admin-action-menu__panel"
      role="menu"
      ref={panelRef}
      style={{
        position: "fixed",
        top: position?.top ?? 0,
        left: position?.left ?? 0,
        visibility: position ? "visible" : "hidden",
      }}
    >
      {items.map((item, index) => {
        const Icon = item.icon;
        return (
          <li
            key={item.id}
            role="none"
            className={item.separatorBefore ? "admin-action-menu__separator-before" : undefined}
          >
            {item.separatorBefore && (
              <hr role="separator" className="admin-action-menu__separator" />
            )}
            <button
              type="button"
              role="menuitem"
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
              className={`admin-action-menu__item${item.tone === "danger" ? " admin-action-menu__item--danger" : ""}`}
              onKeyDown={(event) => handleItemKeyDown(event, index)}
              onClick={() => {
                setOpen(false);
                triggerRef.current?.focus();
                item.onSelect();
              }}
            >
              {Icon && <Icon size={14} />}
              {item.label}
            </button>
          </li>
        );
      })}
    </ul>
  ) : null;

  return (
    <>
      <div className="admin-action-menu" ref={wrapperRef}>
        <button
          type="button"
          ref={triggerRef}
          className={`admin-icon-btn admin-action-menu__trigger${triggerText ? " admin-action-menu__trigger--labeled" : ""}`}
          aria-haspopup="menu"
          aria-expanded={open}
          aria-label={label}
          disabled={disabled}
          onClick={(event) => {
            if (!open) {
              setPosition(null);
              setPortalTarget(event.currentTarget.closest<HTMLElement>(".admin-shell") ?? document.body);
            }
            setOpen((value) => !value);
          }}
        >
          {triggerText ? (
            <>
              <span>{triggerText}</span>
              <ChevronDown size={14} />
            </>
          ) : (
            <MoreHorizontal size={16} />
          )}
        </button>
      </div>
      {panel && portalTarget ? createPortal(panel, portalTarget) : null}
    </>
  );
}
