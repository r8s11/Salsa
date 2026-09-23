---
target: critique @src/components/EventModal/ @graft/src/components/EventModal/
total_score: 24
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 4
target_identity: "file:/home/r8s/code/Salsa/src/components/EventModal/EventModal.tsx"
target_fingerprint: "sha256:87932c43bf6f36e79aba87269d1e8e8f7a5739fcadf3d84a95ef2ba8deac41fa"
target_path: /home/r8s/code/Salsa/src/components/EventModal/EventModal.tsx
timestamp: 2026-09-23T17-30-50Z
slug: src-components-eventmodal-eventmodal-tsx
---
# EventModal critique

## Design Health Score

| # | Heuristic | Score | Key issue |
|---|---|---:|---|
| 1 | Visibility of system status | 2 | Copy and poster failures have no visible recovery. |
| 2 | Match system / real world | 3 | Event vocabulary is natural; paid-ticket and walk-in copy can conflict. |
| 3 | User control and freedom | 4 | Close, Escape, backdrop, focus restoration, and drag dismissal work. |
| 4 | Consistency and standards | 3 | Utility controls cohere; desktop has duplicate exits. |
| 5 | Error prevention | 2 | Missing RSVP leaves no defined attendance path. |
| 6 | Recognition rather than recall | 3 | Facts and actions are visible; Share hides poster outcome. |
| 7 | Flexibility and efficiency | 2 | Mobile loses RSVP after detail scrolling. |
| 8 | Aesthetic and minimalist design | 3 | Flyer-first hierarchy works; sticky utilities equalize secondary actions. |
| 9 | Error recovery | 1 | Clipboard and poster failures only log to console. |
| 10 | Help and documentation | 1 | No contextual help for RSVP, ticketing, or poster action. |
| **Total** | | **24/40** | **Acceptable — significant improvement needed** |

## Design Specificity Verdict

Ritmo Vivo visual layer is authored: flyer-first composition, rose/gold night-floor palette, display type, category chips, and Story asset feel specific to local dance discovery. Decision layer falls back to generic utility-sheet behavior: dense equal-weight actions and duplicated exit paths compete with attending.

Detector scanned `src/components/EventModal/EventModal.tsx`: 0 findings. No false positives. Browser visual evidence unavailable because both `localhost:5173` and `localhost:3001` refused connections. Overlay preflight and injection succeeded on the helper, but no app client connected; injection was removed cleanly.

## Overall Impression

Strong quick-look event surface. Biggest opportunity: retain one honest attendance path after a dancer reads details, rather than ending on share utilities.

## What's Working

1. Poster, facts, price, and RSVP form a sensible quick-look order (`EventModal.tsx:406-450`).
2. Responsive dialog mechanics are unusually considered: desktop dialog, mobile sheet, drag dismissal, safe-area padding, scroll containment, and reduced motion (`EventModal.css:44-57, 574-648, 724-732, 879-915`).
3. Map links, host/contact detail, series dates, gallery, calendar export, and branded Story poster support escalating commitment (`EventModal.tsx:220-286, 336-377`).

## Priority Issues

### P1 — RSVP disappears after mobile detail scrolling
**Why it matters:** Sticky footer contains Full details, Share, Add to calendar, and Copy link while RSVP stays above fold (`EventModal.tsx:441-450, 516-517`; `EventModal.css:787-828`). Mobile users must remember and return to their commitment action.

**Fix:** When an RSVP link exists, make RSVP/Get Tickets sticky first action. Collapse Copy link into Share or overflow; retain at most two contextual utilities.

**Suggested command:** `$impeccable layout`.

### P1 — Mobile initial focus targets desktop-only control
**Why it matters:** Dialog initializes focus to Back (`EventModal.tsx:79-102, 408-410`), then mobile hides Back (`EventModal.css:642-653`). Shared dialog focus path may leave keyboard users without visible initial target. [INFERENCE]

**Fix:** Give initial focus to always-visible Close, or select first visible focusable descendant. Verify at mobile width with keyboard.

**Suggested command:** `$impeccable harden`.

### P1 — Shared poster has no reliable conversion path or visible failure
**Why it matters:** Share produces a poster without a canonical event URL/QR; native share has title plus file but no URL/text. Capture failures only log to console (`ShareableEventPoster.tsx:108-115`; `EventModal.tsx:306-330`).

**Fix:** Put canonical URL in native share payload and visible poster QR/deep link. Rename action “Share poster.” Announce capture failure with retry/download recovery.

**Suggested command:** `$impeccable harden`.

### P1 — Ticketing copy is unreliable across attendance states
**Why it matters:** “Pay at the door” can appear beside paid Get Tickets; no-RSVP events lose an attendance next step (`EventModal.tsx:207-210, 376, 441-450, 509-517`).

**Fix:** Use price-aware copy. Render contact/walk-in state only when source facts support it.

**Suggested command:** `$impeccable clarify`.

### P2 — Gallery implies interaction but is static
**Why it matters:** Pointer cursor, hover/active scale, and `+N` suggest a gallery action; images are noninteractive (`EventModal.tsx:481-495`; `EventModal.css:344-376`).

**Fix:** Build labeled keyboard-operable lightbox or remove interactive treatments.

**Suggested command:** `$impeccable harden`.

## Persona Red Flags

- **Casey, mobile dancer:** thumb-zone sticky area gives priority to utilities, not RSVP; fact row can truncate useful location context.
- **Sam, keyboard/screen-reader user:** [INFERENCE] hidden Back control may receive initial focus; offscreen capture poster should be hidden from assistive technology.
- **Jordan, first-time attendee:** Share does not explain poster output; paid and walk-in language conflict; no-RSVP event lacks next-step guidance.

## Minor Observations

- Desktop Back and top-right X duplicate close behavior.
- Quick fact combines venue and full address, likely reducing mobile scanability.
- Validate long and multilingual poster titles in export before depending on community sharing.

## Questions to Consider

1. Should mobile detail end with one persistent attendance commitment rather than four equal utilities?
2. Must every shared poster return a dancer to the exact event by QR/deep link?
