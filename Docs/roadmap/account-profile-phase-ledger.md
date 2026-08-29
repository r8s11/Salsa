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

Historical snippets in `Docs/ADMIN_MODERATION_GUIDE.md` and `Docs/Done/EVENT_SUBMISSION_GUIDE.md` are not active application call sites.

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
