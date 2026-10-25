import { ChevronLeft, ChevronRight } from "lucide-react";
import type { FlyerPagerState } from "./useFlyerPager";
import "./FlyerPager.css";

/**
 * Previous/next buttons, one 44px dot per flyer, and the spoken position.
 * Renders nothing unless there is more than one flyer to flip through.
 */
export function FlyerPagerControls({
  pager,
  className = "",
}: {
  pager: FlyerPagerState;
  className?: string;
}) {
  if (pager.count < 2) return null;
  return (
    <div className={`flyer-pager ${className}`.trim()} role="group" aria-label="Event flyers">
      <button type="button" className="flyer-pager__step" aria-label="Previous flyer" onClick={pager.prev}>
        <ChevronLeft size={20} aria-hidden />
      </button>
      <div className="flyer-pager__dots">
        {Array.from({ length: pager.count }, (_, i) => (
          <button
            key={i}
            type="button"
            className="flyer-pager__dot"
            aria-label={`Show flyer ${i + 1}`}
            aria-current={i === pager.index ? "true" : undefined}
            onClick={() => pager.goTo(i)}
          />
        ))}
      </div>
      <button type="button" className="flyer-pager__step" aria-label="Next flyer" onClick={pager.next}>
        <ChevronRight size={20} aria-hidden />
      </button>
      <span className="flyer-pager__status" aria-live="polite">
        Flyer {pager.index + 1} of {pager.count}
      </span>
    </div>
  );
}
