import { useLayoutEffect, useRef } from "react";
import type { ReactNode } from "react";
import { animate, motion, useMotionValue, useReducedMotion, useTransform } from "motion/react";
import "./RubberSegment.css";

type RubberSegmentProps = {
  items: readonly { to: string }[];
  value: string | undefined;
  children: ReactNode;
};

const easeOut = [0.23, 1, 0.32, 1] as const;

/** A visual-only RubberSegment: the slots remain real route links, not radio buttons. */
export default function RubberSegment({ items, value, children }: RubberSegmentProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<string | undefined>(undefined);
  const left = useMotionValue(0);
  const right = useMotionValue(0);
  const width = useMotionValue(0);
  const clipPath = useTransform(() =>
    `inset(0 ${Math.max(0, width.get() - right.get())}px 0 ${Math.max(0, left.get())}px round 8px)`
  );
  const reduce = useReducedMotion();

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let timer: number | undefined;
    let frame = 0;

    const measure = (animated: boolean) => {
      const index = items.findIndex((item) => item.to === value);
      if (index < 0) return;
      const item = track.querySelectorAll<HTMLElement>(".dock-item")[index];
      if (!item) return;
      const trackRect = track.getBoundingClientRect();
      const itemRect = item.getBoundingClientRect();
      const nextLeft = itemRect.left - trackRect.left;
      const nextRight = itemRect.right - trackRect.left;
      width.set(trackRect.width);
      if (!animated || reduce || activeRef.current === undefined || activeRef.current === value) {
        left.jump(nextLeft);
        right.jump(nextRight);
      } else {
        const expandedLeft = Math.min(left.get(), nextLeft);
        const expandedRight = Math.max(right.get(), nextRight);
        animate(left, expandedLeft, { duration: 0.19, ease: easeOut });
        animate(right, expandedRight, { duration: 0.19, ease: easeOut });
        timer = window.setTimeout(() => {
          animate(left, nextLeft, { type: "spring", duration: 0.3, bounce: 0 });
          animate(right, nextRight, { type: "spring", duration: 0.3, bounce: 0 });
        }, 150);
      }
      activeRef.current = value;
    };

    measure(true);
    const scheduleMeasure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => measure(false));
    };
    if (typeof ResizeObserver !== "undefined") {
      const observer = new ResizeObserver(scheduleMeasure);
      observer.observe(track);
      track.querySelectorAll(".dock-item").forEach((item) => observer.observe(item));
      return () => {
        observer.disconnect();
        cancelAnimationFrame(frame);
        clearTimeout(timer);
        left.stop();
        right.stop();
      };
    }
    window.addEventListener("resize", scheduleMeasure);
    return () => {
      window.removeEventListener("resize", scheduleMeasure);
      cancelAnimationFrame(frame);
      clearTimeout(timer);
      left.stop();
      right.stop();
    };
  }, [value, items, reduce, left, right, width]);

  return (
    <div ref={trackRef} className="rubber-segment">
      {value && <motion.div className="rubber-segment__thumb" aria-hidden="true" style={{ clipPath }} />}
      {children}
    </div>
  );
}
