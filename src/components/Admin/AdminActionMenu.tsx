import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ComponentType,
  type KeyboardEvent,
} from "react";
import { MoreHorizontal } from "lucide-react";
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
}

export default function AdminActionMenu({ label, items, disabled }: AdminActionMenuProps) {
  const [open, setOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLUListElement>(null);
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
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    itemRefs.current[0]?.focus();

    const trigger = triggerRef.current;
    const panel = panelRef.current;
    if (!trigger || !panel) return;
    const triggerRect = trigger.getBoundingClientRect();
    const panelHeight = panel.offsetHeight;
    setOpenUpward(triggerRect.bottom + panelHeight > window.innerHeight);
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

  return (
    <div className="admin-action-menu" ref={wrapperRef}>
      <button
        type="button"
        ref={triggerRef}
        className="admin-icon-btn admin-action-menu__trigger"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
      >
        <MoreHorizontal size={16} />
      </button>

      {open && (
        <ul
          className={`admin-action-menu__panel${openUpward ? " admin-action-menu__panel--up" : ""}`}
          role="menu"
          ref={panelRef}
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
      )}
    </div>
  );
}
