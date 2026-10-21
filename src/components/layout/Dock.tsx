import { useRef } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "motion/react";
import type { MotionValue, SpringOptions } from "motion/react";
import { NavLink } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import RubberSegment from "../ui/RubberSegment";
import "./Dock.css";

type DockLink = {
  to: string;
  label: string;
  icon: LucideIcon;
  end: boolean;
};

/** A tab that acts in place (opens the cart) rather than navigating. */
type DockAction = {
  id: string;
  label: string;
  icon: LucideIcon;
  onSelect: () => void;
  /** Count shown on the icon; hidden at zero. */
  badge?: number;
  ariaLabel?: string;
};

export type DockItemData = DockLink | DockAction;

const itemKey = (item: DockItemData) => ("to" in item ? item.to : item.id);

type DockProps = {
  items: readonly DockItemData[];
  activeValue: string | undefined;
  className?: string;
  distance?: number;
  panelHeight?: number;
  baseItemSize?: number;
  magnification?: number;
  spring?: SpringOptions;
};

const defaultSpring: SpringOptions = { mass: 0.1, stiffness: 150, damping: 12 };

function DockItem({
  item,
  mouseX,
  distance,
  baseItemSize,
  magnification,
  spring,
  reducedMotion,
}: {
  item: DockItemData;
  mouseX: MotionValue<number>;
  distance: number;
  baseItemSize: number;
  magnification: number;
  spring: SpringOptions;
  reducedMotion: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const mouseDistance = useTransform(mouseX, (x) => {
    const rect = ref.current?.getBoundingClientRect();
    return rect ? x - rect.left - rect.width / 2 : Infinity;
  });
  const targetSize = useTransform(
    mouseDistance,
    [-distance, 0, distance],
    [baseItemSize, magnification, baseItemSize]
  );
  const size = useSpring(targetSize, spring);
  const Icon = item.icon;

  return (
    <motion.div
      ref={ref}
      className="dock-item"
      style={{ width: reducedMotion ? baseItemSize : size, height: reducedMotion ? baseItemSize : size }}
    >
      {"to" in item ? (
        <NavLink to={item.to} end={item.end} className="mobile-tab-bar__tab">
          <span className="mobile-tab-bar__icon" aria-hidden="true">
            <Icon size={21} />
          </span>
          <span className="mobile-tab-bar__label">{item.label}</span>
        </NavLink>
      ) : (
        <button type="button" className="mobile-tab-bar__tab" aria-label={item.ariaLabel} onClick={item.onSelect}>
          <span className="mobile-tab-bar__icon" aria-hidden="true">
            <Icon size={21} />
            {item.badge ? <span className="mobile-tab-bar__badge">{item.badge > 99 ? "99+" : item.badge}</span> : null}
          </span>
          <span className="mobile-tab-bar__label">{item.label}</span>
        </button>
      )}
    </motion.div>
  );
}

export default function Dock({
  items,
  activeValue,
  className = "",
  distance = 110,
  panelHeight = 70,
  baseItemSize = 62,
  magnification = 70,
  spring = defaultSpring,
}: DockProps) {
  const mouseX = useMotionValue(Infinity);
  const reducedMotion = Boolean(useReducedMotion());

  return (
    <div className="dock-outer" style={{ height: panelHeight }}>
      <div
        className={`dock-panel ${className}`}
        onMouseMove={(event) => {
          if (!reducedMotion) mouseX.set(event.clientX);
        }}
        onMouseLeave={() => mouseX.set(Infinity)}
        onTouchStart={() => mouseX.set(Infinity)}
      >
        <RubberSegment items={items.map(itemKey)} value={activeValue} itemSelector=".dock-item">
          {items.map((item) => (
            <DockItem
              key={itemKey(item)}
              item={item}
              mouseX={mouseX}
              distance={distance}
              baseItemSize={baseItemSize}
              magnification={magnification}
              spring={spring}
              reducedMotion={reducedMotion}
            />
          ))}
        </RubberSegment>
      </div>
    </div>
  );
}
