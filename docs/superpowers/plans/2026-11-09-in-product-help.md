# In-Product Audience Help Implementation Plan

> **Execution:** Initially inline-only; the owner later authorized subagents. Work continues task by task, with final integration and verification owned by the parent session.

**Goal:** Publish the six audience guides plus the shared listing-access guide as help routes inside the product, and link to the matching guide from the sign-in, submission, claim, workspace, Host and account screens, choosing the link and its explanation from the person's task and permissions.

**Architecture:** The guide markdown becomes tracked app content under `src/content/help/`, listed by a JSON manifest that both the React app and the build scripts read (the pattern `src/shared/seo/routeMeta.json` already uses). A lazy `/help` route renders the markdown through `marked`'s lexer into React elements (no `innerHTML`). A pure `selectHelp(context)` function picks the guide topic and a one-sentence reason for each screen; one `ContextHelp` component renders it. A vitest suite fails CI when a guide link, anchor, route or UI label goes stale.

**Tech Stack:** React 19, react-router-dom 7, Vite 8 (`?raw` imports), vitest 5 + Testing Library, `marked` (new dependency), existing `scripts/public-routes.mjs` sitemap/prerender pipeline.

**Spec:** `docs/user-guides/improvements.md`, item 12 "Put audience help inside the product" (lines 119-126). No approved design exists; the defaults in `## Decisions to confirm` stand in for one and every task is written against them.

## Confirmed execution rulings

- Keep `docs/user-guides/` as the single tracked Markdown source. Do not move, duplicate or delete the eight guides. The manifest stays at `src/content/help/guides.json`; `guides.ts` imports only the eight allowed sources and normalizes metadata and links for product rendering.
- These rulings override the original move/delete steps and source paths in Tasks 1, 3 and 8 below. Repository-facing headings, review notes and Markdown links remain readable in the canonical files; product normalization removes internal tracker/review prose and rewrites guide/site links.
- Reuse the approved legal reading layout and contextual-help form. No separate design generation or new tokens.
- Screenshots remain deferred. No production changes, push, merge or deployment are authorized by this execution.

## Execution result

Tasks 1–8 completed locally on `feature/in-product-help-20261110`. The canonical guide files remain in place. The stale-help gate exercises eight sources, deduplicated rendered routes and 20 control scenarios; deliberate broken-anchor and stale-control mutations failed and were restored.

Verification: TypeScript and full ESLint passed; 3,422 tests across 307 files passed. Production build prerendered 774 routes, with all eight help HTML pages and sitemap entries and no private improvements chunk. Browser checks at 1280px and 390px verified deep links, sign-in contextual help, unknown-guide 404, contained mobile tables and keyboard horizontal scrolling. No push, merge or deployment performed.

## Decisions to confirm

1. **Source of truth.** Default: move the guides to tracked `src/content/help/*.md` and delete the `docs/user-guides` copies except `improvements.md`. `.gitignore:191` ignores all of `/docs/` and `git ls-files docs/user-guides` is empty, so the guides are untracked today and would never ship from there. If the owner prefers `docs/user-guides/`, un-ignore it (`/docs/*` then `!/docs/user-guides/`) and change only the paths in Tasks 1, 3 and 8; this also reverses the earlier choice to keep these files local.
2. **Rendering.** Default: markdown parsed at runtime in a lazy route chunk with `marked`, rendered to React elements. If the owner wants no new dependency, hand-author the guides as TSX: Task 2 and the markdown half of Task 3 disappear, and copy lives in two forms until the markdown is retired.
3. **Visibility.** Default: public, indexable `/help` and `/help/:slug`, added to the sitemap (guides contain no private data). If members-only, wrap the routes in `RequireAuth` and set `robots: "noindex, follow"`; Task 4's sitemap and prerender steps shrink to the `noindex` entry.
4. **URL shape.** Default: `/help` index plus one route per guide (`/help/dancers`, `/help/djs`, `/help/venues`, `/help/organizers`, `/help/artists`, `/help/schools`, `/help/listing-access`). One long `/help` page would make every anchor link `/help#...` and drop per-guide metadata.
5. **Prerender depth.** Default: heading and description only, like `/privacy` today (the `default` branch of `stablePage` in `scripts/prerender-routes.mjs`). Full-text prerender needs a second, Node-side markdown renderer and a duplicated slug rule.
6. **Contextual form.** Default: a short inline `ContextHelp` block (one reason sentence plus one link), never a drawer, modal or tooltip. A drawer would need new focus-trap work and would hide the reason text.
7. **Screenshots.** Default: none in this release, and a test rejects any image token. If the owner wants them later, add an allowlist in `guides.json` of images reviewed to contain only synthetic data.
8. **Stale-help gate.** Default: part of the normal `npx vitest run` that CI already executes (`.github/workflows/azure-static-web-apps-lemon-stone-01afe980f.yml:29`). A separate script would not run on every route or label change.
9. **Guide snapshot.** Default: Task 1 starts only after the in-flight guide updates land (see Global Constraints). Copying earlier would freeze stale text into tracked content.
10. **Admin and moderator help.** Default: out of scope; the guides cover six public audiences. `/admin` pages get no help links.

## Global Constraints

- Item 12, verbatim: "Publish them through a maintained help surface, with contextual links from sign-in, submission, claims, and each workspace."
- Item 12, verbatim: "Prefer help selected by the current task and permissions: explain why a control is missing, rather than showing everyone administrator instructions."
- Item 12, verbatim: "do not publish screenshots of private attendee/account information." No images ship in this plan.
- Item 12, verbatim: "each of the six audiences can reach the matching guide from the relevant screen, and help links are checked whenever routes or labels change."
- Six audiences and their guide slugs: dancers `dancers`, DJs `djs`, venue owners/managers `venues`, organizers `organizers`, artists/instructors `artists`, school owners/managers `schools`. Shared guide: `listing-access`.
- Content gate: the guides are being edited right now by the fixes for backlog items 1-7 (organizers publish existing drafts; attendee edit page; check-in undo; public member page `/u/:username`; artist selector on school offerings; corrected claim-dialog copy; event-timezone-correct listing rows). Task 1 copies the guides as they are on the day it runs. Headings, anchors and labels named in this plan are candidates; re-read each guide and take the real heading text. The Task 3 suite is what proves them.
- Guide links inside `src/content/help/*.md` are site-rooted (`/signin`, `/help/organizers#get-organizer-access`) or `https://` or `mailto:`; never `*.md`, never `https://www.salsasegura.com/...`.
- Reuse `legal-page` classes from `src/pages/LegalPage.css` for reading layout, `ui-button` for buttons, no new design tokens, no new colors. Every control has an accessible name.
- Clean cutover: no duplicate guide copies in `docs/user-guides` after Task 8, no help text in two places.
- Commits: `docs/` is gitignored; stage this plan with `git add -f docs/superpowers/plans/2026-11-09-in-product-help.md`.
- Update `DESIGN.md` for the new surface (Task 8). `npx tsc -b`, `npm run lint` and `npx vitest run` must pass at the end.

## Review Focus

1. A heading is renamed or removed in a guide after the app links to it (`/help/organizers#important-drafts-...`): the suite must fail naming the guide and anchor, not leave a dead link. Owning test: Task 3 and Task 5.
2. An Editor, a Manager, an Owner and a platform admin open the same workspace: each sees only the reason that matches their role; an Owner or admin never sees "ask an Owner" instructions, and no one is shown administrator steps. Owning test: Task 5 `selectHelp.test.ts`.
3. `/help/nope`, `/help/%2e%2e%2fsecret` and `/help/dancers/extra` must render the 404 page, never a blank page or an exception, and the loader must only read manifest slugs. Owning test: Task 4.
4. A guide contains something the renderer does not support (raw HTML, an image, an `# H1`, a relative `.md` link): rendering must throw in tests rather than emit raw HTML or silent blanks. Owning test: Task 2.
5. Two headings with the same text (for example two "Troubleshooting" sections) must get distinct, stable ids (`troubleshooting`, `troubleshooting-1`), and a `#anchor` in the URL must scroll to the heading after the lazy guide has loaded. Owning test: Task 2 and Task 4.

---

### Task 1: Guide content package

**Files:**
- Create: `src/content/help/guides.json`
- Create: `src/content/help/index.md`, `dancers.md`, `djs.md`, `venues.md`, `organizers.md`, `artists.md`, `schools.md`, `listing-access.md` (moved from `docs/user-guides/`; `README.md` becomes `index.md`)
- Create: `src/features/help/slug.ts`, `src/features/help/slug.test.ts`
- Create: `src/features/help/guides.ts`, `src/features/help/guides.test.ts`
- Modify: `package.json` (add `"marked"` to `dependencies`)

**Interfaces:**
- Produces, `slug.ts`: `export function headingSlugger(): (text: string) => string` (GitHub-style: lowercase, strip backticks and punctuation, spaces to `-`, repeated text gets `-1`, `-2` suffixes; one slugger per document).
- Produces, `guides.ts`:
  - `export type GuideSlug = "dancers" | "djs" | "venues" | "organizers" | "artists" | "schools" | "listing-access"`
  - `export interface GuideMeta { slug: GuideSlug; title: string; description: string; audience: string; lastReviewed: string }` (`lastReviewed` is `YYYY-MM-DD`)
  - `export const GUIDES: readonly GuideMeta[]` (order of `guides.json`)
  - `export function guideBySlug(slug: string | undefined): GuideMeta | undefined`
  - `export function loadGuideSource(slug: GuideSlug | "index"): Promise<string>` (lazy `import.meta.glob("/src/content/help/*.md", { query: "?raw", import: "default" })`)
  - `export function guidePath(slug?: GuideSlug, anchor?: string): string` (`/help`, `/help/schools`, `/help/schools#timetable`)
- `guides.json` shape: `{ "guides": GuideMeta[] }`. Titles are the guides' current H1 text.

- [ ] **Step 1: Read the current guide content and implementation statuses.** Use the completed items in `docs/user-guides/improvements.md`; do not copy obsolete workaround text. Respect the source-location decision before moving or deleting local guides.
- [ ] **Step 2: Write failing tests.**
  - `slug.test.ts`: `headingSlugger()("Create an account or sign in")` is `"create-an-account-or-sign-in"`; `"Important: drafts in the current Host editor"` is `"important-drafts-in-the-current-host-editor"`; `"The \`/host\` desk"` is `"the-host-desk"`; calling twice with `"Troubleshooting"` gives `"troubleshooting"` then `"troubleshooting-1"`; a fresh slugger restarts the counts.
  - `guides.test.ts`: invalid or traversal-like slugs do not load a guide; valid slugs resolve to the matching audience; in-page and cross-guide anchors resolve. Content loading is exercised by rendering real guide headings and links in Task 4, not by asserting strings are non-empty.
- [ ] **Step 3: Run `npx vitest run src/features/help/slug.test.ts src/features/help/guides.test.ts`.** Expected: FAIL (modules missing).
- [ ] **Step 4: Move and transform content only after the source-location decision is approved.** Strip the document H1 (the page owns it), review-date prose and all internal rollout/backlog links or notes. Convert production site links to root-relative app paths; map guide `.md` links and fragments to `/help/<slug>#anchor`; map guide `README.md` links to `/help`. In `index.md`, remove the internal tracker paragraph and generated guide table. Keep only user-facing instructions for functionality actually released. Create `guides.json` metadata from each guide's real title, audience and review date.
- [ ] **Step 5: Implement `headingSlugger` in `slug.ts` and `GUIDES`, `guideBySlug`, `loadGuideSource`, `guidePath` in `guides.ts`.** Run `npm install marked`.
- [ ] **Step 6: Run the two test files.** Expected: PASS. Also run `npx vite build --logLevel error` once to confirm `?raw` works while `vite.config.ts` has `assetsInclude: ["**/*.md"]`; if the raw import returns a URL instead of text, add `?raw` handling per Vite docs and record it in the commit message.
- [ ] **Step 7: Commit.**

```bash
git add src/content/help src/features/help/slug.ts src/features/help/slug.test.ts src/features/help/guides.ts src/features/help/guides.test.ts package.json package-lock.json
git commit -m "feat(help): move audience guides into tracked app content"
```

### Task 2: Markdown renderer

**Files:**
- Create: `src/features/help/markdown/parseGuide.ts`
- Create: `src/features/help/markdown/MarkdownBlocks.tsx`
- Test: `src/features/help/markdown/MarkdownBlocks.test.tsx`

**Interfaces:**
- Consumes: `headingSlugger` from `src/features/help/slug.ts`.
- Produces, `parseGuide.ts`:
  - `export class UnsupportedMarkdownError extends Error { constructor(public readonly kind: string, detail: string) }`
  - `export interface GuideHeading { depth: 2 | 3 | 4; text: string; slug: string }`
  - `export function parseGuide(source: string): { tokens: Token[]; headings: GuideHeading[] }` (`Token` is `marked`'s `Token` type from `marked.lexer`). Throws `UnsupportedMarkdownError` for `html`, `image`, `blockquote`, `code`, an `# H1`, and for a link whose href is not site-rooted (`/`), `https://`, `mailto:` or a `#fragment`.
- Produces, `MarkdownBlocks.tsx`: `export function MarkdownBlocks({ source }: { source: string }): JSX.Element`. Renders headings with `id={slug}`, paragraphs, nested ordered/unordered lists, tables, `strong`, `em`, `codespan`, links. Site-rooted links render as react-router `<Link to>`; `https://` links render `<a target="_blank" rel="noopener noreferrer">`; `mailto:` as a plain `<a>`. A table is wrapped in `<div role="region" tabIndex={0} aria-label="<preceding heading text> table">` so it scrolls by keyboard.

- [ ] **Step 1: Write failing tests** in `MarkdownBlocks.test.tsx` (wrap in `MemoryRouter`):
  - `"## Title\n\nSee [sign in](/signin)."` gives a level-2 heading named `Title` with `id="title"` and a link `sign in` with `href="/signin"`.
  - `[Contact](https://example.com/x)` has `target="_blank"` and `rel="noopener noreferrer"`.
  - Two `## Troubleshooting` headings get ids `troubleshooting` and `troubleshooting-1`; `parseGuide` returns both in `headings`.
  - A table renders `columnheader` cells and a region named `Fees table` when it follows `## Fees`.
  - `"1. a\n   - b"` renders a list inside a list item; `**x**` renders `<strong>`; `` `y` `` renders `<code>`.
  - `parseGuide` throws `UnsupportedMarkdownError` for `<script>alert(1)</script>`, `![x](/a.png)`, `# H1`, `[x](organizers.md)` and a `> quote`; the error `kind` names the offending type.
- [ ] **Step 2: Run `npx vitest run src/features/help/markdown`.** Expected: FAIL.
- [ ] **Step 3: Implement `parseGuide` and `MarkdownBlocks`.** Walk `marked.lexer` tokens recursively, no `dangerouslySetInnerHTML`; heading ids come from one `headingSlugger()` per `parseGuide` call and `MarkdownBlocks` reuses `parseGuide`'s result.
- [ ] **Step 4: Run the tests.** Expected: PASS.
- [ ] **Step 5: Commit.**

```bash
git add src/features/help/markdown
git commit -m "feat(help): render guide markdown to React without innerHTML"
```

### Task 3: Stale-help checks

**Files:**
- Create: `src/features/help/guideIntegrity.test.tsx`
- Create: `src/content/help/uiLabels.json` (only if needed to describe runtime UI verification scenarios; never source-code fragments).

**Interfaces:**
- Consumes: `GUIDES`, `loadGuideSource`, `guideBySlug` (Task 1); `parseGuide`, `GuideHeading` (Task 2); `Providers` from `src/app/providers`, `App` from `src/app/App` (render pattern copied from `src/pages/LegalPages.test.tsx`, including the `vi.mock("../lib/supabase", ...)` block).
- Produces: permission-aware UI scenarios identifying a route, seeded state, accessible control role/name, and the matching guide section. Each scenario drives the actual rendered control; no scanning source text for labels.

- [ ] **Step 1: Write the suite** (it fails until the content is clean). Assertions, over every guide in `GUIDES` plus `index`:
  1. `parseGuide` does not throw (this rejects images, raw HTML and unsupported links).
  2. Every site-rooted link: if it starts with `/help`, the slug is in `GUIDES` (or the path is exactly `/help`) and any `#fragment` is the `slug` of a heading in that guide; otherwise the path (without hash) is rendered through `<Providers><App/></Providers>` after `window.history.replaceState({}, "", path)`, the `.page-loading` placeholder is awaited away, and the heading `Page Not Found` is absent. Signed-out, protected routes redirect to `/signin`, which counts as resolved. Deduplicate paths so each renders once.
  3. For each documented control, render its screen with the corresponding permissions and fixture state; locate it by accessible role/name, then exercise the action described by help. A stale label or unreachable action fails with the guide and scenario name. Never grep app source to claim that a label works.
  4. No guide contains an email address other than `info@salsasegura.com`.
- [ ] **Step 2: Run `npx vitest run src/features/help/guideIntegrity.test.tsx`.** Expected: failures identify real dead links or controls.
- [ ] **Step 3: Fix the guide or scenario to match the intended rendered behavior.** Do not add wording-only assertions or pin incidental source formatting.
- [ ] **Step 4: Prove the gate detects a broken guide anchor and a control whose accessible name no longer matches its guide instruction.** Revert the temporary mutations afterward.
- [ ] **Step 5: Run the suite again.** Expected: PASS.
- [ ] **Step 6: Commit.**

```bash
git add src/features/help/guideIntegrity.test.tsx src/content/help/uiLabels.json src/content/help
git commit -m "test(help): fail CI when a guide link, route or label goes stale"
```

### Task 4: Help routes, pages and SEO

**Files:**
- Create: `src/features/help/pages/HelpIndexPage.tsx`, `src/features/help/pages/HelpGuidePage.tsx`, `src/features/help/help.css`
- Test: `src/features/help/pages/HelpPages.test.tsx`
- Modify: `src/app/App.tsx` (lazy imports beside lines 10-15; two `<Route>`s inside the `MainLayout` group after `path="data-deletion"`, currently line 307)
- Modify: `src/shared/seo/routeMeta.json` (add key `help`: path `/help`, title `Help`, description summarising the guides)
- Modify: `scripts/public-routes.mjs` (add `"help"` to `PAGE_KEYS` at line 28; in `publicRoutes` at lines 49-63 append one `{ path: "/help/<slug>", title, description, type: "page" }` per entry read from `src/content/help/guides.json` with `readFileSync`, as line 12 does for `routeMeta.json`)
- Modify: `src/components/layout/Footer.tsx` (add `<Link className="footer-link" to="/help">Help</Link>` after the data-deletion link, around line 87)
- Modify tests: `scripts/generate-sitemap.test.mjs`, `scripts/prerender-routes.test.mjs`

**Interfaces:**
- Consumes: `GUIDES`, `guideBySlug`, `loadGuideSource`, `guidePath` (Task 1), `MarkdownBlocks`, `parseGuide` (Task 2), `useDocumentMeta` (`src/shared/seo/useDocumentMeta.ts`), `canonicalUrl` (`src/utils/seo.ts`), `NotFoundPage` (`src/pages/NotFoundPage.tsx`).
- Produces: routes `/help` (`HelpIndexPage`, default export) and `/help/:slug` (`HelpGuidePage`, default export). `HelpGuidePage` reads `useParams<{ slug: string }>()`, renders `<NotFoundPage />` when `guideBySlug(slug)` is undefined, otherwise `<main className="legal-page help-page"><article className="legal-page__inner">` with the manifest title as `h1`, `Last reviewed: <long date>` in `legal-page__updated`, a `nav` named `On this page` listing level-2 headings as `#slug` links, `MarkdownBlocks`, and a `nav` named `Other guides`. States: `role="status"` text `Loading guide…`; load failure `role="alert"` with a link to `/contact`. After the source loads, if `location.hash` is set, call `document.getElementById(hash.slice(1))?.scrollIntoView()`. `HelpIndexPage` renders `h1` `Help`, `MarkdownBlocks` of `index`, and a list linking every guide in `GUIDES` by title with its `audience`.

- [ ] **Step 1: Write failing tests.**
  - `HelpPages.test.tsx` (render `App` at each path as `LegalPages.test.tsx` does): `/help` has a level-1 heading `Help` and a link for each of the seven guide titles with `href="/help/<slug>"`; `/help/schools` has level-1 heading equal to the `schools` manifest title, a `navigation` named `On this page` whose links all start `#`, and the document title updates; `/help/schools#<a real h2 slug>` calls the mocked `Element.prototype.scrollIntoView` once after load; `/help/nope`, `/help/%2e%2e%2fsecret` and `/help/dancers/extra` render `Page Not Found`.
  - `generate-sitemap.test.mjs`: `buildSitemapXml([])` contains `https://www.salsasegura.com/help` and each `/help/<slug>`.
  - `prerender-routes.test.mjs`: `buildPage` for the `/help/schools` route returns the guide's title and description in `title` and `description` and its `body` contains the title in an `<h1>`.
- [ ] **Step 2: Run** `npx vitest run src/features/help/pages scripts/generate-sitemap.test.mjs scripts/prerender-routes.test.mjs`. Expected: FAIL.
- [ ] **Step 3: Implement** the pages, `help.css` (reuse `legal-page` selectors; add only `.help-page` table, nav and card rules from existing tokens), the route registrations, `routeMeta.json` entry, `publicRoutes` change and the Footer link.
- [ ] **Step 4: Run the same command plus `npx vitest run src/components/layout`.** Expected: PASS.
- [ ] **Step 5: Run `npm run build`** and confirm `dist/help/index.html`, `dist/help/schools/index.html` exist and `dist/sitemap.xml` lists them.
- [ ] **Step 6: Commit.**

```bash
git add src/features/help src/app/App.tsx src/shared/seo/routeMeta.json scripts/public-routes.mjs scripts/generate-sitemap.test.mjs scripts/prerender-routes.test.mjs src/components/layout/Footer.tsx
git commit -m "feat(help): add /help and per-guide routes with sitemap entries"
```

### Task 5: Help topics and permission-aware selection

**Files:**
- Create: `src/features/help/helpTopics.ts`, `src/features/help/selectHelp.ts`, `src/features/help/ContextHelp.tsx`
- Test: `src/features/help/helpTopics.test.ts`, `src/features/help/selectHelp.test.ts`, `src/features/help/ContextHelp.test.tsx`

**Interfaces:**
- Consumes: `GuideSlug`, `guidePath` (Task 1); `parseGuide`, `loadGuideSource` for the anchor test; `ManagedKind`, `WorkspaceRole` from `src/features/workspaces/model.ts`.
- Produces, `helpTopics.ts`:
  - `export type HelpTopicId = "account-sign-in" | "personal-profile" | "account-security" | "submit-event" | "claim-listing" | "claim-review" | "listing-permissions" | "listing-team" | "organizer-access" | "organizer-roles" | "event-workflow" | "door-attendees" | "workspace-school" | "workspace-venue" | "workspace-artist" | "workspace-dj"`
  - `export interface HelpTopic { guide: GuideSlug; anchor?: string; linkText: string }`
  - `export const HELP_TOPICS: Record<HelpTopicId, HelpTopic>`. Candidate targets, re-read from the guides at implementation time: `account-sign-in` → dancers `create-an-account-or-sign-in`; `personal-profile` → dancers `update-your-personal-profile`; `account-security` → dancers `protect-your-account`; `submit-event` → dancers `suggest-an-event`; `claim-listing` → listing-access `submit-a-claim`; `claim-review` → listing-access `after-review`; `listing-permissions` → listing-access `understand-listing-permissions`; `listing-team` → listing-access `add-a-teammate`; `organizer-access` → organizers `get-organizer-access`; `organizer-roles` → organizers `what-each-organizer-role-can-do`; `event-workflow` → organizers `choose-the-right-event-workflow`; `door-attendees` → organizers `attendees-and-the-door`; `workspace-school` → schools; `workspace-venue` → venues; `workspace-artist` → artists; `workspace-dj` → djs (no anchor).
- Produces, `selectHelp.ts`:
  - `export type HelpContext = { surface: "sign-in" } | { surface: "submit"; signedIn: boolean; canSubmit: boolean; isOrganizer: boolean } | { surface: "claim"; kind: ManagedKind; claim: "signed-out" | "none" | "pending" | "rejected" } | { surface: "workspace"; kind: ManagedKind; role: WorkspaceRole; published: boolean } | { surface: "workspace-denied" } | { surface: "host-desk"; hasOrganizerAccess: boolean; canCreateEvents: boolean; hasListings: boolean } | { surface: "host-events"; hasOrganizerAccess: boolean; canCreateEvents: boolean } | { surface: "host-door" } | { surface: "profile" } | { surface: "account" }`
  - `export interface HelpItem { topic: HelpTopicId; message?: string }`
  - `export function selectHelp(context: HelpContext): HelpItem[]`. Rules (copy is exact):
    - `workspace`: first item is the kind's guide topic (`school`→`workspace-school`, `venue`→`workspace-venue`, `instructor`→`workspace-artist`, `dj`→`workspace-dj`), no message. Role `editor` adds `listing-permissions` with message `Your role is Editor, so Profile and Team are not shown.`; role `manager` adds `listing-team` with message `Your role is Manager, so Team is not shown. Only an Owner can add or remove people.`; `owner` and `admin` add nothing. `published: false` adds `listing-permissions` with message `This listing is awaiting review, so it has no public page yet.` once (no duplicate topics).
    - `workspace-denied`: `claim-listing` with message `Your access may have changed. If you have a pending claim, access has not been granted yet.`
    - `host-desk`: no organizer access and no listings → `organizer-access` with message `Organizer access is granted by the Salsa Segura team once a request is approved.`; listings but no organizer access → `organizer-access` with message `A listing workspace does not include event management. Events belong to an organizer.`; organizer access but `canCreateEvents` false → `organizer-roles` with message `Creating and importing events needs an active Owner or Manager role on an organizer.`; otherwise `event-workflow`, no message.
    - `host-events`: same three branches as `host-desk` without the listings case; `host-door` → `door-attendees`.
    - `claim`: `signed-out` → `account-sign-in` with message `Sign in first; a claim is tied to your personal account.`; `none` → `claim-listing`; `pending` → `claim-review` with message `A pending claim does not grant editing access.`; `rejected` → `claim-review` with message `Read the review note, then correct your explanation before claiming again.`
    - `submit`: `canSubmit` false → `submit-event` with message `Event submissions are closed right now.`; `isOrganizer` → `event-workflow`; signed-out and `canSubmit` → `account-sign-in` plus `submit-event`; signed-in → `submit-event`.
    - `sign-in` → `account-sign-in`; `profile` → `personal-profile`; `account` → `account-security`.
- Produces, `ContextHelp.tsx`: `export function ContextHelp({ context }: { context: HelpContext }): JSX.Element` rendering `<aside className="context-help" aria-label="Help for this page">` with one `li` per item: the message (when present) followed by `<Link to={guidePath(guide, anchor)}>{linkText}</Link>`. Styles go in `src/features/help/help.css`.

- [ ] **Step 1: Write failing tests.**
  - `helpTopics.test.ts`: for every entry of `HELP_TOPICS`, the guide exists in `GUIDES` and, when `anchor` is set, it is in `parseGuide(await loadGuideSource(guide)).headings`.
  - `selectHelp.test.ts`: the six audiences reach their guide — `workspace` for `school`, `venue`, `instructor`, `dj` resolves to guides `schools`, `venues`, `artists`, `djs`; `host-desk` with `canCreateEvents: true` resolves to `organizers`; `sign-in` resolves to `dancers`. Editor, Manager, Owner and `admin` roles produce exactly the items listed above (Owner and `admin` produce one item with no message and no topic mentioning Owner or admin steps). `published: false` plus role `editor` yields `listing-permissions` once. Each `claim` state, each `host-desk` branch, and `submit` closed/signed-out/organizer match the rules. Every returned message is non-empty when present.
  - `ContextHelp.test.tsx`: renders a landmark named `Help for this page`; for the Editor workspace context the message text and a link whose `href` is `/help/listing-access#understand-listing-permissions` are in the same list item.
- [ ] **Step 2: Run** `npx vitest run src/features/help/helpTopics.test.ts src/features/help/selectHelp.test.ts src/features/help/ContextHelp.test.tsx`. Expected: FAIL.
- [ ] **Step 3: Implement** the three modules and the `.context-help` rules.
- [ ] **Step 4: Run the same command.** Expected: PASS.
- [ ] **Step 5: Commit.**

```bash
git add src/features/help
git commit -m "feat(help): select help by task and permissions"
```

### Task 6: Contextual help on public and workspace screens

**Files:**
- Modify: `src/pages/auth/SignInPage.tsx` (inside the `auth-story` section after the paragraph)
- Modify: `src/pages/SubmitEventPage.tsx` (after the `submit-event__intro` paragraph, around line 150; context from `user`, `submissionAccess.canSubmit`, `isOrganizer`)
- Modify: `src/features/workspaces/components/public/EntityClaimDialog.tsx` (inside the form view and the success view; do not touch the subtitle copy, which the claim-copy fix owns) and `src/features/workspaces/components/public/EntityClaimControl.tsx` (signed-out, pending and rejected branches)
- Modify: `src/features/workspaces/components/WorkspaceFrame.tsx` (after the `<nav className="ws-sections">`; and inside the `WorkspaceAccessError` branch)
- Create test: `src/pages/auth/SignInPage.test.tsx`
- Modify tests: `src/pages/SubmitEventPage.access.test.tsx`, `src/features/workspaces/components/public/PublicWorkspaceSurfaces.test.tsx`, `src/features/workspaces/pages/EntityWorkspaceOverviewPage.test.tsx`, `src/features/workspaces/pages/EntityWorkspaceTeamPage.test.tsx` (use `workspaceTestKit.tsx`)

**Interfaces:**
- Consumes: `ContextHelp`, `HelpContext` (Task 5); existing props: `WorkspaceFrame` has `kind`, `id`, `workspace.role`, `workspace.entity.status`; `EntityClaimDialog` has `kind`, `isSuccess`.
- Produces: no new exports. `WorkspaceFrame` passes `{ surface: "workspace", kind, role, published: live }`; the access-denied branch passes `{ surface: "workspace-denied" }`.

- [ ] **Step 1: Write failing tests** (each also checks the link `href`):
  - Sign-in: `/signin` shows a link to `/help/dancers#create-an-account-or-sign-in` (use the real anchor from `HELP_TOPICS`).
  - Submit: signed-out and open shows `/help/dancers#suggest-an-event` and `/help/dancers#create-an-account-or-sign-in`; closed shows `Event submissions are closed right now.` with the same `submit-event` link.
  - Claim: signed-out control links to the sign-in help; open dialog shows `claim-listing`; after submit the success view shows `claim-review`; a pending claim on the control shows `A pending claim does not grant editing access.`
  - Workspace: a school Editor sees `Your role is Editor, so Profile and Team are not shown.` and the schools guide link `/help/schools`; a Manager sees the Team reason; an Owner sees only the guide link and none of those sentences; a `venue`, `instructor` and `dj` workspace link `/help/venues`, `/help/artists`, `/help/djs`; the access-denied state shows the `claim-listing` help.
- [ ] **Step 2: Run** `npx vitest run src/pages/auth src/pages/SubmitEventPage.access.test.tsx src/features/workspaces`. Expected: FAIL on the new assertions only.
- [ ] **Step 3: Add `<ContextHelp context=... />` at the listed places.**
- [ ] **Step 4: Run the same command.** Expected: PASS, with existing tests unchanged.
- [ ] **Step 5: Commit.**

```bash
git add src/pages/auth src/pages/SubmitEventPage.tsx src/pages/SubmitEventPage.access.test.tsx src/features/workspaces
git commit -m "feat(help): link guides from sign-in, submit, claims and workspaces"
```

### Task 7: Contextual help on Host and account screens

**Files:**
- Modify: `src/features/host/components/HostDashboard.tsx` (beside the existing no-access note at lines 243-244, and under the header for members)
- Modify: `src/pages/host/HostMyEventsPage.tsx` (under `AdminPageHeader`, line 360), `src/pages/host/HostCreateEventPage.tsx` (the `manageable.length === 0` section, lines 164-176), `src/pages/host/HostOrganizationPage.tsx`, `src/pages/host/HostEventImportPage.tsx`, `src/pages/BulkFlyerImportPage.tsx` (Host mode only), `src/pages/host/HostAttendeeListPage.tsx`, `src/pages/host/HostCheckInPage.tsx`
- Modify: `src/pages/account/ProfilePage.tsx`, `src/pages/account/ProfileEditPage.tsx`, `src/pages/account/AccountPage.tsx`
- Modify tests: `src/features/host/components/HostDashboard.test.tsx`, `src/pages/host/HostCreateEventPage.test.tsx`, `src/pages/host/HostMyEventsPage.test.tsx`, `src/pages/host/HostAttendeeListPage.test.tsx`, `src/pages/host/HostCheckInPage.test.tsx`, `src/pages/account/ProfilePage.test.tsx`, `src/pages/account/AccountPage.test.tsx`

**Interfaces:**
- Consumes: `ContextHelp`, `HelpContext` (Task 5); `useHostCapabilities()` from `src/features/host/hooks/useHostCapabilities.ts` returns `hasHostAccess`, `canCreateEvents`, `canImportEvents`, `canManageOrganization`, `entityMemberships` (derive `hasOrganizerAccess` as `canManageOrganization`, `hasListings` as `entityMemberships.length > 0`; `HostDashboard` already has `canCreate` and `hasListings`).
- Produces: no new exports. Context values: dashboard `{ surface: "host-desk", ... }`; My Events, create-event gate, Organization, Import and Import Flyers `{ surface: "host-events", hasOrganizerAccess, canCreateEvents }`; attendees and check-in `{ surface: "host-door" }`; profile pages `{ surface: "profile" }`; account `{ surface: "account" }`.
- Keep the existing explanatory text in `HostDashboard` and `HostCreateEventPage`; the help adds the guide link and does not replace it.

- [ ] **Step 1: Write failing tests.**
  - Dashboard: a caller with no organizer access and no listings sees the `organizer-access` message and a link to `/help/organizers#get-organizer-access`; a listing-only member sees `A listing workspace does not include event management. Events belong to an organizer.`; an organizer Owner sees only the `event-workflow` link and neither sentence.
  - Create event: with an organizer membership that is only Editor, the page shows `Creating and importing events needs an active Owner or Manager role on an organizer.` and the roles link; with no membership it shows the `organizer-access` link.
  - Attendees and check-in each link to `/help/organizers#attendees-and-the-door`; profile pages link to the dancers guide; account links to `/help/dancers#protect-your-account`.
- [ ] **Step 2: Run** `npx vitest run src/features/host src/pages/host src/pages/account`. Expected: FAIL on the new assertions only.
- [ ] **Step 3: Add `<ContextHelp>` to each page.** Use existing `admin.css` classes for any wrapper spacing; no new tokens.
- [ ] **Step 4: Run the same command.** Expected: PASS.
- [ ] **Step 5: Commit.**

```bash
git add src/features/host src/pages/host src/pages/BulkFlyerImportPage.tsx src/pages/account
git commit -m "feat(help): link guides from the Host desk, door pages and account"
```

### Task 8: Cutover, docs and full verification

**Files:**
- Modify: `README.md` (line 7 and lines 514-515: point to the in-product `/help` and keep the backlog link)
- Modify: `docs/user-guides/improvements.md` (item 12 status and success note; the closing `[User guide index](README.md)` link)
- Delete (untracked, local): `docs/user-guides/README.md`, `dancers.md`, `djs.md`, `venues.md`, `organizers.md`, `artists.md`, `schools.md`, `listing-access.md`
- Modify: `DESIGN.md` (new `#### Help guides` subsection after "Sign-in and legal reading", line 669 area): reading layout reuses legal-page measure, `ContextHelp` form, table region rule, no screenshots until reviewed, authoring rules for guide links and labels

**Interfaces:**
- Consumes: everything above. Produces: no code.

- [ ] **Step 1: Update `README.md`, `improvements.md` and `DESIGN.md`** as listed; in `improvements.md` change item 12's text to describe the shipped help surface, the stale-help suite (`src/features/help/guideIntegrity.test.tsx`) and the deferred screenshots, and replace the index link with `/help`.
- [ ] **Step 2: Remove the superseded `docs/user-guides` copies** (kept: `improvements.md`). Confirm `grep -rn "user-guides" README.md src scripts` returns only the backlog link.
- [ ] **Step 3: Run `npx tsc -b`.** Expected: no errors.
- [ ] **Step 4: Run `npm run lint`.** Expected: no warnings.
- [ ] **Step 5: Run `npx vitest run`.** Expected: all pass, including `src/features/help/guideIntegrity.test.tsx`.
- [ ] **Step 6: Run `npm run build`.** Expected: build and postbuild succeed; `dist/help/<slug>/index.html` exists for all seven guides.
- [ ] **Step 7: Commit.**

```bash
git add README.md DESIGN.md
git add -f docs/user-guides/improvements.md docs/superpowers/plans/2026-11-09-in-product-help.md
git commit -m "docs(help): document the in-product help surface and retire guide copies"
```
