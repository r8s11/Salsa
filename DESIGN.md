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
  sleeve-live-music: "#ffb690"
  sleeve-live-music-deep: "#bf5300"
  sleeve-live-music-ink: "#552100"
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

The sidebar's pending counts (Organizer Requests, Founder Requests) are
Unset work and wear this colour. Rose in the sidebar is wayfinding only,
the current page's icon and the focus ring, never state.

**Category chips are not state.** Taxonomy categories (attendee type,
dance style) are labelled by the `--admin-chip-*` palette in
`src/styles/admin.css` — one tint/ink pair per hue, light and dark. A
chip names a category and never reports an entry's state; the five
colours stay reserved for state.

### The Sleeve — pressing colours

The Sleeve uses a flat spot-colour field chosen by event type — never
decoration, always the type. A red back-cover label prints on every
pressing regardless of field colour.

- **Social pressing** (`#d7263d` field / `#a8182c` deep, on cream
  `#f4ecd8`): the default social night.
- **Class pressing** (`#f2b705` mustard field / `#c99400` deep, on
  midnight `#1b1b3a`): recurring classes.
- **Workshop pressing** (`#1b1b3a` midnight field / `#10102a` deep, on
  mustard `#f2b705`): workshops and intensives.
- **Live Music pressing** (`#ffb690` field / `#bf5300` deep, on
  dark orange `#552100`): live music events.
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

**The Artwork-Not-Ramp Rule.** The cover title uses artwork sizing rather
than the UI type ramp: 24–128px in Story, scaled ×0.8 in Feed, and reduced
for long titles so the complete event name remains visible.

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

**Operator location stays visible.** The admin and host topbar retains
the current location at phone widths; only the parent role and separator
disappear below 640px. The label can ellipsize without shrinking the
navigation or account controls. Admin queue labels match their sidebar
destinations, including nested submission and founder-request records.
Bulk Upload has its own location label. Each sidebar marks only the
most specific available destination as current; parent and child links
never compete for the active state.

**Desktop collapse recovers workspace.** At 1024px and above, the saved
collapse preference changes the sidebar from 260px to a 72px rail.
The sidebar width, topbar left edge, and main-content margin follow the
same shell-scoped `--admin-sidebar-w`, recovering 188px of workspace.
Rail links retain full accessible names; their visual labels are clipped
rather than removed from the accessibility tree, with native title hints
for pointer discovery. The toggle exposes its state and controlled navigation.
Below 1024px, the saved preference never narrows the labelled drawer or
adds a content offset. Returning to desktop restores the chosen rail state.

**Keyboard paths bypass or contain the chrome.** Admin and host shells
start with “Skip to content,” which moves focus to `#admin-main`; the
next Tab continues into the workspace rather than through the sidebar.
Public pages share the same focus-moving skip link, retaining the home
page’s “Skip to events” destination. While the public mobile menu is open,
the header is a labelled modal navigation surface: focus stays among its
visible controls, background content is inert, and page scrolling is locked.
Dismissal restores focus to the menu button. Choosing a destination or
resizing to desktop closes the menu and releases the page.

**Operator account actions are usable, not placeholders.** The topbar
keeps its 32px avatar inside a 44px disclosure target; account links,
Appearance, and theme options have at least 44px-high targets. The
disclosure stays within the viewport and scrolls when height is limited.
Escape closes it and restores trigger focus. Outside pointer interaction,
focus leaving the disclosure, or route navigation closes it without
pulling focus away from the user's next action.

Both topbar and drawer link Account to `/account`. Existing sign-out
scopes stay explicit: the topbar says “Sign out on all devices” (`global`);
the drawer says “Sign out on this device” (`local`). Pending requests
disable repeat activation. Failures announce an in-place alert and allow
retry. The topbar reveals the alert and retry action together, including
when reopened or viewed with enlarged text in a short viewport.

### The Sleeve — story and feed measures

The poster exports at two fixed pixel sizes, never responsive: a
**story** (1080×1920) and a **feed** cut (1080×1350, 4:5). Both stack
the same three prints top to bottom — a label **masthead** (wordmark
and a catalogue line, e.g. `SS-0924 · BOS`), the square **front cover**
(flyer or fallback art, a lettered title band, a circular price
sticker), and the cream **back cover** (Side A facts, Side B QR and
short link). The feed cut is fixed geometry: a 728px square cover beside a
232px **spine** carrying the date, and below them the back cover, whose
232px right column holds the QR directly under the spine. Every feed
track is one line (long values end in an ellipsis), so no fact can move
another region; the story cut keeps wrapped values and the address note.

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

### Mobile header

The full two-tone wordmark leads the bar. A compact city code and a 44px
menu target share the trailing edge; the picker retains the full city
name for assistive technology and shows the full name again in its city list.
The picker panel stays inside the phone viewport, including at 320px.

### Mobile tab bar

The four public destinations stay as labeled links inside a translucent dark
glass dock; blur keeps labels legible while underlying content remains visible.
The selected route has a rose-tinted rubber segment that travels between
links; pointer proximity gently enlarges the dock items. Touch targets remain
steady-sized, reduced-motion users get an immediate selection change, and the
city code remains a non-interactive badge above the bar. Keep the existing
bottom safe-area reservation and the header's city picker as the city control.

Dock clearance belongs to the full public layout, after the footer, rather
than to the main content before it. Below 640px, reserve `--tab-bar-h` plus
`--space-lg` so the copyright and footer actions can scroll above both the
dock and its raised city badge. Desktop adds no dock clearance.

The floating city picker yields while the public footer intersects the
viewport, leaving support and contact actions unobscured. It returns when
the footer leaves view only if the visitor remains past its scroll threshold.
The dock's city badge and the header's city picker remain available.

### Cards & Event Page

Event cards should feature large background imagery with a glassmorphic footer containing the date, time, and "Book Now" CTA. Use the Gold accent color for "Limited Spots" or "Sold Out" tags.

### Gallery Component

The gallery should support "Live" video previews on hover. Use a masonry layout where every third image spans two columns to maintain a rhythmic, non-linear flow. Each image should have a soft inner-glow border to make it pop against the dark background.

### Shopify storefront — Retail Edit (Ritmo Vivo)

Retail Edit is the shipping catalog, product and cart design on `/shop` and
`/shop/products/:handle`; it is no longer a development-only variant.
The catalog opens with an editorial merchandise hero: self-hosted Barlow
Condensed display type, merchant photography, navy grounds, gold actions and
restrained rose accents. The collection uses three columns above 700px,
two columns from 381px to 700px, and one column at 380px and below.
Whole-product merchant photography uses `object-fit: contain`; captions carry
real names, Shopify starting prices and an explicit View product action.
No customer photos, shipping promises or scarcity claims are manufactured.
GSAP choreographs readable hero words and section headings; every split heading
retains one unsplit accessible name. Catalog-only Lenis smooths wheel input,
with native touch scrolling, dialog exclusion, media/font measurement refresh,
and cleanup on unmount. Reduced motion skips both engines and renders final states.
No WebGL canvas is needed. Solar icons by 480 Design are bundled locally through
Iconify and attributed under CC BY 4.0 at the bottom of the catalog.

The product gallery sits beside a sticky purchase panel on desktop. Named
option buttons expose selection and unavailable combinations; every option
has a 44px minimum target. Product details live in a native disclosure.
On phones, the quantity/add bar stays above the public dock and safe area;
short landscape viewports use an in-flow bar. The cart is a protected-focus
drawer with real Shopify totals and a hosted-checkout handoff.

Shared-image navigation and the confirmed-add flight preserve direct
navigation and purchase behavior under reduced motion or unsupported APIs.
The flight sits below the cart modal, never covering checkout controls.
Styles and components live with the production pages/cart; no query-selector
switcher, discarded Drop Grid, or preview-only production branch remains.
All photography is merchant-supplied Shopify CDN imagery, not generated assets.
Missing product media retains a deterministic named fallback. When JavaScript
is disabled, the static app shell provides a merchant-store link instead of a blank page.

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


### The Calendar Planner — EventManager and submission (Ritmo Vivo, dark nightlife)

The public calendar (`/calendar`) is a nightlife discovery stage and
community submission surface, executed in Ritmo Vivo's dark navy palette
rather than an administrative light planner. Ground is the deep neutral
slate (`--bg: #0b1326`, `--surface: #0b1326`, `--surface-high: #222a3d`);
accents are Rose Red (`--red: #e11d48`) on high-action buttons and Stage
Gold (`--gold: #e9c349`) on focus rings (`outline: 2px solid var(--gold)`
with `outline-offset: 3px`). Typography uses Epilogue 800 display for
the stage header ("Dance calendar." with a rose period dot, -0.035em tracking)
and Be Vietnam Pro for body copy and listing metadata. Tabular numerals
(`font-variant-numeric: tabular-nums`) are enforced across calendar grids,
week numbers, dates, and listing time slots so figures align vertically.

**The Read-Only Discovery Rule.** The public calendar is strictly read-only
discovery. Public visitors and dancers cannot drag, edit, or delete listings.
Approved events from the database remain the single source of truth; all
additions flow through the submission dialog into the pending moderation queue.

**The Responsive View-Refocus Rule.** Below 769px, or on coarse-pointer viewports
below 1024px wide and at most 500px high, multi-column grids yield to chronological
list or card views. Narrow screens do not force month cells into micro-boxes:
they refocus to 56×72px sleeve thumbnails, event title, time, and venue metadata.

**The Poster-Fallback Guarantee.** Every approved event is guaranteed shareable
artwork. Flyers are strictly optional; events submitted without a flyer
automatically inherit the generated Fania-style Sleeve poster rather than an
empty placeholder or generic fallback image.

**The Protected Submission Rule.** The New Event modal is a controlled,
accessible Radix dialog with backdrop blur (`rgba(11, 19, 38, 0.78)` with
8px blur), focus trapping, client-side validation error summaries, unauthenticated
submitter contact requirements, and strict focus restoration to the invoking
trigger upon dismissal.
Compact submission inputs, selects, and textareas use 16px text to avoid
browser focus zoom on phones; field targets remain at least 44px high.

#### Stage header and toolbar

The stage header pairs the Epilogue display title and balanced subtitle
("salsa & bachata, hasta la madrugada") with a segmented metro pill switch
(Boston / New York City). The controlled `EventManager` toolbar
(`src/components/ui/event-manager.tsx`) anchors the planner chrome:
- **Period navigation:** Month and week title (`aria-live="polite"`), step
  controls (`< Today >`), and period context appear only in Month/Week views.
  List/Cards retain the full upcoming feed, labeled "Upcoming events" in the
  toolbar and sidebar, without ineffective date controls. Stepping to another period moves
  the title 10px and the grid 28px in from the side time moved toward (later
  from the right), 300ms `cubic-bezier(0.16, 1, 0.3, 1)` from 35% opacity. The
  grid frame stays fixed and clips its moving contents. Switching views or resizing keeps the date and
  never travels. Schedule-X's built-in slide is off (`skipAnimations`) so this is
  the only grid motion. Reduced motion keeps a 160ms opacity settle with no movement.
- **Search bar:** Real-time search matching event titles, locations, venues,
  descriptions, and dance styles, ignoring case and accents ("salon" finds "Salón"),
  with an instant clear button (`X`) that returns
  focus to the input. The entire search bar's metal perimeter is the one authored motion
  moment: lazy-loaded Paper liquid metal runs for 650ms on focus, then stops.
  Blur/unmount disposes the shader; hidden/offscreen rendering pauses. Reduced motion
  and unavailable WebGL use a static rim without changing search behavior.
  The decorative masked border follows focus anywhere inside the bar; moving between
  the icon, input, and clear button does not restart it. There is no separate icon
  frame or inner input outline. Focus leaving the whole bar disposes the shader.
  The rim alone uses material neutrals (`#77777b`, `#dedbd5`, `#85858a`, `#c5b89d`)
  and shader back/tint (`#99999c`, `#fff0d4`); these are not content or category colors.
- **View switcher:** Segmented pill group toggling Month Grid, Week, List,
  and Cards on desktop; compact screens filter to List and Cards only. The
  selected view, like the selected city in the stage switch, sits on the dock's
  rubber segment (`src/components/ui/RubberSegment.tsx`): the thumb stretches
  over the old and new pill (190ms) and contracts onto the new one (300ms
  spring), in the calendar's neutral `--surface-high` rather than the dock's
  rose. Reduced motion moves it at once.
- **Action CTA:** Prominent solid Rose Red button (`+ New event`) that
  launches the submission dialog. No duplicate footer or empty-state submission CTA.

#### Desktop sidebar and responsive tiers

- **Desktop (≥ 1024px):** A 208px left sidebar displays the active period
  range label, live category breakdown counts under "What's on" (Social,
  Class, Workshop, Live Music), dance style taxonomy selection (e.g. On1,
  On2, Cuban, Bachata), and a 7-day upcoming event count tally.
- **Tablet (769px – 1023px):** The sidebar drops away to maximize grid measure;
  event type pills and the dance style selector move into the `EventManager`
  toolbar filters row.
- **Compact / Mobile:** The stage uses a 28px Epilogue heading within the display
  composition band and keeps the existing subtitle. The header city picker is the
  sole city control: duplicate stage and floating city selectors disappear on this
  surface only. Upcoming events and New event share a row; a full-width labeled
  List/Cards switch fills the next. Search stays full-width. Type/style controls sit in a closed native
  Filters disclosure with an active-selection count; closing it never clears filters.
  The disclosure unfolds from its summary (280ms open, 180ms close) as its chevron
  turns. Browsers without size-keyword interpolation and reduced-motion users get an
  instant open.
  List/Cards labels stay visible even at 320px.
  Every visible calendar control retains a 44px minimum touch target.
**Feed states:** A failed first load names the city ("We couldn't load Boston's
listings.") and never shows the raw driver error; its Try again button stays in
place while retrying and gets focus back if the retry fails. A failed background
refresh keeps the last loaded events on screen. With no city chosen, the
calendar asks for one rather than reporting an empty city.
**List details:** Date-grouped rows with 1px borders show title, labeled event type
using the existing calendar colors, a two-line description (one line on compact
screens), start–end time, venue, and dance-style badges. The list renders 50
chronological events per batch; “Show more events” extends it and moves keyboard
focus to the first newly revealed event. Opening details and unchanged background
refreshes retain expanded rows and the opener's focus on close. The converted event
collection stays stable while cached data is unchanged; city, filter, or event-data
changes reset pagination. Multi-night events show the actual end date;
overnight events use a next-day marker. Missing or unreachable flyers use event-type
fallback art. Fine-pointer hover moves only the detail arrow by 2px over 180ms; reduced
motion removes that movement. Rows have no entrance or filter-triggered reveal. Date
group headings use 18px Epilogue, event titles 16px Epilogue, descriptions and
time/venue metadata 14px Be Vietnam Pro, and type/style labels 12px. Search text is
16px at all widths; the last row can scroll clear of the fixed dock. Desktop retains
its sidebar and month/week views.

#### Anonymous submission and moderation flow

The submission dialog (`CalendarSubmissionDialog`) opens in-place without
leaving the calendar. Guest attendees can submit unlisted nights without an
account when submissions are open; `submitter_name` and `submitter_email`
are mandatory contact fields for unauthenticated guests, while authenticated
organizers have contact credentials prefilled. Submissions validate with
`FormErrorSummary` focusing the error summary and linking to invalid fields. The dialog
explicitly informs submitters that events enter a `pending` moderation queue
reviewed by community moderators and do not appear on the calendar until
approved. Flyer upload is tucked into a collapsible `<details>` disclosure
with reassurance that flyerless events receive a generated Sleeve poster.
Upon submission, the form fields lock until the request settles. If the submission-access
lookup fails, the dialog offers an in-place retry. A success confirmation card offers
“Done” (closing with focus restoration to the trigger button) or “Submit Another Event”.

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
