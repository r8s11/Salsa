// Purpose: New York's calendar date ("YYYY-MM-DD"), re-rendering at New York
// midnight so a tab left open overnight stops calling yesterday "tonight".
import "temporal-polyfill/global";
import { useEffect, useState } from "react";

const TIME_ZONE = "America/New_York";

export function useNewYorkToday(): string {
  const [today, setToday] = useState(() => Temporal.Now.plainDateISO(TIME_ZONE).toString());

  useEffect(() => {
    const now = Temporal.Now.zonedDateTimeISO(TIME_ZONE);
    // Next day's start, not +24h: DST days are 23 or 25 hours long.
    const midnight = now.toPlainDate().add({ days: 1 }).toZonedDateTime(TIME_ZONE);
    const timer = setTimeout(
      () => setToday(Temporal.Now.plainDateISO(TIME_ZONE).toString()),
      midnight.epochMilliseconds - now.epochMilliseconds + 1000
    );
    return () => clearTimeout(timer);
  }, [today]);

  return today;
}
