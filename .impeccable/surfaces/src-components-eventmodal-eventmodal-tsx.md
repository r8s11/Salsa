---
version: 1
slug: "src-components-eventmodal-eventmodal-tsx"
primary_target: "src/components/EventModal/EventModal.tsx"
related_targets: []
---

Scope: the event quick-look modal (EventModal): desktop dialog and mobile sheet, opened from event cards, the featured card, the calendar and related strips. Visitor mode: Persuade. The dancer decides to go and brings friends.

Audience: dancers in Boston and NYC browsing a night on their phone. Job: understand the night in one glance, send it to friends, and commit (RSVP or tickets). Constraint: stays inside Ritmo Vivo (DESIGN.md). Existing mechanics are preserved: focus trap, Escape, backdrop close, drag-to-dismiss sheet, and the full-details route.

Seed key: 825a0cd2 (surface scope, persuade, dealt lead).

## Direction contract

THESIS: The modal opens on the night card, the same object a friend will receive. The poster thumbnail sits beside the four facts, and "Send to friends" stands equal to RSVP. It refuses the category default of a flyer banner with a stack of equal-weight utility buttons.

OWN-WORLD: Ritmo Vivo unchanged: dark slate ground, rose primary with glow, gold secondary outline, Epilogue display with Be Vietnam Pro body, rounded 8px shapes, glass surfaces used sparingly.

STORY: The dancer sees what, when, where and how much in four lines, sees the sleeve they would share, sends it or commits, then reads the details below if they want more.

FIRST VIEWPORT: Night card: a sleeve thumbnail (tappable, opens the full poster preview with a Story/Feed toggle) left of the date, time, venue link, price and type. Title across the full width under it. Two equal primary actions: Send to friends and RSVP/Get tickets. Utilities (calendar, copy link, full details) are quiet text links. Details follow.

FORM: Dealt lead (Night Card) of three presented. Unchosen: Week Slot, Invite Composer.

MEMORABLE MOMENT: Tapping the sleeve thumbnail opens the actual poster. What you see is exactly what your friends get.

Unresolved: none.
