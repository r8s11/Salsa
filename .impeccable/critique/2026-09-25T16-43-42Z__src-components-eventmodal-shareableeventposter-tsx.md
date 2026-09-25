---
target: @src/components/EventModal/ @src/components/EventModal/ShareableEventPoster.css
total_score: 16
max_score: 20
na_heuristics: 1,3,7,9,10
p0_count: 0
p1_count: 2
target_identity: "file:/home/r8s/code/Salsa/src/components/EventModal/ShareableEventPoster.tsx"
target_fingerprint: "sha256:39287fc29624425ede275317b10326c7d72fe77391b665b399f51e768ee70692"
target_path: /home/r8s/code/Salsa/src/components/EventModal/ShareableEventPoster.tsx
timestamp: 2026-09-25T16-43-42Z
slug: src-components-eventmodal-shareableeventposter-tsx
closed: true
---
Method: dual-agent (A: PosterDesignAssessment · B: PosterEvidenceAssessment)

## Design Health Score

| # | Heuristic | Score | Key issue |
|---|---|---:|---|
| 1 | Visibility of system status | n/a | Static exported artifact; no mutable state. |
| 2 | Match between system and real world | 4 | The sleeve, Side A/B, catalogue number, tracks, and price sticker map naturally to the event facts. |
| 3 | User control and freedom | n/a | No interaction exists inside the exported image. |
| 4 | Consistency and standards | 3 | Strong internal system; current Feed spine renders the date while committed captures still show the title. |
| 5 | Error prevention | 2 | QR and printed URL are redundant, but neither guarantees a one-tap route when viewed on the same phone. |
| 6 | Recognition rather than recall | 3 | Facts are explicit; event type depends on an unlearned color code. |
| 7 | Flexibility and efficiency | n/a | Accelerators do not apply inside a static image. |
| 8 | Aesthetic and minimalist design | 4 | Disciplined hierarchy, no decorative noise, and every visual device reinforces the sleeve thesis. |
| 9 | Error recognition and recovery | n/a | No input or recoverable error state exists inside the poster. |
| 10 | Help and documentation | n/a | A persuasive poster should remain self-contained. |
| **Total** |  | **16/20** | **Good — highly authored, with conversion and inclusion gaps.** |

## Design Specificity Verdict

**Highly specific.** This could not be dropped into an unrelated nightlife product unchanged. The catalogue number, record-label masthead, hard-edged cover frame, Shrikhand title band, Side A/B vocabulary, dotted track leaders, vertical Feed spine, and pressing-color system create one coherent Fania-era world. Social and workshop exports remain recognizably related without looking like a generic template with swapped colors.

**Deterministic scan:** `impeccable detect --json src/components/EventModal/ShareableEventPoster.tsx` returned `[]` with exit code `0`. No markup antipatterns were found. The earlier CSS-only warnings about poster font aliases and fixed export-pixel sizes are not applicable to this markup scan and conflict with the explicitly documented Sleeve exception.

**Visual overlays:** none. The Salsa surface was not listening on ports 3001, 5173, or 4173; navigation to `http://localhost:3001` returned `ERR_CONNECTION_REFUSED`. No reliable browser overlay was exposed. The four committed Story/Feed captures were used instead. They predate the latest poster CSS and do not prove the current Feed spine.

## Overall Impression

The Sleeve is memorable, legible, and genuinely ownable. The front cover creates desire; the cream back cover converts that desire into concrete date, time, venue, style, and route information. The single biggest opportunity is the final handoff: the artifact looks more intentional than the path from image to event currently feels.

## What’s Working

1. **One visual thesis, executed completely.** Spot colors, flat print, hard rules, condensed track typography, and title lettering all belong to the same world. Ritmo Vivo’s glass and glow never leak into the export.
2. **Excellent format-specific composition.** Story preserves address and host context; Feed protects a square cover, vertical spine, single-line facts, and dedicated QR column. The long workshop title remains readable without colliding with the sticker or cream panel.
3. **Persuasive factual hierarchy.** Price is immediate, the four decision facts scan quickly, and Side B isolates the exact route. The fallback artwork reads as authored cover art rather than a missing-image placeholder.

## Priority Issues

### [P1] The accessible name discards nearly every event fact

**Why it matters:** `ShareableEventPoster.tsx:97-101` exposes the complete poster as one `role="img"` labelled only “Story/Feed poster for [title].” Date, time, venue, address, price, styles, host, and short URL disappear from the accessible name; the QR is also hidden.

**Fix:** Build the poster label from the same normalized facts used by the visible design, or expose the factual DOM semantically while hiding only decorative art and QR geometry. Reuse the full description for generated-image alt/caption text where the share channel permits.

**Suggested command:** `$impeccable audit src/components/EventModal/ShareableEventPoster.tsx`

### [P1] The final route is not designed for same-phone conversion

**Why it matters:** Every capture ends with a QR and printed URL. In a Story or group chat, the recipient is commonly viewing the image on the phone needed to scan it. Image pixels are not inherently tappable, so the persuasive journey ends in platform-specific QR recognition or manual typing.

**Fix:** Share the exported image together with the exact event URL as tappable message text or caption. Keep the QR as cross-device redundancy. Shorten the CTA to acknowledge both routes, such as “Open the shared link · or scan.”

**Suggested command:** `$impeccable harden src/features/calendar/hooks/useShareablePoster.tsx`

### [P2] Feed removes the host where trust matters most

**Why it matters:** `.sleeve--feed .sleeve-scan__credit { display: none; }` makes the compact format anonymous. For a recipient who does not know the venue or sender well, organizer identity is proof rather than secondary metadata.

**Fix:** Reserve one condensed line for “Hosted by …” or “… presents” in the Feed back cover, masthead, or title band. Reclaim space by shortening “Scan for the night,” not by shrinking the factual rows.

**Suggested command:** `$impeccable layout src/components/EventModal/ShareableEventPoster.tsx`

### [P2] Event type relies on an undocumented color code

**Why it matters:** Red, mustard, and midnight encode Social, Class, and Workshop, but the recipient has no legend or prior learning. The meaning is unavailable to color-impaired viewers and irrelevant to first-time recipients unless explicitly named.

**Fix:** Keep color as the dominant pressing code, but add a small textual pressing designation—`SOCIAL`, `CLASS`, or `WORKSHOP`—to the catalogue line or Side A.

**Suggested command:** `$impeccable clarify src/components/EventModal/ShareableEventPoster.tsx`

## Cognitive Load

- Strong single-focus hierarchy: cover/title and price → four Side A facts → one Side B route.
- Four tracks stay within working-memory limits; route information is spatially isolated.
- No decision point presents more than four options.
- One recognition failure: recipients must infer event type from color.
- At 360px display width, the Feed’s 30px export type scales to roughly 10 CSS pixels. This is an inferred legibility risk and needs live-device verification before changing type.

## Emotional Journey

The masthead and saturated pressing field announce a collectible artifact rather than another dark-scrim event ad. The front cover is the emotional peak; the title lettering and rotated Entry sticker make the night feel desirable and specific. The back cover shifts cleanly from desire to reassurance. The journey weakens at the final conversion point because the visual route is polished, but the same-phone action is not guaranteed to be immediate.

## Persona Red Flags

**Sam — accessibility-dependent recipient**
- Receives only format and title from the poster’s accessible name.
- Cannot recover event type from color alone.
- Is not told the date, time, venue, price, host, or event URL represented visually.

**Casey — distracted mobile group-chat recipient**
- May need to zoom the Feed facts at common phone display widths.
- Cannot scan the QR easily from the same screen.
- Loses the host trust cue in Feed.

**Jordan — first-time Salsa Segura recipient**
- Cannot decode the pressing colors as event types.
- Reads `SS-0924 · BOS` as flavor rather than actionable context.
- “Scan for the night” does not explain whether a separate tappable link accompanies the image.

## Minor Observations

- The surface brief says Side A includes price, but implementation places price exclusively in the sticker and uses the fourth track for styles. Visually this works; the documentation and data model disagree.
- Current source renders the date on the Feed spine, while both committed Feed captures show and truncate the event title. Fresh acceptance captures are required.
- All review captures print a localhost URL. They prove placement, not production-hostname fit or brand credibility.
- Cream on social red measures approximately 4.21:1. It is suitable for the current large/bold text, not future normal-size copy.
- The committed PNGs are older than the latest CSS; they are fallback evidence, not current visual proof.

## Questions to Consider

- Is the intended same-phone path a tappable URL included beside the shared image today?
- Is organizer identity important enough to earn permanent Feed space?
- Does a recipient need to understand Social/Class/Workshop immediately, or is the pressing color deliberately atmospheric?
- Should current source or the committed Feed spine capture be treated as acceptance authority?
