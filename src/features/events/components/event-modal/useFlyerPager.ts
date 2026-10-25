import { useState, type KeyboardEvent } from "react";

interface FlyerPagerOptions {
  /** Ordered flyers, primary first (`resolveEventFlyers`). One entry means no pager. */
  flyers: string[];
  /** Shown only if every flyer of a multi-flyer event fails to load. */
  fallbackUrl: string;
  /** What `flyers` is when the pager is inactive. */
  artKind: "flyer" | "fallback";
  /** Changes when a different event is shown; the pager returns to the first flyer. */
  resetKey: string | number;
}

export interface FlyerPagerState {
  /** The flyer to show now. */
  url: string;
  artKind: "flyer" | "fallback";
  /** Flyers still loadable; the pager is shown only when more than one. */
  count: number;
  /** Zero-based position among the loadable flyers. */
  index: number;
  next: () => void;
  prev: () => void;
  goTo: (index: number) => void;
  /** Pass the shown `<img>`'s load failure here; it drops that flyer. */
  onImageError: () => void;
  /** Left/Right arrows flip the cover; attach to the focused cover. */
  onKeyDown: (event: KeyboardEvent) => void;
}

/**
 * Flip state for an event cover with several flyers. Paging wraps. A flyer
 * that fails to load is dropped for good and the next one is shown, so broken
 * art never stays on the cover. Events with a single flyer are left exactly
 * alone: no paging and no load-failure handling, as before.
 */
export function useFlyerPager({
  flyers,
  fallbackUrl,
  artKind,
  resetKey,
}: FlyerPagerOptions): FlyerPagerState {
  const [state, setState] = useState({ key: resetKey, index: 0, failed: [] as string[] });
  let current = state;
  if (state.key !== resetKey) {
    current = { key: resetKey, index: 0, failed: [] };
    setState(current);
  }

  const active = flyers.length > 1;
  const usable = active ? flyers.filter((url) => !current.failed.includes(url)) : flyers;
  const count = usable.length;
  const index = count ? current.index % count : 0;

  const step = (delta: number) =>
    setState((s) => ({ ...s, index: count ? (((s.index % count) + delta + count) % count) : 0 }));
  const next = () => step(1);
  const prev = () => step(-1);
  const url = usable[index];

  return {
    url: url ?? fallbackUrl,
    artKind: active && !url ? "fallback" : artKind,
    count,
    index,
    next,
    prev,
    goTo: (to) => setState((s) => ({ ...s, index: to })),
    onImageError: () => {
      if (!active || !url) return;
      setState((s) => (s.failed.includes(url) ? s : { ...s, failed: [...s.failed, url] }));
    },
    onKeyDown: (event) => {
      if (count < 2 || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        next();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        prev();
      }
    },
  };
}
