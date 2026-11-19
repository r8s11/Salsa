import type { KeyboardEvent } from "react";

export const chipsIn = (group: Element | null | undefined) =>
  Array.from(group?.querySelectorAll<HTMLButtonElement>('button[role="radio"]:not(:disabled)') ?? []);

const STEPS: Record<string, number | undefined> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

/** Radio groups move with the arrows: the next chip takes focus and the choice. */
export function onRadioChipKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
  const step = STEPS[event.key];
  if (!step) return;
  const chips = chipsIn(event.currentTarget.closest('[role="radiogroup"]'));
  const index = chips.indexOf(event.currentTarget);
  if (index < 0) return;
  event.preventDefault();
  const next = chips[(index + step + chips.length) % chips.length];
  next.focus();
  next.click();
}
