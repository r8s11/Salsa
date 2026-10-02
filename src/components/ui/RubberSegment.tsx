import { useLayoutEffect, useRef } from "react";
import type { HTMLAttributes, ReactNode } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import "./RubberSegment.css";

type RubberSegmentProps = HTMLAttributes<HTMLDivElement> & {
  /** Slot keys in DOM order; `value` names the selected one. */
  items: readonly string[];
  value: string | undefined;
  /** Matches the slot elements inside the track, in the same order as `items`. */
  itemSelector: string;
  /** Clip the thumb to the slot's height too (for tracks with padding or wrapping rows). */
  fitHeight?: boolean;
  children: ReactNode;
};

const EDGES = ["left", "right", "top", "bottom"] as const;

const easeOut = [0.23, 1, 0.32, 1] as const;

/**
 * A visual-only selection thumb that stretches to cover the old and new slot,
 * then contracts onto the new one. Slots keep their own semantics (links,
 * pressed buttons); the thumb is decoration and is hidden from assistive tech.
 * The thumb is measured against its own box, so a track can inset it with CSS.
 */
export default function RubberSegment({
  items,
  value,
  itemSelector,
  fitHeight = false,
  className,
  children,
  ...rest
}: RubberSegmentProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const thumbRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<string | undefined>(undefined);
  const targetRef = useRef<Record<(typeof EDGES)[number], number> | null>(null);
  const left = useMotionValue(0);
  const right = useMotionValue(0);
  const top = useMotionValue(0);
  const bottom = useMotionValue(0);
  const width = useMotionValue(0);
  const height = useMotionValue(0);
  const clipPath = useTransform(
    () =>
      `inset(${Math.max(0, top.get())}px ${Math.max(0, width.get() - right.get())}px ` +
      `${Math.max(0, height.get() - bottom.get())}px ${Math.max(0, left.get())}px round 8px)`
  );
  const reduce = useReducedMotion();
  const selected = value !== undefined && items.includes(value);
  // Keyed by content, not array identity: callers often rebuild `items` on
  // the same render that changes `value`, which would restart the effect and
  // snap the stretch to its end.
  const itemsKey = items.join("\n");

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let timer: number | undefined;
    let frame = 0;

    const measure = (animated: boolean) => {
      const thumb = thumbRef.current;
      const index = value === undefined ? -1 : itemsKey.split("\n").indexOf(value);
      if (!thumb || index < 0) return;
      const item = track.querySelectorAll<HTMLElement>(itemSelector)[index];
      if (!item) return;
      const thumbRect = thumb.getBoundingClientRect();
      const itemRect = item.getBoundingClientRect();
      const next = {
        left: itemRect.left - thumbRect.left,
        right: itemRect.right - thumbRect.left,
        top: fitHeight ? itemRect.top - thumbRect.top : 0,
        bottom: fitHeight ? itemRect.bottom - thumbRect.top : thumbRect.height,
      };
      const edges = { left, right, top, bottom };
      width.set(thumbRect.width);
      height.set(thumbRect.height);
      // ResizeObserver reports every observed element once on observe(), and
      // again on unrelated reflow. Only a moved slot may retarget the thumb;
      // otherwise those reports would snap a running stretch to its end.
      const target = targetRef.current;
      if (!animated && target && EDGES.every((edge) => Math.abs(target[edge] - next[edge]) < 0.5)) {
        return;
      }
      targetRef.current = next;
      if (!animated || reduce || activeRef.current === undefined || activeRef.current === value) {
        for (const edge of EDGES) edges[edge].jump(next[edge]);
      } else {
        // Stretch to cover both slots, then contract onto the new one.
        const expanded = {
          left: Math.min(left.get(), next.left),
          right: Math.max(right.get(), next.right),
          top: Math.min(top.get(), next.top),
          bottom: Math.max(bottom.get(), next.bottom),
        };
        for (const edge of EDGES) {
          animate(edges[edge], expanded[edge], { duration: 0.19, ease: easeOut });
        }
        timer = window.setTimeout(() => {
          for (const edge of EDGES) {
            animate(edges[edge], next[edge], { type: "spring", duration: 0.3, bounce: 0 });
          }
        }, 150);
      }
      activeRef.current = value;
    };

    const stop = () => {
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      for (const motionValue of [left, right, top, bottom]) motionValue.stop();
    };
    measure(true);
    const scheduleMeasure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => measure(false));
    };
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(scheduleMeasure);
      observer.observe(track);
      track.querySelectorAll(itemSelector).forEach((item) => observer.observe(item));
      return () => {
        observer.disconnect();
        stop();
      };
    }
    window.addEventListener("resize", scheduleMeasure);
    return () => {
      window.removeEventListener("resize", scheduleMeasure);
      stop();
    };
  }, [value, itemsKey, itemSelector, fitHeight, reduce, left, right, top, bottom, width, height]);

  return (
    <div
      ref={trackRef}
      className={className ? `rubber-segment ${className}` : "rubber-segment"}
      {...rest}
    >
      {selected && (
        <motion.div
          ref={thumbRef}
          className="rubber-segment__thumb"
          aria-hidden="true"
          style={{ clipPath }}
        />
      )}
      {children}
    </div>
  );
}
