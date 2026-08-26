# Phase 6 — Organizer Authentication, Role-Aware Navigation, and MVP Release Readiness

## Production audit findings (ground truth — read before touching code)

### Authentication architecture
- **One callback route exists:** `/auth/callback` → `src/components/Auth/AuthCallback.tsx`. It exchanges a PKCE `?code=` param (`supabase.auth.exchangeCodeForSession`) or falls back to `getSession()` for an implicit-hash session, then **unconditionally calls `navigate("/", { replace: true })`** (line 57) regardless of the signed-in user's role. This is root cause #1.
- **No `signInWithOtp` (magic link) exists anywhere in the repo.** Grepped the whole codebase — zero matches. Building one is infeasible on this deployment: `supabase/migrations/20260820000000_fix_admin_invite_user.sql` documents in its header comment that the app is hosted on Azure Static Web Apps with **no server runtime and no SMTP configured** (`supabase/config.toml` leaves `[auth.email.smtp]` commented out), so `auth.admin.inviteUserByEmail` (which magic-link/email-invite both depend on) is not available.
- **"Organizer invitation" in production is the `admin_invite_user` RPC** (`public.admin_invite_user`, security definer): an Admin creates the account directly with a generated temp password, handed over out-of-band (Slack/verbally). The invited Organizer's first session is a normal **password sign-in** via `SignInForm.tsx`, not a link click.
- **`SignInForm.tsx`'s `redirectAfterAuth()`** (lines 46-49) computes `destination = location.state?.from ?? "/"`. A freshly-invited Organizer's first sign-in has no `location.state.from` (they didn't get bounced from a guarded route — they typed the URL and signed in cold), so `destination` is always `"/"` regardless of role. This is root cause #2, and it's the one that actually fires for the "Organizer invitation" row in the spec's table (there is no email/link-click event to intercept — the sign-in *is* the invitation flow's completion).
- **Race condition (root cause #3, more subtle):** `AuthContext.signInWithPassword` only returns `{ error }` and relies on the async `onAuthStateChange` subscription to update `user`/`role` context state. `SignInForm.handleSubmit` calls `redirectAfterAuth()` synchronously right after `await signInWithPassword(...)` resolves. If `redirectAfterAuth` is made role-aware by reading `useAuth().role`, it risks reading a stale (pre-sign-in) role from the same render's closure, since React hasn't necessarily re-rendered with the new context value yet. This must be fixed by having `signInWithPassword`/`signUp` set `user`/`session` state **synchronously within their own async body** (not solely via the listener) and by returning the freshly-authenticated `user` object directly so callers never depend on a second render cycle.
- Route guards (`RequireAuth`, `RequireOrganizer`, `RequireAdmin`, `RequireReviewer`, all in `src/components/Auth/`) already correctly show a "Checking session…" loading state and never flash-redirect while `loading` is true. They are correct today; the bug is entirely in *where* they're told to navigate on success, and the state race feeding them.
- `emailRedirectTo` for signup confirmation and resend-confirmation already correctly points at `${origin}/auth/callback` (`AuthContext.tsx` lines 61, 78). `auth-templates/confirm-signup.md` documents the production callback URL as `https://www.salsasegura.com/auth/callback` and **explicitly notes** (line 45) that the link currently "navigates to `/`" — i.e. this doc already describes today's bug as expected behavior; it must be updated once fixed.

### Roles, capabilities, navigation
- Roles are **mutually exclusive** today: a single `app_metadata.role` string (`"admin" | "moderator" | "organizer" | null`), read by `roleFromUser()` in `AuthContext.tsx` (lines 9-15) and typed as `UserRole` in `authContextObject.ts`. There is **no schema support for multiple simultaneous roles** — no roles array, no join table. The spec's "multi-role accounts" section (§4, §8, §10 test #12) is therefore **not reproducible against current production data** and I will not add one — that would require a schema migration, which is out of scope ("No unapproved production SQL or hosted configuration changes"). I will write the role→nav-links derivation as a set-based union (matching the existing `AdminSidebar.tsx` pattern below) so it is multi-role-*ready* without being multi-role-*enabled*, and will call this out explicitly as a deviation in the final report.
- `isModerator` is `role === "admin" || role === "moderator"` — Admins already implicitly get every Moderator-scoped nav item. `isAdmin` is admin-only. `isOrganizer` is organizer-only.
- **`src/components/Admin/AdminSidebar.tsx` already implements exactly the capability-aware menu pattern the spec asks for** (§5 "Prefer a shared capability-aware menu configuration"): `NAV_SECTIONS: NavSection[]` with per-item `roles: UserRole[]`, filtered by `navItemsForRole(role)`. It already has entries for `Dashboard` (`/admin`, roles admin+moderator), `Host Dashboard` (`/host`, role organizer), `Events`/`My Events`, `Bulk Upload` (admin-only), `Users`, `Event Submissions`, `Organizer Requests`, `Venues`, `Tags`, `Settings` — all correctly role-gated already, all already styled to the reference visual language (slate icons, rounded active item, blush background, rose left accent — verified in `AdminSidebar.css`). **This part of the spec is already satisfied in production and needs no changes.**
- **The real, confirmed gap is `src/components/Header/Header.tsx`** (the public marketing-site header), which is the *entry point* into that already-correct shell. Both its desktop `account-disclosure__menu` (lines 128-143) and mobile drawer `mobile-nav-actions` (lines 86-117) only render a single `Dashboard` link gated on `isModerator` — **Organizers get no dashboard link anywhere in the public header.** An Organizer who signs in from the homepage has no discoverable path to `/host` short of typing the URL. This is root cause #4 and maps directly to spec §4 "Homepage Dashboard Navigation."
- `MobileTabBar.tsx` (the fixed bottom tab strip — a *separate* component from Header's mobile drawer, per `Docs/superpowers/plans/2026-08-22-mobile-public-shell.md`) has 4 fixed slots (Home/Calendar/Submit/Me) and no dashboard link for any role, admin included. Header's hamburger-triggered drawer is present at every breakpoint (it's the persistent top header; `MobileTabBar` is additive on small screens, not a replacement), so it already serves as "the mobile menu" for spec §5's "mobile menu must provide the same authorized destinations as desktop." I will fix `Header.tsx` only and leave `MobileTabBar.tsx` unchanged — adding a 5th tab or restructuring its fixed 4-icon layout is a UI redesign the spec doesn't ask for ("Do not redesign the entire application").
- No distinct "Moderator Dashboard" or "Admin Dashboard" route exists — both land on `/admin` (`AdminOverviewPage`), same as `AdminSidebar`'s existing single `Dashboard` label. I will **not** invent separate labels/routes for these (deviation from the spec's literal illustrative example in §4, which lists them as if distinct — flagging this explicitly in the final report). The Header dashboard group will show `Host Dashboard` for organizers and `Dashboard` for admin/moderator, matching `AdminSidebar`'s existing, already-shipped labels exactly.
- `src/features/events/components/EventForm/types.ts`'s `CAPABILITIES` map (`submit | organizerEdit | organizerSubmissionEdit | admin`) governs event-form field visibility, not navigation — confirmed out of scope for this phase, unchanged.

### Supabase configuration
- Local `supabase/config.toml`: `site_url = "http://127.0.0.1:3000"`, `additional_redirect_urls = ["http://127.0.0.1:3000", "http://localhost:5173/auth/callback"]`, `enable_confirmations = true`, `[auth.email.smtp]` disabled (rate-limited to 2 emails/hour via GoTrue's built-in test mailer). No `[auth.email.template.*]` overrides are set locally — Supabase's default templates are used locally; `auth-templates/confirm-signup.md` is the **production dashboard** copy-paste reference (per its own header comment), not a file GoTrue reads.
- **Manual production dashboard verification required (cannot be done from the repo — flagging per spec §3, not executing):**
  1. Confirm the hosted Supabase project's **Site URL** and **Additional Redirect URLs** allowlist includes `https://www.salsasegura.com/auth/callback` (the local config's `additional_redirect_urls` is the reference shape; production is a separate hosted setting this repo cannot read or write).
  2. Confirm the **Confirm signup** email template in the hosted dashboard matches `auth-templates/confirm-signup.md` and uses `{{ .ConfirmationURL }}` (already correct per that file).
  3. No magic-link or invite email templates need review since neither flow is used in production (see above) — do not create them.
- No hosted Supabase settings will be modified by this plan. `auth-templates/confirm-signup.md`'s closing note ("navigates to `/`") will be corrected in Task 4 to describe the fixed behavior.

## Non-goals (explicit deviations from the spec's literal text, justified)

1. **No `signInWithOtp` / magic-link implementation.** Infeasible without adding a server runtime or SMTP (see above); would be "introducing a second callback architecture" the spec itself forbids. The functional requirement ("Organizer... lands on `/host`") is satisfied via the two real entry points that exist: password sign-in (`SignInForm`) and the confirmation-link callback (`AuthCallback`), both fixed to be role-aware. Any future magic-link/OAuth addition automatically inherits correct behavior since the destination logic is centralized (Task 1).
2. **No multi-role schema change.** Roles remain a single `app_metadata.role` string. The nav-derivation logic is written as a role-set union so it is forward-compatible, but no migration is performed.
3. **No distinct "Moderator Dashboard" / "Admin Dashboard" routes or labels.** Both use the existing single `/admin` route and `AdminSidebar`'s existing `Dashboard` label.
4. **No changes to `MobileTabBar.tsx`.** Header's always-present hamburger drawer already satisfies "mobile menu parity."
5. **No hosted Supabase dashboard changes executed.** Documented as manual verification items only.

## Task breakdown

### Task 1 — Shared role and destination utilities
**Files:** `src/contexts/authContextObject.ts` (export `roleFromUser`), new `src/lib/authDestination.ts`, new `src/lib/authDestination.test.ts`.

- Move `roleFromUser(user: User | null): UserRole | null` out of `AuthContext.tsx` into `authContextObject.ts` (pure function, no React dependency) and export it. Update `AuthContext.tsx` to import it instead of defining it locally.
- Add `src/lib/authDestination.ts`:
  - `resolveAuthorizedDestination(role: UserRole | null): string` → `"/host"` for `"organizer"`, `"/admin"` for `"admin"` or `"moderator"`, `"/profile"` otherwise (covers signed-in regular users; guests never reach this — see Task 3/4, they only call it post-authentication).
  - `isSafeInternalPath(value: unknown): value is string` → `true` only if `value` is a string starting with exactly one `/` (not `//`, not containing `://`, not starting with `\\`). Rejects anything that isn't a same-origin relative path — this is the "reject external/malformed next/returnTo" control from spec §8.
- TDD: write `authDestination.test.ts` first covering every role→destination mapping and a table of safe/unsafe path inputs (`"/host"` safe, `"//evil.com"` unsafe, `"https://evil.com"` unsafe, `"javascript:alert(1)"` unsafe, `123` unsafe, `undefined` unsafe, `"/host/events"` safe).

### Task 2 — Eliminate the sign-in state race
**Files:** `src/contexts/authContextObject.ts`, `src/contexts/AuthContext.tsx`, `src/contexts/AuthContext.test.tsx` (create if it doesn't exist; check first), and the 7 existing test files that mock `AuthContextValue.signInWithPassword`.

- Change `AuthContextValue.signInWithPassword` return type to `Promise<{ error: Error | null; user: User | null }>`.
- Change `AuthContextValue.signUp` return type to additionally surface `user: User | null` (derived from `session?.user ?? null`) alongside its existing `session`.
- In `AuthContext.tsx`: `signInWithPassword` and `signUp` must call `setUser(data.user)` / `setSession(data.session)` synchronously inside their own body immediately after a successful Supabase call — not rely solely on the `onAuthStateChange` listener to eventually update context. The listener remains in place unchanged (still needed for token refresh, cross-tab sign-out, and the `AuthCallback` flow's session, which calls the raw `supabase` client directly).
- Grep-confirmed test files needing a mechanical update to keep compiling/passing (all currently use bare `vi.fn()` except one exact-shape call):
  - `src/components/Auth/SignInForm.test.tsx:14` — `vi.fn().mockResolvedValue({ error: null })` → `.mockResolvedValue({ error: null, user: null })` (this test doesn't care about role-based redirect, only that `redirectAfterAuth` runs — Task 3 adds role-specific cases separately with the correct `user` shape needed for each).
  - The other six (`Header.test.tsx`, `RequireAdmin.test.tsx`, `MobileTabBar.test.tsx`, `SubmitEventPage.test.tsx`, `AdminOverviewPage.test.tsx`, `AdminImportEventsPage.permissions.test.tsx`) use bare `vi.fn()` with no explicit resolved shape — confirm they still type-check after the interface change (they should, since untyped `vi.fn()` is not shape-constrained); fix only if `tsc`/vitest actually flags them.
- TDD: extend (or create) `AuthContext.test.tsx` to assert `signInWithPassword` resolves with the correct `user`, and that context `user`/`role` are updated by the time the returned promise settles (i.e., no need to wait for a subsequent render/act cycle).

### Task 3 — Role-aware, path-validated `SignInForm` redirect
**Files:** `src/components/Auth/SignInForm.tsx`, `src/components/Auth/SignInForm.test.tsx`.

- `redirectAfterAuth` becomes `redirectAfterAuth(user: User | null)`, called with the `user` returned directly from `signInWithPassword`/`signUp` (Task 2) — not read from context — eliminating any remaining race.
- Logic: `const role = roleFromUser(user); const from = location.state?.from; const destination = isSafeInternalPath(from) ? from : resolveAuthorizedDestination(role); navigate(destination, { replace: true });`
- Update both call sites in `handleSubmit` (sign-in success, sign-up-with-immediate-session success) to pass the returned `user`.
- TDD, new test cases in `SignInForm.test.tsx`:
  1. Organizer with no intended route → redirects to `/host`.
  2. Admin/Moderator with no intended route → redirects to `/admin`.
  3. Regular user with no intended route → redirects to `/profile`.
  4. Any role with a valid internal `location.state.from` (e.g. `/host/events/abc`) → that path is preserved over the role default.
  5. A malformed/external `location.state.from` (e.g. `"https://evil.com"`) → falls back to the role-appropriate destination, not the external URL.
  6. Existing "redirects to the requested page after successful sign-in" test still passes with the new `user`-shaped mock.

### Task 4 — Role-aware `AuthCallback` redirect
**Files:** `src/components/Auth/AuthCallback.tsx`, `src/components/Auth/AuthCallback.test.tsx`, `auth-templates/confirm-signup.md`.

- After the existing session-confirmation logic succeeds, derive `role` via `roleFromUser(session.user)` (from the `getSession()` result already fetched at line 46-48 — no extra network round-trip needed) and `navigate(resolveAuthorizedDestination(role), { replace: true })` instead of the hardcoded `navigate("/", { replace: true })`.
- No "intended route" support for this flow: there is no user journey today where signup happens from within a guarded route (signup only happens via the public `/signin` page), so there is nothing to preserve — confirmed during audit, not adding unused complexity.
- Update `auth-templates/confirm-signup.md`'s closing note (line 45) to describe the corrected behavior instead of documenting the bug as expected.
- TDD, new test cases in `AuthCallback.test.tsx` (extend existing file — check current coverage first, don't duplicate):
  1. Confirmed Organizer session → navigates to `/host`.
  2. Confirmed Admin/Moderator session → navigates to `/admin`.
  3. Confirmed regular-user session (no role) → navigates to `/profile`.
  4. Existing error-state tests (expired/reused link, no session) remain passing unchanged.

### Task 5 — Header.tsx role-aware "DASHBOARDS" navigation
**Files:** `src/components/Header/Header.tsx`, `src/components/Header/Header.css`, `src/components/Header/Header.test.tsx`.

- Add a single shared derivation inside `Header.tsx` (or a small colocated helper) producing the authorized dashboard link(s) for the current user — reuse the exact `role`/`isAdmin`/`isModerator`/`isOrganizer` already exposed by `useAuth()`, expressed as a role-set union (Organizer → `{ to: "/host", label: "Host Dashboard" }`; Admin or Moderator → `{ to: "/admin", label: "Dashboard" }`) so it's structurally ready for multiple simultaneous entries without current schema support for them (see Non-goals #2).
- Render this list identically in **both** the desktop `account-disclosure__menu` and the mobile `mobile-nav-actions` block — do not duplicate the derivation logic between them (single source, two render sites), addressing spec §5's "avoid duplicating role logic across separate navigation components."
- Structure the group under an uppercase `DASHBOARDS` label when at least one dashboard link applies (nothing rendered — not even the label — for guests or regular users with no role), positioned above the existing `My Profile` link, matching spec §4's example layout.
- `aria-current="page"` is already handled for free by React Router's `NavLink` (`className`/active state) on every other nav link in this file — use the same `NavLink` component for dashboard links, not a plain `Link`, for consistency and accessibility parity (spec §9).
- Visual language (`Header.css`): reuse the same tokens (`AdminSidebar.css`'s active-item rose-accent/blush-background/slate-icon approach — read its exact custom properties before writing new rules, do not guess) scoped to new `.account-disclosure__dashboards` / `.mobile-nav__dashboards` classes: uppercase small-caps section label, rounded active item, soft blush active background, rose accent on the active item's left edge, visible keyboard focus (extend the existing `:focus-visible` selector list at the bottom of the file to include the new links).
- TDD, new test cases in `Header.test.tsx`:
  1. Guest (no user) → no `DASHBOARDS` section, no dashboard links, in both desktop and mobile blocks.
  2. Regular authenticated user (no role) → no `DASHBOARDS` section (only `My Profile` + `Sign Out`).
  3. Organizer → `Host Dashboard` link to `/host` present in both desktop and mobile blocks.
  4. Admin/Moderator → `Dashboard` link to `/admin` present in both blocks (this already partially existed — confirm it still passes and is now driven by the shared derivation instead of the standalone `isModerator &&` conditional).
  5. Sign-out removes the dashboard link (re-render after `handleSignOut`).
  6. Desktop and mobile blocks render the same destination(s) for a given role (no drift).

### Task 6 — Full regression, lint, build
- Run the complete existing suite (`npm test -- --run`), `npm run lint`, `npm run build`. Fix any fallout mechanically before proceeding — do not weaken assertions to force a pass.
- Confirm `AdminSidebar.test.tsx` (unchanged) and any existing `AuthCallback.test.tsx` / `RequireOrganizer` tests still pass, proving Non-goal #3/#5's "already correct, no changes needed" claim rather than just asserting it.

### Task 7 — Real E2E browser verification (local Supabase)
Per spec §11, against a real local Supabase instance (`supabase start`), headless browser:
1. Seed an Organizer account via `admin_invite_user` (mirrors real production invitation) → sign in with the temp password at `/signin` → assert landing on `/host` with dashboard panels rendered, not a `/` flash.
2. Seed a regular user → sign in → assert landing on `/profile`.
3. Seed an Admin → sign in → assert landing on `/admin`.
4. Sign up a brand-new account locally with `enable_confirmations = true` → follow the confirmation link to `/auth/callback` → assert it lands on `/profile` (regular user, no role) rather than `/`.
5. Unauthenticated direct navigation to `/host` → assert redirect to `/signin`, never a `/` flash.
6. Header: assert Organizer sees `Host Dashboard` in both the desktop dropdown and the mobile drawer; assert a regular user sees neither; assert sign-out removes it.
7. Responsive check at 375/768/1024/1440px — no horizontal overflow, correct active-menu styling, no console errors.

### Task 8 — Final report
Cover, per the spec's completion gate: root causes found, exact authentication changes, redirect behavior before/after, navigation changes, role-to-tool mapping (confirming §6's Organizer/Moderator/Admin/regular-user tool lists already match production via `AdminSidebar`'s existing `NAV_SECTIONS`, unchanged), Supabase configuration requirements (manual dashboard verification items from the audit above — nothing executed), permissions/RLS verification (unchanged — no RLS touched this phase), tests and browser verification results, the 5 explicit non-goals/deviations, and remaining post-MVP work (magic-link/email-invite would require adding SMTP + a server runtime or a third-party email-sending function; multi-role would require an `app_metadata.roles` array migration — both explicitly out of scope here).

## Test file audit note
Before writing new tests in Tasks 3-5, read the *current* full contents of `SignInForm.test.tsx`, `AuthCallback.test.tsx`, and `Header.test.tsx` to avoid duplicating existing coverage or fighting existing mock setup patterns — each file already has an established `vi.mock("../../contexts/useAuth")` shape that must be extended, not replaced.
