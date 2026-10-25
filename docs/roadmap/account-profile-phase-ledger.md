# Account & Public Profile — Phase Ledger

## Phase 4 — Security and sessions

### Pre-implementation audit — 2026-08-28

> `docs/roadmap/account-profile-phase-ledger.md` was not present on `origin/main` at `5045450`; this entry records the required audit before Phase 4 behavior changes.

#### Repository and SDK baseline

- Base commit: `5045450 feat(account): add honest Email & notifications section`.
- `package.json:26` declares `@supabase/supabase-js` `^2.112.0`; `package-lock.json` resolves it and `@supabase/auth-js` to `2.112.4`.
- `package.json:58` declares Supabase CLI `^2.113.0`; the local executable is `2.115.0`.
- Installed `@supabase/auth-js` declares `SignOut.scope` as `"global" | "local" | "others"` and documents global as the omitted default (`node_modules/@supabase/auth-js/dist/main/GoTrueClient.d.ts:1992-2035`). Its implementation preserves browser state for `others` and removes the local session for `local`/`global` (`GoTrueClient.js:3415-3445`).
- Official Supabase documentation confirms `local`, `global`, and `others` scopes and says revoked-session access tokens remain usable until their `exp` claim. There is no documented account-owner browser API for active-session listing, device/location/last-active metadata, or selected-session revocation.

#### Existing sign-out call sites and current effective scopes

| Call site | Current behavior before Phase 4 | Effective scope | Redirect / cleanup |
| --- | --- | --- | --- |
| `src/contexts/AuthContext.tsx:87-94` | Only direct production `supabase.auth.signOut()` invocation | Omitted scope, therefore **global** | Sets only `loading`; `onAuthStateChange` normally updates `session` and `user`. It does not clear React Query caches itself. |
| `src/components/Header/Header.tsx:62-66` | Calls context `signOut()`, closes mobile navigation, then `navigate("/")` | Global through context default | Root navigation does not use `replace`; no safe-path input is involved. |
| `src/components/Admin/AdminSidebar.tsx:149-151` | Calls context `signOut()` | Global through context default | No direct navigation; protected-route transition depends on `RequireAuth`. |
| `src/layouts/AdminLayout.tsx:67-69` | Calls context `signOut()` | Global through context default | No direct navigation; protected-route transition depends on `RequireAuth`. |
| `src/pages/ProfilePage.tsx:129-135` | Calls context `signOut()` | Global through context default | No direct navigation; protected-route transition depends on `RequireAuth`. |

Historical snippets in `docs/ADMIN_MODERATION_GUIDE.md` and `docs/archive/EVENT_SUBMISSION_GUIDE.md` are not active application call sites.

Changing any existing generic sign-out action from the present default global scope to local would change behavior. Phase 4 will preserve that behavior by making its existing-call-site scope explicit as `global`; the new Account controls will use the deliberate scope matching their copy.

#### Auth state, redirects, and cache audit

- `AuthContext` stores `user`, `session`, and `loading`. `getSession()` initializes user/session (`src/contexts/AuthContext.tsx:12-20`), and `onAuthStateChange` replaces both (`23-29`). `roleFromUser()` maps only the trusted scalar `app_metadata.role` (`src/contexts/authContextObject.ts:6-12`). No profile record is kept by AuthContext.
- React Query has one application-level client in `src/app/providers.tsx:7-25`. Before Phase 4 no successful sign-out path clears it, so user-specific cached data can outlive the locally rendered auth state.
- `RequireAuth` redirects an unauthenticated protected route to `/signin` with `replace` and a pathname-only `from` state (`src/components/Auth/RequireAuth.tsx:10-35`). `SignInForm` validates restored navigation with `isSafeInternalPath` before falling back to the role-based destination (`src/components/Auth/SignInForm.tsx:50-53`, `src/lib/authDestination.ts:13-23`). New Account sign-out navigation will use the fixed root destination with `replace`, so it accepts no redirect input and cannot open-redirect.
- Existing tests mock generic `signOut` calls but do not assert local/global/others semantics: `Header.test.tsx`, `AuthContext.test.tsx`, `AdminSidebar.test.tsx`, `AdminLayout.test.tsx`, and `ProfilePage.test.tsx`.

#### Project session configuration

- Local `supabase/config.toml:153-163` sets `jwt_expiry = 3600`, enables refresh-token rotation, and sets `refresh_token_reuse_interval = 10`.
- `[auth.sessions]` is only commented sample configuration (`supabase/config.toml:255-260`): no committed timebox or inactivity timeout is enabled.
- The repository has no committed single-session setting.
- Hosted Auth session controls are not available from checked-in configuration and were not changed by Phase 4.

#### Capability matrix

| Capability | Production-backed result | Phase 4 decision |
| --- | --- | --- |
| Current browser session | `AuthContext.user.email` is available from the authenticated session; the browser session itself is local state. | Render `This browser`, `Current`, and account email only. |
| Sign out this browser | Supported by `auth.signOut({ scope: "local" })`. | Ship. |
| Sign out everywhere | Supported by `auth.signOut({ scope: "global" })`. | Ship with confirmation and token-expiry warning. |
| Sign out other devices | Supported by installed SDK via `auth.signOut({ scope: "others" })`; it keeps the current session. | Ship and retain local auth/cache/route after success. |
| List active sessions | No supported account-owner browser API was found. | Do not ship a session list. |
| Revoke one selected session | No supported account-owner browser API was found. | Do not ship selected-session controls. |
| Device, browser, IP/city, last-active metadata | Not available through a supported account-owner browser API. | Do not infer or fabricate it. |

#### Security boundary

- No repository Edge Function or trusted server endpoint lists Auth sessions or revokes one selected session. No source code queries `auth.sessions`.
- `supabase/config.toml:11-15` exposes `public` and `graphql_public`, not `auth`.
- Existing privileged invitation functionality is unrelated; it is not a session-management API and Phase 4 will not extend it.
- Phase 4 must not expose service-role credentials, raw JWTs, refresh tokens, session IDs, IP addresses, or internal Auth data.

#### V2 reference decisions

Retained: card hierarchy, a truthful current-browser row, separated local/other/global actions, and a confirmation before the global action.

Rejected: named devices, browser identification, city/IP, last-active timestamps, multiple-device rows, selected-session sign-out, local history, and any custom table pretending to be Supabase Auth session data. Individual session management remains deferred until a supported trusted API supplies real data and selected-session revocation.

### Implementation record — 2026-08-28

- `src/contexts/AuthContext.tsx` now accepts an explicit scope, passes it to `supabase.auth.signOut({ scope })`, returns an actionable error, and clears `session`, `user`, and the React Query client only after successful `local` or `global` sign-out. Successful `others` preserves the current session and cache.
- `src/components/Header/Header.tsx`, `src/components/Admin/AdminSidebar.tsx`, `src/layouts/AdminLayout.tsx`, and `src/pages/ProfilePage.tsx` now pass explicit `global` scope, preserving the former omitted-scope behavior.
- `src/pages/AccountPage.tsx` and `src/pages/AccountPage.css` add the visible `Security & sessions` card after `Email & notifications`: `This browser`, `Current`, and the authenticated email; local, other-device, and global controls; accessible failure/success feedback; and an accessible global-sign-out confirmation dialog.
- The global dialog says: “This ends every session, including this browser. People using another device may keep access until their current access token expires.” It intentionally does not promise immediate remote access-token invalidation.
- No SQL, migration, RLS policy, Edge Function, hosted Auth configuration, service-role key, raw token, session identifier, `auth`-schema access, or custom session table was added or executed.

### Verification record — 2026-08-28

- Focused Account/Auth/Header/Admin/Profile/App destination tests: 107 passed.
- Full frontend Vitest suite: 124 files and 882 tests passed.
- `tsc -b`, ESLint, and production Vite build passed.
- No Deno test ran because Phase 4 did not change an Edge Function.
- Required real local-Supabase browser verification remains blocked by the workstation Docker engine: `docker ps` timed out after 30 seconds, `npx supabase start` stalled and was cancelled, and no service was listening at `127.0.0.1:54321`. Before that startup attempt, the current CLI also rejected the repository’s legacy local hook secret syntax in `supabase/config.toml:179`; a temporary local-only valid test value was used solely to pass parsing and then restored. No persistent Auth configuration change was made.

## Phase 6 — Profile edit (display name + hosted photo URL)

### Handoff reconciliation — 2026-09-08

The incoming correction handoff described a different machine. Recorded here
because several of its premises could not be acted on as written:

| Handoff premise | Verified state on this workstation |
| --- | --- |
| Directory `/Users/roosevelt/work/Salsa-profile-phase6` | Does not exist; `/Users` has no entries. Work performed in `/home/r8s/code/Salsa/.worktrees/phase6-correction`. |
| Branch `feat/account-profile-phase6` | No such ref. Actual branch: `feat/profile-edit-phase6-correction`. |
| "Phase 6 changes were uncommitted on September 8" | Committed: `f16dddd` (implementation) and `0c15134` (verification scripts). Working tree was clean at start. |
| Base HEAD `76367d8b` | Exists, but is `fix(admin): allow founder request action menus to overflow` — a one-line CSS deletion unrelated to Phase 6, and not an ancestor of this branch. Real merge-base with `main`: `d9d304c`. |
| `supabase/manual/phase6_own_profile_update_verification.sql` | Present in no ref and no worktree. The only `phase6_*` manual SQL is `phase6_host_access_verification.sql`, which belongs to the unrelated Host track. |
| "thirteen `useUpdateOwnProfile` tests" vs "five" | Neither. No `useUpdateOwnProfile` test file exists in any ref. |

"Phase 6" is overloaded in this repository (`phase6-admin-user-detail-management`,
`phase6-founder-invitation-acceptance-auth`, `20260830000001_phase6_host_organizer_access`).
The Account/Profile one is the branch named above.

### Correction record — 2026-09-08

Audit findings 1–3 were confirmed against the real code and fixed test-first
(20 tests written failing, then made to pass):

- **Photo preview accepted anything non-empty.** `ProfileEditPage.tsx:173` gated the
  `<img>` on `form.avatar_url.trim().length > 0` and never consulted the save-time
  rule, so malformed values and `https://user:pass@host/x.png` reached `src`
  (React's own `javascript:` interception was observed firing in the failing test).
  Preview and save now share one exported rule, `isDisplayablePhotoUrl`
  (`src/features/account/model/account.ts`), which rejects blanks, unparseable
  values, non-http(s) schemes, and embedded credentials. `referrerPolicy="no-referrer"`
  was **added** — the handoff assumed it already existed; it did not.
- **Load-failure fallback.** Both the editor preview and `/profile` now fall back to
  initials on `onError` and re-attempt when the URL changes, keyed on the exact
  failed URL.
- **`/profile` showed the wrong identity.** Finding 2 assumed a newly added image in
  `ProfilePage.tsx`; there was none, and the page read `user_metadata.full_name` /
  email-prefix rather than the profile row — so a saved `display_name` never appeared
  on the page the editor returns to, defeating the phase's stated visible outcome.
  `ProfilePage` now derives identity from the profile row and keeps the pre-existing
  auth-metadata fallback only when no profile row exists.
- **Accessibility claims made true.** The editor no longer emits its own `<main>`
  (MainLayout owns it; verified 1 landmark / 1 H1 in the composed route, live and in
  test). Added `aria-describedby` for the read-only username help and the photo hint,
  `aria-invalid` + associated error text for a blank display name, and error text
  appended to the photo field's description when invalid.

Finding 4's named SQL file does not exist. Its substance — fixtures that respect real
signup behavior, a timestamp assertion compatible with the real trigger, and assertions
that a missing row cannot satisfy — was applied to the verification that does exist,
`scripts/phase6-verify/verify-profile-rls.mjs`, which contained the exact defect
described: it inserted `public.profiles` after creating the auth user even though
`handle_new_user` already had, with `on conflict (id) do nothing` silently masking a
broken trigger. Repairs:

- The blind insert became an assertion that `handle_new_user` provisioned the row.
- `updated_at` is asserted across two PostgREST requests (each its own transaction),
  because `set_updated_at` uses `now()`, which is fixed within a transaction and would
  overwrite any UPDATE-based backdating. No trigger was disabled.
- The cross-user assertion previously passed when the row was absent
  (`bRow?.display_name !== "Pwned by A"`); it now requires the row to exist, be
  unchanged, and the PATCH to affect zero rows.
- Teardown deletes `audit_logs.actor_id` children before `auth.users` (the trusted RPC
  writes an audit row and blocked user deletion), and fails the run if any fixture survives.

**New defect found by that verification and fixed:** an owner could `PATCH
{"display_name": null}` and get `200`, blanking an established name — the phase's
CHECK is `display_name is null or length(btrim(display_name)) > 0`, which rejects `""`
but permits `NULL`. `supabase/migrations/20260830000002_profile_display_name_not_blankable.sql`
adds a BEFORE UPDATE trigger forbidding only the non-null → null transition, so legacy
null rows stay valid, readable, and updatable in other columns.

### Verification record — 2026-09-08

Disposable local instance: project `Salsa`, ports remapped to 54421/54422/54423/54424/54429
because a sibling project (`Bellocampo`) holds the defaults. Fresh volumes (no prior
`supabase_*_Salsa` volumes existed). 21 migrations applied including
`20260830000000_profile_owner_update.sql`; the new `20260830000002` applied on top.
The sibling stack's 11 containers were never stopped or reconfigured and were confirmed
healthy afterward; `config.toml` was restored byte-for-byte and the temporary `.env.local`
removed.

- **Effective privileges.** `authenticated` holds table SELECT plus column-level UPDATE
  on exactly `display_name, avatar_url`; no table-level UPDATE; no role inheritance into
  `authenticated`/`anon`/`service_role`; RLS enabled (not forced). The "guard" is the
  column GRANT, not a RESTRICTIVE policy — all three `profiles` policies are PERMISSIVE.
- **Real API evidence** (two disposable users + one admin, all Auth-issued JWTs through
  PostgREST): 22/22 assertions, exit 0, zero fixtures left behind. Covers own-field save,
  photo clear, zero-row cross-user write, every privileged column blocked, empty and null
  name rejected, legacy null row readable *and* still updatable, `updated_at` advancing on
  both owner and trusted writes, admin RPC succeeding, and non-admin RPC rejected.
- **`service_role` cannot write `public.profiles` directly (403).** Verified pre-existing
  and *not* a Phase 6 regression: no migration ever granted it table privileges and the
  Phase 6 migration does not mention `service_role`. Trusted writes go through
  SECURITY DEFINER RPCs (`admin_set_user_status`, `admin_set_user_role`, `admin_invite_user`,
  `handle_new_user`), which were exercised and still work.
- **Browser, real Auth, local stack.** Unauthenticated `/profile/edit` → `/signin`;
  save → `/profile` shows `Maria Lucia Santos` with the saved photo and `no-referrer`,
  surviving a fresh route boot; Account reflects the same identity; failed save (aborted
  PATCH) preserves both typed values, leaks no raw error, and the retry persists trimmed;
  malformed and credential URLs show no preview with Save disabled; a valid-but-unreachable
  host falls back to initials; Cancel returns to `/profile` without saving;
  `/profile/edit` and `/profile/edit/<real event id>` resolve to the profile editor and
  "Edit event" respectively.
- **Viewports 375/640/768/1024/1440.** Actions full-width and stacked at 375/640, inline
  at ≥768. No horizontal overflow at 375/640/768/1440. At 375 the last field is topmost at
  its centre and Save clears the fixed tab bar (751 vs 449). Long names do not overflow.
  Disabled username correctly refuses focus. Reduced motion leaves only a 1e-05s fadeIn.
- **Pre-existing issues found and attributed, not fixed (out of scope):**
  104–105px horizontal overflow at exactly 1024px from `.desktop-nav-actions` in the site
  Header — reproduced identically on `/calendar` and `/about`, which this phase never
  touched. `/profile` and `/account` still render 2 `<main>` landmarks (repo-wide pattern
  across 8 pages); only the editor was corrected, per scope. A missing profile row renders
  the editor's header with no form and no explanation — pre-existing guard
  (`profile && form`), preserved deliberately, and worth a product decision.
- **Machine checks on the final source.** `npx vitest run` → exit 1, 126 files / 958 tests,
  955 passed, 3 failed. All 3 are baseline: `EventModal.test.tsx` (2, "Found multiple
  elements … Full details") and `HostMyEventsPage.test.tsx` (1, date-sensitive
  "Approved Event") fail identically with this phase's changes stashed. `npx tsc -b` → 0.
  `npm run lint` → 0. `npm run build` → 0. No Deno test ran; no Edge Function changed.

### Rollout — local vs hosted

A local reset applies no hosted SQL and rolls nothing back in production. Nothing in this
phase was applied to a hosted database, and no push, merge, or deployment was performed.

Hosted order, before any frontend release:

1. Review and apply `20260830000000_profile_owner_update.sql`, then
   `20260830000002_profile_display_name_not_blankable.sql`, in that order. The second
   depends on `public.profiles` only, but its purpose is meaningless without the first.
2. Confirm effective permissions afterward, not just statement success: `authenticated`
   must hold column-level UPDATE on exactly `display_name, avatar_url` and no table-level
   UPDATE; the owner-only policy must exist; `profiles_display_name_nonempty` and
   `profiles_reject_display_name_blanking` must be present.
3. Smoke-verify with one real non-admin account: save a name and photo, clear the photo,
   confirm a second account's row is unaffected, and confirm an admin status change still
   works through its RPC.
4. Only then release the frontend. The frontend tolerates the pre-migration schema for
   reads, but saving requires the column GRANT, so shipping the UI first yields failing saves.

Data-preserving rollback / feature disable, in preference order:

- **Disable the feature, keep the data:** `revoke update (display_name, avatar_url) on
  public.profiles from authenticated;`. Saves begin failing; every row is untouched and
  still readable. This is the fastest safe stop.
- **Reverse the new guard only:** `drop trigger profiles_reject_display_name_blanking on
  public.profiles;` plus `drop function public.reject_display_name_blanking();`. Restores
  the prior (permissive) null behavior without touching data.
- **Reverse the owner path:** drop the `"Users update own profile fields"` policy. Retain
  `profiles_display_name_nonempty` unless a pre-existing row genuinely violates it.
- Never reset or recreate the hosted database to undo this phase; every step above is
  additive or a privilege/policy removal.

`supabase/reconcile-prod-schema.sql` also contains profile and taxonomy objects. It is a
broad script that this phase does not authorize running; treat any overlap as requiring
separate review. The local stack needed `supabase/manual/phase-10/001`–`002` applied by hand purely so
`/profile` could render at all (`useMySubmissions` embeds `event_taxonomy_terms`, which is
absent from `supabase/migrations/` — the documented P1-7 drift), which is an environment
workaround, not part of this phase's rollout.

### Status — 2026-09-08

Findings 1–4 resolved with test and browser evidence; finding 5 reconciled above from
actual machine output. Deferred and unchanged: uploads, username lifecycle, additional
profile fields, public profile routes, Host/founder work. Open items that are not this
phase's to close: the 1024px Header overflow, the repo-wide double-`<main>` pattern, and
the silent missing-profile empty state.

**Readiness:** local acceptance complete for the stated visible outcome. Hosted release
remains gated on step 1–3 above, which require authorization this handoff explicitly
withheld.

## Repository state reconciliation — 2026-09-09 (late)

### Phase 8 recovery

The worktree holding Phase 8 was discarded while its work was still uncommitted. The tested
content is now commit `2010b54dfada610d5226b67c8aeaade4338cdff9` on the unpushed branch
`feat/account-profile-phase8` (base `2e659ff`), restored from the acceptance patch
`cb0d05f988c26e7d9cb08f54fb1759a3764d4ca7c76e3eae84d390e48841f930`. Its reports, advisor
output and browser screenshots are retained independently of that deleted worktree.

Phase 8 stays **blocked on real Supabase/GoTrue parity** — GoTrue-issued sessions,
`scripts/phase8-verify/verify-dance-identity.mjs` exiting 0 against a confirmed disposable
Supabase stack, and `supabase db lint` itself. It is neither accepted nor released, and its
branch is not merged.

### Corrected commit

`c5b32ff` was pushed as a ledger update but actually carried an accidental broad path
migration: 326 exact-content renames across `src/`, `Docs/`, `sql/` and `supabase/` (largely
case-only, e.g. `Docs/` to `docs/`) plus 11 deletions, including the tracked Host SQL
contract test `sql/host-phase-2/001_create_organizer_event.test.ts`. It carried no ledger
text at all. The relocated TypeScript kept its old relative imports, so a clean checkout of
that revision failed to type-check. The changes came from the primary checkout's dirty index,
which `git commit` staged despite a path-scoped `git add`. This commit reverts that migration
in full and carries the intended ledger update instead.

### Working-copy hygiene

`/Users/roosevelt/work/Salsa` remains heavily dirty with unrelated in-flight work, and its
index can hold staged changes that belong to no phase. Start every future Account or Profile
phase in a clean worktree from current `origin/main`, and commit with explicit pathspecs
(`git commit -- <paths>`) rather than trusting the shared index.
