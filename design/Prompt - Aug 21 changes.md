# Implementation prompt — Salsa Segura redesign, Aug 21 changes

**Reference build:** `Salsa Segura - Redesign (Standalone).html` — a single offline file containing the
full prototype (public site, directory/profile pages, role dashboards). Open it and use it as the
source of truth for layout, spacing, colors, copy and interaction. Everything below is already built
in that file; the task is to reproduce it in the production codebase (`pages/`, React + CSS).

Design tokens in use: `--bg:#0b1326`, `--surface:#131b2e`, `--surface-high:#171f33`, `--red:#e11d48`,
`--red-bright:#ff5874`, `--gold:#e9c349`, `--gold-light:#ffe088`, `--tertiary:#ffb690`,
`--text:#dae2fd`, `--text-muted:#e5bdbe`, `--text-dim:#ac8889`; display font Epilogue, body Be Vietnam
Pro, logo Great Vibes.

Deep links for reviewing any screen in the reference file: `#screen=<view>` and optionally
`&dir=<directory screen>` — e.g. `#screen=calendar`, `#screen=dj-dash`, `#screen=directory&dir=dj`.

---

## 1. Mobile support (all screens)

Breakpoint `max-width: 640px`.

1. **Bottom tab bar** on public screens: Home · Calendar · Directory · Me, fixed, 50px tall targets,
   active tab in `rgba(225,29,72,.16)` with white label. Hidden on dashboard shells.
2. **Floating "+" button** (56px, red gradient) over the feed on Home and Calendar → Submit event.
3. **Safe areas / notch**: `env(safe-area-inset-top)` on the header, `env(safe-area-inset-bottom)` on
   the tab bar and floating buttons, side insets on the tab row.
4. **Tables become labelled cards**: each row a bordered card, each cell a label/value row where the
   label comes from the column header. Applies to every dashboard table (admin queue, moderator
   reports, users, import preview, host My Events, DJ requests).
5. Header compacts (logo 22px, 16px gutters); page sections drop to 18px side padding; the calendar
   week collapses to one column with empty days collapsing to a compact row.
6. Tablet (641–1040px): hero content centers with eased transitions.

**Review page:** `Salsa Segura - Mobile Frames.dc.html` shows 11 live 390×844 frames (status bar +
island) grouped Public / Dashboards / Account.

## 2. City switcher accessibility

- The BOS/NYC toggle stays in the header at every width (compact pills at ≤640) — it is no longer
  hidden behind the burger. Below 1040px it right-aligns next to the avatar, and the avatar stays the
  last element in the bar.
- After 420px of scroll, a floating city pill (`City · BOS | NYC`) appears bottom-right on public
  screens: bottom 26px on desktop, stacked above the floating "+" on mobile.

## 3. Home + event browsing

1. **Featured Tonight** card is medium: 300px min height, 230px image, title clamp 24–32px, 2-line
   description clamp.
2. **Quick-look modal before the full page**: tapping any feed or featured card opens a compact modal
   — date block, type chip, title, time, venue, price, 3-line description, and for classes and
   workshops three chips (expected level, dance style, teacher). Buttons: **Full details** (opens the
   event page) and **Not now**. Backdrop click and × close it. Centered on desktop, bottom sheet on
   mobile.
3. **Event page lineup is grouped**: `Class instructor` (or `Lesson instructor` on socials) →
   `Performances` → `DJ` → `Also on the night`. Empty groups are omitted; each row links to that
   profile type in the directory.
4. **Classes and workshops get their own view**: an "About the class" / "About the workshop" card
   above the lineup with Taught by · Expected level · Dance style · Class length. Socials do not show
   it.

## 4. Calendar

1. **Week / List toggle** next to Today and the arrows. List view groups by day, hides empty days, and
   shows time + title rows.
2. **Tag filter rail on the left** (224px, sticky): "What's on" checkboxes for Socials / Classes /
   Workshops with per-type counts, a "Dance style" chip group (Every style, Salsa On1, Salsa On2 /
   mambo, Bachata, Live music), a Clear link when any filter is active, and an "N events this week"
   count. Filters apply to both week and list views. Rail stacks above the grid below 900px.

## 5. Role dashboards (shared shell)

One dashboard shell — same left rail, top bar with breadcrumb, avatar menu and card language — with
per-role rail contents.

1. **DJ role** (`dj-dash`, `dj-requests`, `dj-schedule`, `dj-profile`):
   - Overview leads with the **next gig** card (date block, status, venue, set time, room, host, and
     buttons to the schedule and the public page), then 4 KPIs (requests waiting, confirmed nights,
     followers, page views), then "Waiting on your answer" with inline Accept / Decline.
   - Requests: filter tabs (All / Pending / Accepted / Declined) over a table — Date, Event, Host,
     Venue, Set, Status, action. Accept/Decline updates the row, the rail badge and the header count;
     answered rows offer Undo.
   - Schedule: confirmed nights grouped by month with set time and room.
   - My DJ page: completeness percentage with a checklist (done = red dot + ✓, not done = outlined
     circle ○) and an "On your page" facts panel; links to the public DJ page and profile settings.
2. **Host / promoter** — the former Organizer dashboard, relabelled throughout ("Host · Dashboard",
   "HOST DASHBOARD", "Host · My Events", "Host · Bulk Upload") and led by a **next event** card
   (date block, status, title, when + venue, registered count, "Open event dashboard" / "All my
   events").
3. **My Events** gets a **Cards / Table** view toggle; the table shows Event, Date, Venue, Registered,
   Status and the row action.
4. **Moderator** unchanged.
5. The avatar menu ("Demo · switch view") lists Admin, Moderator, Host and DJ dashboards.

## 6. Directory and profile pages

1. Type bar: more top space, tabs spread across the full bar, labels centered.
2. **DJ page**: tabs are Sound · Next dates · Photos. Recorded sets ("Mixes") and Reviews are hidden
   behind flags (default off). The sidebar promotes links instead of booking — "Find me online" with
   the website button plus Instagram and SoundCloud.
3. **Media page**: "What I shoot" (services + rates) is hidden behind a flag (default off) and must be
   togglable from the owner's admin portal; its tab is removed. The sidebar is "Find her online" —
   portfolio site, Instagram, Vimeo.
4. **Performers**: no price listing anywhere in the directory cards — the footer row shows
   `Next: <date>` and the act type. Directory title is "Local performers".
5. **Performer type** is either **Dancer** or **Live music**: a type chip on every card (red for
   dancers, gold for live music), the act name as a secondary chip, and an All acts / Dancers / Live
   music filter above the grid. Seed data includes two live-music acts (Orquesta Bembé — ten-piece
   salsa band; Los Timbaleros — live percussion).

---

### Acceptance checks

- Every dashboard table is readable at 390px with visible column labels.
- The city switcher is reachable without opening a menu at 390, 768 and 1440px.
- Accepting a DJ request updates row status, rail badge and header count together.
- A class event shows the About-the-class card and a Class instructor group; a social shows neither.
- Unchecking Classes in the calendar rail removes class events from both week and list views.
- Performer cards show no prices; the Live music filter returns exactly the two live acts.
