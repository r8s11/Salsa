---
name: Ritmo Vivo
colors:
  surface: "#0b1326"
  surface-dim: "#0b1326"
  surface-bright: "#31394d"
  surface-container-lowest: "#060e20"
  surface-container-low: "#131b2e"
  surface-container: "#171f33"
  surface-container-high: "#222a3d"
  surface-container-highest: "#2d3449"
  on-surface: "#dae2fd"
  on-surface-variant: "#e5bdbe"
  inverse-surface: "#dae2fd"
  inverse-on-surface: "#283044"
  outline: "#ac8889"
  outline-variant: "#5c3f40"
  surface-tint: "#ffb3b6"
  primary: "#ffb3b6"
  on-primary: "#68001a"
  primary-container: "#e11d48"
  on-primary-container: "#fffaf9"
  inverse-primary: "#be0037"
  secondary: "#e9c349"
  on-secondary: "#3c2f00"
  secondary-container: "#af8d11"
  on-secondary-container: "#342800"
  tertiary: "#ffb690"
  on-tertiary: "#552100"
  tertiary-container: "#bf5300"
  on-tertiary-container: "#fffaf8"
  error: "#ffb4ab"
  on-error: "#690005"
  error-container: "#93000a"
  on-error-container: "#ffdad6"
  primary-fixed: "#ffdada"
  primary-fixed-dim: "#ffb3b6"
  on-primary-fixed: "#40000c"
  on-primary-fixed-variant: "#920028"
  secondary-fixed: "#ffe088"
  secondary-fixed-dim: "#e9c349"
  on-secondary-fixed: "#241a00"
  on-secondary-fixed-variant: "#574500"
  tertiary-fixed: "#ffdbca"
  tertiary-fixed-dim: "#ffb690"
  on-tertiary-fixed: "#341100"
  on-tertiary-fixed-variant: "#783200"
  background: "#0b1326"
  on-background: "#dae2fd"
  surface-variant: "#2d3449"
  # Operator desk state palette (admin, moderator, host). Light-theme
  # values; the dark variants live in the sidecar tonal ramps. These are
  # state colours and are never used decoratively.
  desk-unset: "#b45309"
  desk-set: "#047857"
  desk-killed: "#b91c1c"
  desk-standing: "#475569"
  desk-tonight: "#be123c"
  sleeve-red: "#d7263d"
  sleeve-red-deep: "#a8182c"
  sleeve-mustard: "#f2b705"
  sleeve-mustard-deep: "#c99400"
  sleeve-midnight: "#1b1b3a"
  sleeve-midnight-deep: "#10102a"
  sleeve-cream: "#f4ecd8"
typography:
  display-lg:
    fontFamily: Epilogue
    fontSize: 72px
    fontWeight: "800"
    lineHeight: "1.1"
    letterSpacing: -0.02em
  display-md:
    fontFamily: Epilogue
    fontSize: 48px
    fontWeight: "800"
    lineHeight: "1.2"
  headline-lg:
    fontFamily: Epilogue
    fontSize: 32px
    fontWeight: "700"
    lineHeight: "1.3"
  headline-md:
    fontFamily: Epilogue
    fontSize: 24px
    fontWeight: "600"
    lineHeight: "1.4"
  body-lg:
    fontFamily: Be Vietnam Pro
    fontSize: 18px
    fontWeight: "400"
    lineHeight: "1.6"
  body-md:
    fontFamily: Be Vietnam Pro
    fontSize: 16px
    fontWeight: "400"
    lineHeight: "1.6"
  label-lg:
    fontFamily: Epilogue
    fontSize: 14px
    fontWeight: "700"
    lineHeight: "1.2"
    letterSpacing: 0.1em
  label-sm:
    fontFamily: Epilogue
    fontSize: 12px
    fontWeight: "600"
    lineHeight: "1.2"
  desk-agate:
    fontFamily: Be Vietnam Pro
    fontSize: 0.8125rem
    fontWeight: "400"
    lineHeight: "1.35"
  desk-entry-title:
    fontFamily: Be Vietnam Pro
    fontSize: 0.9375rem
    fontWeight: "700"
    lineHeight: "1.3"
  desk-label:
    fontFamily: Epilogue
    fontSize: 0.6875rem
    fontWeight: "700"
    lineHeight: "1.2"
    letterSpacing: 0.14em
  desk-figure:
    fontFamily: Epilogue
    fontSize: 1.375rem
    fontWeight: "800"
    lineHeight: "1"
    letterSpacing: -0.02em
  wordmark:
    fontFamily: Great Vibes
    fontWeight: "400"
    lineHeight: "1"
  identifier:
    fontFamily: ui-monospace
    fontSize: 0.8125rem
    fontWeight: "400"
    lineHeight: "1.4"
  poster-lettering:
    fontFamily: Shrikhand
    fontWeight: "400"
    lineHeight: "1.02"
    letterSpacing: -0.01em
  poster-condensed:
    fontFamily: Barlow Condensed
    fontWeight: "600"
    lineHeight: "1.15"
    fontFeature: tabular-nums lining-nums
  poster-condensed-bold:
    fontFamily: Barlow Condensed
    fontWeight: "800"
    lineHeight: "1.15"
    fontFeature: tabular-nums lining-nums
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 40px
  xxl: 80px
  container-max: 1280px
  gutter: 24px
---

## Brand & Style

Salsa Segura carries **three worlds**, and they do not mix. Everything a
dancer sees is Ritmo Vivo, described throughout this file. Everything an
operator uses — the admin, moderator and host dashboards — is **The
Listings Desk**, recorded in its own subsections below. The one artifact
that leaves the site — the shareable event poster, exported and sent to a
friend's phone — is pressed in its own printed world, **The Sleeve**,
also recorded in its own subsections below. The desk exists because a
curation back-office is read for hours in a lit room, while Ritmo Vivo is
built to feel like a dark dance floor; the Sleeve exists because a poster
is judged against other posters in a story or a group chat, not against
the site around it.

**The Sleeve Boundary Rule.** The Sleeve never appears as site UI —
only as the poster export itself and its thumbnail/preview inside the
event modal. Ritmo Vivo's glassmorphism and glow never enter the poster,
and the Sleeve's flat spot-colour fields never leak back into Ritmo
Vivo. Do not apply glassmorphism, glow, or the dark slate ground to an
operator surface; do not apply agate listing rules to a public one.

This design system captures the fiery essence of salsa: movement, passion, and community. The brand personality is extroverted and rhythmic, balancing the heat of the dance floor with the structural professionalism of a premier academy.

The visual style is **High-Contrast / Bold** blended with **Glassmorphism**. This creates a "night-out" aesthetic—utilizing deep backgrounds and vibrant pops of color to simulate the atmosphere of a dance social. We use sharp, large-scale typography and translucent overlays to suggest motion and depth, ensuring the school feels modern and energetic rather than traditional or dusty.

## Colors

The palette is anchored in a high-fidelity interpretation of the school’s heritage.

- **Primary (Rose Red):** Used for high-action items, primary buttons, and critical brand moments. It represents passion and heart.
- **Secondary (Gold):** Used for accents, premium tiers, and achievement-based elements (like "Advanced" class badges).
- **Tertiary (Warm Orange):** Introduced to bridge the gap between red and gold, adding vibrancy to gradients and energetic hover states.
- **Neutral (Deep Slate):** A sophisticated dark mode base that allows the warm tones to "glow," mimicking a spotlight on a dark stage.

Surface colors should use varying opacities of white (5% to 15%) over the dark neutral background to create layered depth.

### The Listings Desk — state palette

The desk runs on the `.admin-shell` neutral tokens (light and dark
themes) plus five state colours that are **law**: one colour per state,
used for state and for nothing else.

- **Unset** (`#b45309` light / `#fbbf24` dark): an entry awaiting a decision.
- **Set** (`#047857` / `#34d399`): published and in the week.
- **Killed** (`#b91c1c` / `#f87171`): rejected or cancelled.
- **Standing** (`#475569` / `#94a3b8`): a draft, held.
- **Tonight** (`#be123c` / `#fb7185`): running today.

**The State-Only Rule.** These five never decorate. An operator learns
the colour once and then reads a column of marks without reading a
label; borrowing one for emphasis destroys exactly that.

**Category chips are not state.** Taxonomy categories (attendee type,
dance style) are labelled by the `--admin-chip-*` palette in
`src/styles/admin.css` — one tint/ink pair per hue, light and dark. A
chip names a category and never reports an entry's state; the five
colours stay reserved for state.

### The Sleeve — pressing colours

Every night is pressed in one of three flat spot-colour fields, chosen
by event type — never decoration, always the type. A red back-cover
label prints on every pressing regardless of field colour.

- **Social pressing** (`#d7263d` field / `#a8182c` deep, on cream
  `#f4ecd8`): the default social night.
- **Class pressing** (`#f2b705` mustard field / `#c99400` deep, on
  midnight `#1b1b3a`): recurring classes.
- **Workshop pressing** (`#1b1b3a` midnight field / `#10102a` deep, on
  mustard `#f2b705`): workshops and intensives.
- **Cream stock** (`#f4ecd8`): the back cover's paper ground on every
  pressing, printed in midnight ink with red (`#d7263d`) side labels and
  track numbers.

**The Pressing-Codes-Type Rule.** The field colour is the only signal
of event type on the poster; it is never reused for anything else on
the sleeve, and Side A/Side B labels print red on every pressing so the
back cover reads the same regardless of which field it backs.

## Typography

The typography strategy is "Rhythmic Hierarchy." **Epilogue** provides a geometric, editorial weight that feels decisive and bold—perfect for capturing the "hit" of a beat. **Be Vietnam Pro** offers a warm, approachable counterpoint for long-form content, ensuring readability for class descriptions and event details.

For large display text, use tight letter-spacing to create a compact, high-energy impact. Labels and overlines should always be uppercase with generous letter-spacing to provide a modern, structural contrast to the fluid imagery of dance.

### The type ramp and the display band

UI type sits on the role ramp above, in rem (0.6875 / 0.75 / 0.8125 /
0.875 / 0.9375 / 1 / 1.125 / 1.375 / 1.5rem). Display composition above
24px is a band, not a step list: poster titles, hero figures and splash
headings set 1.5–4.5rem per surface, anchored by display-md (3rem) and
display-lg (4.5rem). SVG artwork lettering (the vinyl label print) is
artwork and answers to no ramp.

### Two faces beyond the pair

Epilogue and Be Vietnam Pro carry the system, but production has always
shipped two more, unrecorded until now. Both are legitimate roles, not
drift, so they are stated here rather than removed.

- **Wordmark** (Great Vibes): the script "Salsa Segura" lockup, and the
  only place this face appears. Declared as `--font-logo` and used by the
  header, the sign-in page, and the work-in-progress screen. It is a
  logotype, never a heading, never body copy, never a decorative flourish
  on a section title.
- **Identifier** (`ui-monospace, SFMono-Regular, Menlo, monospace`,
  0.8125rem): tabular identifiers an operator reads character by
  character — record IDs, hashes, raw payloads, submission diffs.
  Declared as `--font-mono`. Monospace here is for data that must align
  and must not be misread, never a costume for "technical".

Both are operator- and chrome-level roles. Neither is part of the public
reading experience: a dancer sees the wordmark and nothing else.

### The Listings Desk — agate setting

The desk sets listings the way a printed club-listings column does:
small, dense, rule-separated, with tabular lining numerals so figures
align down the column (`font-variant-numeric: tabular-nums`).

- **Agate** (Be Vietnam Pro, 0.8125rem/1.35): every listing row.
- **Entry title** (Be Vietnam Pro 700, 0.9375rem/1.3): the name of a night.
- **Desk label** (Epilogue 700, 0.6875rem, 0.14em, uppercase): measure
  titles, day headings, count labels, state flags.
- **Figure** (Epilogue 800, 1.375rem, -0.02em): the counts in the rule.

**The Agate-Rows-Only Rule.** Listing scale governs rows and nothing
else. Every control an operator hits at speed stays at full UI size
(34px minimum), because the reading load belongs to the state palette,
not to the type size.

### The Sleeve — Poster Lettering and Poster Condensed

The Sleeve sets its own faces, distinct from the Epilogue/Be Vietnam
Pro pair above. **Shrikhand** (`--font-poster-lettering`, weight 400)
is **Poster Lettering**: fat, condensed script reserved for the cover
title band alone, never a heading, never body copy. **Barlow Condensed**
(`--font-poster-condensed`, weights 600/800) is **Poster Condensed**:
the masthead, sticker, track list and Side B, set with tabular lining
numerals (`font-variant-numeric: tabular-nums lining-nums`) so figures
align down the track list the way the desk's agate figures do.

Both faces are self-hosted (`@fontsource`) and loaded only when a
poster is shown; the same font bytes are embedded into the PNG capture
(`posterFontEmbedCss`) so the exported poster matches the on-screen
preview instead of falling back to a system sans.

**The Artwork-Not-Ramp Rule.** The cover title's export-pixel size
(54–128px story, ×0.8 on feed, stepped by character count) is artwork
sized for the printed sleeve and answers to no UI type ramp — the same
exemption the vinyl label print already has.

## Layout & Spacing

The system uses a **Fluid Grid** based on a 12-column model for desktop and a 4-column model for mobile. Layouts should favor asymmetrical arrangements to evoke the spontaneity of salsa dance.

Spacing follows a strict 4px base unit, but emphasizes large "breathing rooms" (XXL spacing) between major sections to prevent the dark UI from feeling cramped. For the gallery component, use a masonry-style layout with varied gutter widths to maintain a sense of dynamic energy.

### The Listings Desk — two measures and a fixed week

The desk is a standing rule over two measures: the **galley** (entries
awaiting a decision) and the **set column** (the week). The column is a
fixed **seven divisions** from today; a day with nothing in it still
occupies its division, so a thin week looks thin instead of collapsing
into a tidy short list. Every entry is pinned to its true position on
that one time axis, and the division head owns the day while the entry
states only its time.

Hanging indents are constant: a 22px margin column for the proof mark,
a 14px gutter, and a 44px flyer thumb where an entry carries evidence.
Below 1080px the two measures stack rather than narrow — an agate
column squeezed under its measure stops being readable.

### The Sleeve — story and feed measures

The poster exports at two fixed pixel sizes, never responsive: a
**story** (1080×1920) and a **feed** cut (1080×1350, 4:5). Both stack
the same three prints top to bottom — a label **masthead** (wordmark
and a catalogue line, e.g. `SS-0924 · BOS`), the square **front cover**
(flyer or fallback art, a lettered title band, a circular price
sticker), and the cream **back cover** (Side A facts, Side B QR and
short link). The feed cut adds a vertical **spine** beside the cover
carrying the date, the fact a friend needs first when the post is a
thumbnail, and sets the back cover as the track list plus a one-line scan
strip on the left with a single full-height QR on the right. Track leaders
sit on a value's first line, so a wrapped venue never drops its leader.

The night card's sleeve thumbnail reuses the front cover alone
(`SleeveCover`), scaled down from its authored 968px art size — the
thumbnail is the same component as the exported poster's cover, not an
approximation of it.

## Elevation & Depth

Hierarchy is established through **Glassmorphism** and **Ambient Shadows**.

1. **Base Surface:** The deepest neutral slate color.
2. **Raised Cards:** Semi-transparent overlays (White at 8% opacity) with a 12px background blur and a 1px subtle border (White at 10% opacity).
3. **Active Elements:** Primary Rose Red elements should feature a "glow" effect—a soft, diffused shadow of the same color (opacity 30%) to simulate neon lighting.

Avoid heavy black shadows; instead, use tinted shadows that inherit the hue of the background to keep the "vibrant" brand promise.

### The Listings Desk — rules, not cards

The desk declares **no elevation at all**. There are no cards, no
panels, and no shadows on an operator surface; hierarchy comes from
rules and measures. A 2px rule closes the masthead and separates major
regions, a 1px rule separates divisions and entries, and a 1px vertical
rule divides the two measures. An open entry is marked by a change of
ground (`--admin-surface-subtle`), never by lifting it.

**The One-Device Rule.** Border or shadow, never both. The desk chose
the border.

#### What the no-cards law governs

**The law governs the desk, not the whole operator world.** The desk is
the standing rule: the admin, moderator and host overviews, built from
`src/components/Desk/`. Those surfaces carry no cards today and must keep
carrying none — a galley and a set column are a column of type, and a card
around an entry destroys the vertical read the proof marks exist for.

Everywhere else an operator works — record tables, forms, detail pages,
dialogs, settings — `.admin-card` is the sanctioned container, and the
122 occurrences across 49 files are correct rather than debt. A listing
column and an edit form are different jobs: a form needs a stated edge
because it bounds a set of fields the operator is committing, and a detail
page needs one because it separates a record from the page around it.
Forcing the agate treatment onto them would make both harder to use.

So the boundary is by job, not by URL:

- **Desk surfaces** (a standing column of entries): rules and measures,
  never a card. Ground change marks state; nothing lifts.
- **Record surfaces** (a form, a table, one record, a dialog):
  `.admin-card` is correct, bounded by three rules — one level deep and
  never nested, border-only elevation per the One-Device Rule, and never
  a card per row where a table belongs.

`AdminMetricCard` remains the one figure-card exemption, confined to the
analytics page.

### The Sleeve — flat print

The Sleeve declares **no elevation at all**, more strictly than the
desk: it is printed matter, so there is no shadow anywhere on it, not
even the desk's border-only device. Depth comes from the pressing's own
layers — the cover's 6px frame, the band's 6px top rule, the sticker's
6px ring — never from a cast or ambient shadow. Ritmo Vivo's glow and
the desk's `admin-sm`/`admin-md` shadows both stop at the poster's edge.

## Shapes

The shape language is **Rounded**, utilizing a 0.5rem (8px) base radius. This creates a friendly and social feel that balances the "hard" energy of the bold typography.

For the gallery component, images should utilize the `rounded-lg` (16px) or `rounded-xl` (24px) settings to soften the visual impact of photography. Interactive elements like "Join Class" buttons should always use the `rounded-xl` setting to appear more inviting and tactile.

### The Sleeve — cover frame and cream rules

The Sleeve's shape language is flat print, not the rounded-corner
language above. The cover is a hard-edged square framed in a 6px
on-field-ink border; the price sticker is the one circle on the poster,
a 6px-ringed disc rotated -9° like a stuck-on price tag; every other
rule is straight. The cream back cover is divided by a 3px Side-label
rule and 4px dotted track leaders, both in midnight or red ink — never
the rounded, glassy language the rest of the system uses.

## Components

### Buttons

- **Primary:** Solid Rose Red (#E11D48) with white text. High-gloss finish with a subtle top-down gradient.
- **Secondary:** Outlined in Gold (#E9C349) with a hover state that fills with a semi-transparent gold tint.
- **Ghost:** Pure text with an underline that appears on hover, mimicking the rhythm of a musical bar.

### Cards & Event Page

Event cards should feature large background imagery with a glassmorphic footer containing the date, time, and "Book Now" CTA. Use the Gold accent color for "Limited Spots" or "Sold Out" tags.

### Gallery Component

The gallery should support "Live" video previews on hover. Use a masonry layout where every third image spans two columns to maintain a rhythmic, non-linear flow. Each image should have a soft inner-glow border to make it pop against the dark background.

### Social Chips

Use small, pill-shaped chips for "Dance Style" tags (e.g., On1, On2, Cuban). These should use a low-opacity Tertiary Orange background with high-contrast white text to remain legible but secondary to primary actions.

### The Listings Desk — proof marks and decisions

**Margin marks.** Every listing hangs off a drawn mark in its margin:
an open ring for unset, a closed disc for set, a diagonal spike for
killed, a hollow square for standing, a ringed disc for tonight. These
are authored SVG geometry, never glyphs or emoji, and each is labelled
for assistive technology because it is the sole carrier of state on
its row.

**Decisions.** Approve and Reject sit at full UI size (34px) with the
set and killed colours as their border and text. Rejection opens the
existing reason dialog, which is genuine protected-focus work; approval
does not interrupt.

**Set in place.** Deciding an entry never routes and never toasts. The
row leaves the galley, the entry arrives in the column at its true date
position, and the count in the standing rule drops — one propagation,
one meaning. Reject strikes the title through before the row goes.

**Focus swells, the rest compresses.** Opening an entry expands it in
place to full working detail (flyer, description, submitter, address)
while its siblings drop their thumbs and tighten. There is no separate
review page to lose your position in.

### The Sleeve — masthead, cover and track list

**Masthead.** A label-style header: the "Salsa Segura" wordmark left,
the catalogue line right (`SS-<MMDD> · <city code>`), closed by a 4px
rule the full width.

**Front cover.** Flyer art (shown whole, `object-fit: contain`) or
fallback art (cropped, `object-fit: cover`) fills a square field-colour
frame; a lettered title band sits below it; a circular price sticker
("Entry" / amount or "Free") sits pinned to the cover's top-right
corner, rotated -9°.

**Track list.** Side A lists the night's facts — date, time, venue
(with address as a second line), styles — as numbered tracks (A1, A2,
…) with dotted leaders running from a Poster Condensed label to a bold
tabular value, exactly like an LP's printed track list. Side B holds
the QR ("Scan for the night"), the short link (`/e/<first 8 hex of the
event id>`, printed host-relative with no scheme) and the host credit.

### The Night Card — event modal (Ritmo Vivo, unchanged world)

The event modal opens on the **night card**: a sleeve thumbnail
(`SleeveCover`, tappable, opens the full poster preview with a
Story/Feed toggle) beside the four facts — date, time, venue, price and
type — with the title full-width below. Two equal-weight primary
decisions follow, **Send to friends** and **RSVP/Get tickets**
(`.night-actions`, a 1fr/1fr grid); calendar, copy-link and
full-details drop to ghost-variant text-link utilities below them,
never competing with the two decisions. The poster preview is a second
view in the same dialog, not a new route. This is Ritmo Vivo throughout
— dark ground, rose glow, gold links — right up to the thumbnail's
edge, where the Sleeve Boundary Rule takes over.

## Do's and Don'ts

### Do

- **Do** keep the three worlds separate: Ritmo Vivo for anything a
  dancer sees, The Listings Desk for anything an operator works in, and
  The Sleeve for the one artifact that leaves the site.
- **Do** state only counts that represent work in the desk's standing
  rule. Pending decisions, requests, and flags are work.
- **Do** hold the five state colours to state alone, in both the light
  and dark `.admin-shell` themes.
- **Do** keep operator controls at 34px or larger even though the rows
  around them are set at agate scale.
- **Do** let a decision propagate once, across galley, column and
  counts together.
- **Do** press event type to field colour alone (red social, mustard
  class, midnight workshop) and print Side A/Side B labels red on
  every pressing.
- **Do** set the Sleeve in Poster Lettering (titles) and Poster
  Condensed (everything else), never Epilogue or Be Vietnam Pro.

### Don't

- **Don't** put a KPI stat-card grid on an operator surface. Inventory
  figures (total users, total venues, total events) belong to the
  analytics page; the desk reports work, not scale.
- **Don't** add cards, panels, or shadows to the desk. Rules and
  measures do the dividing.
- **Don't** nest one `.admin-card` inside another, and don't give each
  row of a table its own card — a table is the container there. The card
  is for a form, a record, or a dialog, one level deep.
- **Don't** use glyphs or emoji as marks or icons anywhere. Marks are
  drawn geometry; icons come from the Lucide set already in use.
- **Don't** shrink a control to match agate type, and don't grow agate
  type to match a control.
- **Don't** route an operator to a separate page for a decision the
  galley can carry in place.
- **Don't** let Ritmo Vivo's glassmorphism, glow or gradients reach the
  Sleeve, and don't let the Sleeve's flat fields leak back into Ritmo
  Vivo.
- **Don't** show the Sleeve anywhere but the poster export and its
  thumbnail/preview inside the event modal.
- **Don't** add a shadow anywhere on the poster; the Sleeve prints flat.
