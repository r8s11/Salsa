---
target: operator desk (PlatformAdminOverview/OperatorDesk/ModeratorOverview/HostDashboard)
total_score: 26
max_score: 36
na_heuristics: 10
p0_count: 0
p1_count: 1
target_identity: "file:/home/r8s/code/Salsa/src/components/Admin/PlatformAdminOverview.tsx"
target_fingerprint: "sha256:af1ea8a678895ea8cee6238f12c1c9d104662ed9fd418d608ec5b18c3131cb79"
target_path: /home/r8s/code/Salsa/src/components/Admin/PlatformAdminOverview.tsx
timestamp: 2026-09-22T16-29-53Z
slug: src-components-admin-platformadminoverview-tsx
---
## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 3 | Loading/error/settle states are handled (`DeskSkeleton`, `DeskError`, count pulse), but Approve fires the leave animation optimistically before the mutation resolves — a failed approve pops the row back with no distinct "returned" transition. |
| 2 | Match Between System & Real World | 3 | "Galley" is exposed verbatim as a measure title; the "Awaiting decision" note only appears when items are pending, so a first-time moderator learns the metaphor by inference, not by definition. |
| 3 | User Control and Freedom | 2 | Approve is one click with no undo and no confirmation (by design, per DESIGN.md's "approval does not interrupt"), but there's no way to reverse a mis-click short of finding the record in `/admin/events` and re-editing status. |
| 4 | Consistency and Standards | 4 | `OperatorDesk` is the single shared implementation behind Admin and Moderator; Host reuses the same primitives in one measure. Genuinely one system, not three skins. |
| 5 | Error Prevention | 2 | Approve and Reject sit 8px apart, same 34px height, same weight, differentiated only by color+label — real risk during fast evening triage of multiple submissions in a row. |
| 6 | Recognition Rather Than Recall | 4 | State is carried by shape (ring/disc/spike/square/ringed-disc), not just color — genuinely accessible recognition, confirmed in `MarginMark.tsx`. |
| 7 | Flexibility and Efficiency of Use | 1 | No keyboard path for the core loop (open → decide) despite the brief's own framing of an evening reviewer moving through a queue. Every decision costs a full mouse round-trip. |
| 8 | Aesthetic and Minimalist Design | 4 | The no-cards rule is followed with real discipline — rules, marks, and measures do all the work; nothing decorative competes with the queue. |
| 9 | Error Recovery | 3 | `DeskError` + retry on load failure is solid. The approve-failure path (row leaves, mutation fails, row silently reappears already-open with an inline error) works but is visually abrupt — no return animation exists in `desk.css`'s keyframe set (`deskLeaveSet`, `deskLeaveKilled`, `deskArrive` are all one-directional). |
| 10 | Help and Documentation | n/a | Internal reviewer tool; no in-context help is expected or provided anywhere else in the admin surfaces either — not a gap specific to this surface. |
| **Total** | | **26/36** | **Solid, opinionated system with real triage-speed gaps** |

## Design Specificity Verdict

**Not category-interchangeable.** This is the rare admin surface built around an actual metaphor with teeth: agate row scale, hanging-margin proof marks drawn as SVG geometry (not icon-font glyphs), a fixed seven-division week that shows a thin week as thin instead of collapsing it, and a closed five-color state law enforced consistently in both light and dark themes (`desk.css:8-58` matches `DESIGN.md`'s documented ramps exactly). The "no cards, ever" constraint is honored in the actual CSS — no `.admin-card`, no `box-shadow`, no elevation token leaked in from the rest of the admin surface. `OperatorDesk` is shared verbatim between Admin and Moderator (only the count set and the create-action differ by role), so the metaphor isn't a one-off skin on a single page — it's a real system.

The one erosion: the metaphor's vocabulary ("Galley") is exposed to end users who are dancer-moderators, not copy editors, with only a conditional note to translate it. That's a specificity win with a small comprehension cost, not a generic-panel problem.

## Overall Impression

This surface commits to its brief harder than most admin dashboards commit to anything. The structural bones — one continuous time axis, marks that carry state by shape, decisions that propagate in one movement without a route change or a toast — are all there in the actual code, not just in prose. The gap is that the surface is optimized for *reading* the week beautifully but under-optimized for the *repetitive decision loop* the brief itself describes ("a dancer-moderator reviewing submissions... in the evening"). The biggest opportunity is closing that loop: keyboard triage and error-safe approval would make the desk match its own brief instead of just its own aesthetic.

## What's Working

- **The mark system is real accessibility, not decoration.** Five states, five distinct SVG shapes, `aria-label` wired through `DESK_STATE_LABEL`, always labelled in `DeskEntry`. A color-blind moderator reads state exactly as well as anyone else.
- **One propagation, actually implemented.** `OperatorDesk`'s `settle()` callback moves an entry from galley to column and pulses the count in a single state transition (`desk__count-figure[data-settled="true"]`), not three independently-refreshing widgets pretending to be one event.
- **The measure that stays a measure.** `buildDivisions` in `Desk.tsx` keeps all seven days present even when empty, so the set column tells the truth about a thin week instead of hiding it — a genuinely considered structural decision, not a default.

## Priority Issues

- **[P1] Approve has no undo and sits adjacent to Reject at equal visual weight**
  - **Why it matters**: `Galley.tsx:104-124` places Approve and Reject 8px apart, both 34px pill buttons, differentiated only by color and a short label. Approve is a single click with no confirmation (the design intentionally makes reject the interruptible path via `AdminRejectSubmissionDialog`, and approve silent). During fast evening triage, a mis-click sets an event live with zero recovery path short of manually re-editing it in `/admin/events`.
  - **Fix**: Give Approve a brief, dismissible undo window (5-8s) before the mutation actually commits, or increase the click cost asymmetry between the two actions (e.g. require Reject's existing dialog pattern only for Approve when the entry carries missing-field flags — `missingFields`/`desk__entry-flags` already surfaces exactly this signal on the admin column, extend it to gate galley approvals too).
  - **Suggested command**: `$impeccable harden`

- **[P2] No keyboard path for the triage loop**
  - **Why it matters**: The surface brief frames this as a repeated evening review task, but `Galley.tsx` and `OperatorDesk.tsx` expose zero keyboard handling beyond native tab order. Reviewing 10+ submissions costs 20+ discrete mouse actions (open, then decide, per row) with no `j/k`-style navigation or accept/reject shortcuts — this is exactly the case Nielsen's heuristic 7 exists for.
  - **Fix**: Add keyboard shortcuts scoped to the open entry (e.g. `a` approve, `r` reject, `↓`/`↑` move focus between galley rows) with a visible hint the first time the galley has more than one item.
  - **Suggested command**: `$impeccable optimize`

- **[P2] Approve-failure recovery is visually abrupt**
  - **Why it matters**: `OperatorDesk.tsx`'s `settle()` fires the 420ms leave animation optimistically, before `approveSubmissionWithTaxonomy`'s result is known. `desk.css`'s `deskLeaveSet`/`deskLeaveKilled`/`deskArrive` keyframes are all one-directional — there is no "returned to galley" transition, so a failed approve makes the row vanish, then reappear already-open with an inline error, with no animated continuity between the two states.
  - **Fix**: Either defer the leave animation until the mutation resolves (small latency cost, but no false-positive UI), or add a symmetrical "return" keyframe so failure reads as a correction rather than a glitch.
  - **Suggested command**: `$impeccable polish`

- **[P3] "Galley" ships without a persistent definition**
  - **Why it matters**: `DeskMeasure`'s `note` prop only renders "Awaiting decision" while `pending.length > 0` (`OperatorDesk.tsx:222`) — once the galley empties, the only clue to what "Galley" meant disappears with it, and a moderator returning after a quiet week re-learns the term from scratch.
  - **Fix**: Make the definition part of the title area permanently (e.g. a small persistent subtitle under "Galley"), independent of whether there's anything in it right now.
  - **Suggested command**: `$impeccable clarify`

## Persona Red Flags

**Evening moderator (primary persona, per PRODUCT.md's "moderators review submissions")**: Reviewing 15 pending submissions in one sitting means 15 opens + 15 decisions with no shortcut path (P2) and every Approve carrying no safety net (P1). The fatigue curve of an evening session is exactly where a mis-click becomes likely, and exactly where this surface currently offers the least protection.

**Promoter host (`HostDashboard.tsx`)**: Genuinely well-served — rejected submissions stay visible in "Your entries" with the killed mark rather than silently vanishing (`listings` is unfiltered in that measure), so a host can see why their event didn't run. No red flag found here; noted as a strength, not an issue.

**Color-blind operator**: No red flag — `MarginMark.tsx`'s shape differentiation (ring/disc/spike/square/ringed-disc) means state reads correctly independent of the palette, which is rare discipline for a five-state system.

## Minor Observations

- `desk__action` decisions (`Approve`/`Reject`/`Open full record`) are three same-row options; brief calls for ≤4 visible choices at a decision point, and this is within bounds — not flagged as cognitive-load overload, just worth watching if a fourth action is ever added here.
- The `standing` state (draft) is a first-class law state in `DESIGN.md` and `deskModel.ts`, but the admin/moderator `OperatorDesk` never produces it — it only appears via `HostDashboard`'s own mapping. Likely intentional (drafts are host-only), but worth confirming so a future admin change doesn't assume the mark is dead code.
- `.desk :focus-visible` is explicitly styled and the entry-open control uses `aria-expanded` — accessibility groundwork here is more careful than most internal tools get.

## Questions to Consider

- What happens today when a moderator approves the wrong entry — is there truly no recovery path beyond editing the live event afterward, or does that scenario already have an answer this review didn't surface?
- Is "Galley" the term worth keeping for a dancer-moderator audience, or would this surface read faster with a plainer label while keeping every other piece of the copy-desk metaphor (marks, agate rows, one measured week)?
- If the evening review queue regularly runs past a handful of entries, does the team want triage speed (keyboard shortcuts) prioritized over any other roadmap item touching this surface?

## Run Notes

- **Target slug**: `src-components-admin-platformadminoverview-tsx` (resolved via `impeccable critique-storage slug`).
- **Ignore list**: `.impeccable/critique/ignore.md` does not exist — no findings suppressed.
- **Assessment independence**: Assessment B ran isolated in a background sub-agent and returned before this synthesis; Assessment A's first two sub-agent attempts stalled (10+ min, no yield) then crashed after reading sources but before returning a result — degraded to inline synthesis for Assessment A only, using the same source files that sub-agent had already read plus additional direct reads of `Desk.tsx`, `desk.css`, `MarginMark.tsx`, `Galley.tsx`, `deskModel.ts`. Assessment B's detector/browser evidence was never shown to the inline reviewer before this section was drafted from source.
- **CLI detector**: ran once by Assessment B against the four target files plus `desk.css` — `[]` (zero findings), exit 0. Independently sanity-checked (re-run with `--no-config`, and against two unrelated CSS files later proven via live browser overlay to carry real findings) — confirmed the file-mode scanner runs regex-only and structurally cannot see computed-style issues (contrast ratio, rendered glow/shadow), which file-based static scanning of TSX/CSS was never going to catch regardless of target. Not a tool malfunction; a coverage boundary.
- **Browser visibility**: both `/admin` and `/host` redirect an unauthenticated session to `/signin` (confirmed via final URL, DOM text, and screenshot) — no authenticated fixture was available, so no live render of `PlatformAdminOverview`/`OperatorDesk`/`ModeratorOverview`/`HostDashboard` was obtained in this run. All findings above are source-grounded (JSX + CSS), not screen-grounded.
- **Overlay injection**: succeeded, but only against the sign-in page it was forced onto — 4 real findings there (radial-gradient glow, zero-offset box-shadow, low-contrast primary button at 3.0:1, eyebrow-chip pattern), explicitly out of scope for this desk critique and not counted above.
- **Live server cleanup**: started and stopped cleanly by Assessment B (`impeccable live-server stop` confirmed).
- **Temp-file cleanup**: N/A this run (no temp body file yet at assessment stage).
