import { useEffect, useRef, useState } from "react";

/**
 * Debounced search input with instant echo and external sync.
 * Pattern: user types → input updates immediately, filter updates after 200ms.
 * If external `value` changes (e.g. filter reset), input syncs to match.
 */
export function useDebouncedSearch(value: string, onChange: (value: string) => void, delay = 200) {
  const [input, setInput] = useState(value);
  const [synced, setSynced] = useState(value);
  const debounceRef = useRef<number | null>(null);

  // Sync input when external value changes
  if (value !== synced) {
    setSynced(value);
    setInput(value);
  }

  const handleInput = (newValue: string) => {
    setInput(newValue);
    clearTimeout(debounceRef.current ?? undefined);
    debounceRef.current = window.setTimeout(() => {
      onChange(newValue);
    }, delay);
  };

  useEffect(
    () => () => {
      clearTimeout(debounceRef.current ?? undefined);
    },
    []
  );

  return { input, handleInput };
}
