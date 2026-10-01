import { useLayoutEffect, useRef, type RefObject } from "react";

const EASE_OUT_EXPO = "cubic-bezier(0.16, 1, 0.3, 1)";
const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

// The period title travels a short way; the grid travels further, clipped
// by its own frame (`.sx-react-calendar-wrapper` hides overflow), so the
// month or week slides through a fixed window rather than the frame moving.
const TRAVEL = [
  { selector: ".event-manager__period h2", distance: 10 },
  { selector: ".sx__view-container", distance: 28 },
] as const;

/**
 * Explains period navigation: when the displayed period changes, the period
 * title and the calendar grid arrive from the side time moved toward
 * (later from the right, earlier from the left). Content is never hidden by
 * default — the animation only eases toward the already-rendered state, so a
 * failed or skipped animation leaves the page correct. Reduced motion keeps a
 * short opacity settle without movement. View switches and resizes keep the
 * same date and do not travel.
 */
export function usePeriodTravel(
  rootRef: RefObject<HTMLElement | null>,
  date: Temporal.PlainDate,
  periodTitle: string
) {
  const previous = useRef({ date, periodTitle });
  const running = useRef<Animation[]>([]);

  useLayoutEffect(() => {
    const last = previous.current;
    previous.current = { date, periodTitle };
    if (last.periodTitle === periodTitle) return;

    const direction = Temporal.PlainDate.compare(date, last.date);
    const root = rootRef.current;
    if (direction === 0 || !root) return;

    for (const animation of running.current) animation.cancel();
    running.current = [];

    const reduced = window.matchMedia(REDUCED_MOTION_QUERY).matches;
    for (const { selector, distance } of TRAVEL) {
      const target = root.querySelector<HTMLElement>(selector);
      if (!target || typeof target.animate !== "function") continue;
      running.current.push(
        reduced
          ? target.animate([{ opacity: 0.55 }, { opacity: 1 }], {
              duration: 160,
              easing: "ease-out",
            })
          : target.animate(
              [
                { transform: `translateX(${direction * distance}px)`, opacity: 0.35 },
                { transform: "none", opacity: 1 },
              ],
              { duration: 300, easing: EASE_OUT_EXPO }
            )
      );
    }
  }, [date, periodTitle, rootRef]);
}
