# Phase 4 — Founder Invitation Foundation

Repository changes for Phase 4 add the secure, auditable invitation
lifecycle that sits between an **approved Founder request** (Phase 3) and
a **future Phase 6 acceptance flow**. This phase creates the underlying
model, token security, and admin create/revoke primitives only. It does
not send email, authenticate an invited user, or create organizations —
those are Phase 5 and Phase 6.

## 1. Existing invitation architecture audit

Audited before writing anything new:

- `supabase/functions/_shared/invitation.ts` — only email normalization
  and organizer redirect-URL allowlisting. No token generation, no
  hashing, no invitation table reference of any kind.
- `supabase/functions/invite-organizer/index.ts` — delegates entirely to
  `auth.admin.inviteUserByEmail`. Supabase Auth owns the token internally
  (opaque to application code); the function's only DB writes are
  `profiles` upsert and an `audit_logs` insert. **No custom invitation
  table exists anywhere in the repository.**
- `src/components/Auth/InviteActivationPage.tsx` — consumes the organizer
  invite's PKCE/token-hash callback and immediately establishes an Auth
  session + profile. Not reusable: Phase 4 must NOT create an Auth user or
  session at all.

**Conclusion:** nothing in the existing organizer-invitation domain maps
onto Founder invitations. Phase 4 introduces its own table
(`founder_invitations`) and its own token primitive (Postgres pgcrypto,
not a Deno/TS module — see §3). The two invitation domains stay
architecturally separate and are not expected to converge; the organizer
flow is Auth-account-first, the Founder flow is credential-first (a
possession-based token that Phase 6 will later map to an Auth identity in
whatever way that phase decides).

**Architecture deviation from the Edge Function pattern implied by the
brief:** Phase 3's authenticated admin actions (`admin_review_founder_request`)
already use a Postgres `SECURITY DEFINER` RPC, not an Edge Function. Phase 4
follows that established, already-tested convention for `admin_create_founder_invitation`
and `admin_revoke_founder_invitation` instead of introducing new Edge
Functions, because:

1. No Deno runtime is available in this environment to execute or test an
   Edge Function locally (confirmed during Phase 3 verification).
2. RLS + `SECURITY DEFINER` + `is_admin()`/`is_moderator()` already prove
   sufficient as the authorization boundary for Phase 3's equivalent
   write, and PostgREST's RPC surface is directly testable with real HTTP
   calls and bearer tokens against the local stack — which is exactly how
   this phase was verified (§10).
3. Token generation and hashing live in exactly one place (Postgres
   pgcrypto) rather than being duplicated between a Deno Edge Function and
   a hypothetical client-side check.

The one *public* operation, `validate_founder_invitation`, is also an RPC
(granted to `anon` + `authenticated`) rather than an Edge Function, for the
same reasons — Phase 6's acceptance page can call it directly via
`supabase.rpc()`.

## 2. Final Founder invitation data model

`supabase/migrations/20260831000004_founder_invitations.sql`:

```
public.founder_invitations
  id                  uuid primary key default gen_random_uuid()
  founder_request_id  uuid not null references founder_access_requests(id) on delete cascade
  email               text not null            -- snapshot, copied server-side at creation
  normalized_email    text not null
  token_hash          text not null            -- sha-256 hex digest; plaintext never stored
  status              text not null default 'pending'  check in ('pending','accepted','revoked')
  expires_at          timestamptz not null
  created_at          timestamptz not null default now()
  updated_at          timestamptz not null default now()
  created_by          uuid not null references auth.users(id)          -- always auth.uid(), never client input
  revoked_at          timestamptz
  revoked_by          uuid references auth.users(id) on delete set null -- NULL = system supersede, set = admin revoke
  accepted_at         timestamptz
  accepted_by         uuid references auth.users(id) on delete set null
```

**Constraints:**
- `status` CHECK restricts to `pending | accepted | revoked`.
- `expires_at > created_at`.
- `status <> 'revoked' or revoked_at is not null` — a revoked row always
  carries its resolution timestamp.
- `status <> 'accepted' or (accepted_at is not null and accepted_by is not null)`.
- FK to `founder_access_requests(id) on delete cascade` (an invitation
  without its parent request is meaningless).

**Indexes:**
- `founder_invitations_token_hash_uniq` — unique index on `token_hash`
  (global uniqueness, spec §20/§27; also the direct indexed lookup path
  for validation).
- `founder_invitations_founder_request_idx` — `(founder_request_id,
  created_at desc)` for the admin "most recent invitation" read.
- `founder_invitations_pending_per_request_uniq` — **partial unique index**
  on `founder_request_id where status = 'pending'`. This is the
  single-active-invitation invariant (spec §9). `now()` cannot appear in
  an index predicate (not IMMUTABLE), so this index only guarantees "at
  most one *pending-status* row" — the create RPC transactionally
  supersedes a stale (expired) pending row into `revoked` before insert so
  a legitimate reissue is never blocked by its own predecessor (see §4).

**RLS:** enabled. Two policies, mirroring `founder_access_requests`
exactly:
- `Admins manage founder invitations` — `for all` `using/with check
  (is_admin())`.
- `Moderators read founder invitations` — `for select` `using
  (is_moderator())`.
- `anon` has zero table privileges and zero policies — the public
  validation path goes exclusively through the `validate_founder_invitation`
  RPC, never direct table access.

**Audit trigger:** `log_founder_invitation_change()` (AFTER INSERT/UPDATE),
mirroring `log_founder_request_change()` from Phase 2. Logs `invitation
id`, `founder_request_id`, actor, `from_status`/`to_status`, and a
`system_superseded` boolean — **never** the token or its hash.

**Lifecycle model chosen:** expiration is fully derived
(`expires_at < now()`), never a materialized fourth status value (spec
§18) — no scheduled job is needed to keep it accurate. `status` only ever
tracks `pending | accepted | revoked`; the admin UI and the validation RPC
both independently compute "expired" by comparing `expires_at` to the
current time.

## 3. Token security design

```
32 random bytes (extensions.gen_random_bytes(32))   -- 256 bits entropy
  -> hex-encode                                      -- 64-char plaintext token, URL-safe as-is
  -> extensions.digest(token, 'sha256')               -- one-way SHA-256
  -> hex-encode                                       -- 64-char token_hash, stored
```

- 256 bits of entropy is well over the ~128-bit target (spec §7).
- Never derived from email, UUID, timestamp, or request ID.
- `pgcrypto` functions are schema-qualified as `extensions.gen_random_bytes`
  / `extensions.digest` — this project sets `search_path = public` on
  every `SECURITY DEFINER` function, and pgcrypto lives in the
  `extensions` schema, not `public`. This exact failure mode (errcode
  `42883`) was already hit and fixed once before, for `crypt()`/`gen_salt()`,
  in `20260820000000_fix_admin_invite_user.sql` — Phase 4 avoids
  repeating it.
- **Lookup:** validation re-hashes the presented token with the same
  `extensions.digest(..., 'sha256')` call and looks it up by the unique,
  indexed `token_hash` column — a single indexed equality lookup, never a
  scan-and-compare (spec §27).
- The plaintext token is returned exactly once, in the JSON response of
  `admin_create_founder_invitation`. It is never selected, logged, or
  written anywhere else. Nothing in the schema can produce it again after
  that response.

## 4. Invitation creation flow

`admin_create_founder_invitation(p_founder_request_id uuid) returns jsonb`
(`supabase/migrations/20260831000005_founder_invitation_rpcs.sql`):

```
Approved Request
  -> is_admin() check (else 42501)
  -> load + `for share` lock founder_access_requests row
     -> not found -> P0002
     -> status <> 'approved' -> 22023
  -> `for update` lock any existing status='pending' row for this request
     -> found + not yet expired -> 23505 "an active invitation already exists"
     -> found + expired -> system-supersede: status='revoked', revoked_at=now(), revoked_by=NULL
  -> generate token (32 random bytes, hex) + hash (sha-256, hex)
  -> expires_at = now() + 72 hours   -- single constant, v_expiry_hours, in the RPC body
  -> insert (email/normalized_email copied from the request row, created_by = auth.uid())
  -> return { id, token, email, expiresAt }
```

`created_by` is read from `auth.uid()` inside the function body — never
accepted as a parameter — a deliberately stricter pattern than Phase 3's
`admin_review_founder_request(p_reviewer_id uuid)` (which trusts a
client-supplied reviewer id), because spec §23 explicitly requires
non-spoofable server-derived actor identity for this domain.

The 72-hour lifetime is a single named constant (`v_expiry_hours`) inside
the RPC — not a scattered literal — chosen as a middle ground between the
48-hour/72-hour/7-day options the brief allowed: long enough to survive a
weekend, short enough that a leaked link doesn't stay useful indefinitely.

## 5. Validation flow

`validate_founder_invitation(p_token text) returns jsonb`, granted to
`anon` + `authenticated`:

```
Raw Token
  -> format check: ^[0-9a-f]{64}$ (else { valid: false })
  -> hash (sha-256, hex)
  -> lookup by token_hash (unique index)
     -> not found -> { valid: false }
  -> status <> 'pending' -> { valid: false }
  -> expires_at <= now() -> { valid: false }
  -> linked founder_access_requests: not found or status <> 'approved' -> { valid: false }   (defense in depth, spec §28)
  -> { valid: true, organizationName, invitedEmail, expiresAt }
```

Every failure mode returns the identical `{ valid: false }` shape — a
caller cannot distinguish malformed / nonexistent / revoked / accepted /
expired / non-approved-request from each other (spec §15, verified
directly — see §10). On success, only safe public metadata is returned:
no `token_hash`, no internal IDs beyond what's needed for the acceptance
UX, no `reviewed_by`, no admin notes, no raw row.

## 6. Revocation flow

`admin_revoke_founder_invitation(p_invitation_id uuid) returns jsonb`:

```
Pending Invitation
  -> is_admin() check (else 42501)
  -> `for update` lock the invitation row
     -> not found -> P0002
     -> status = 'accepted' -> 22023 "an accepted invitation cannot be revoked"
     -> status = 'revoked' -> 22023 "invitation is already revoked"   (second revoke handled safely, not silently)
  -> status='revoked', revoked_at=now(), revoked_by=auth.uid()
  -> return { success: true, status: "revoked" }
```

`revoked_by` is always `auth.uid()` here — the `NULL` case is reserved
exclusively for the create RPC's own system-supersede path, so the audit
trail can always distinguish "an admin explicitly revoked this" from "a
fresh invitation superseded an expired one."

## 7. Files created / modified

| File | Purpose |
|---|---|
| `supabase/migrations/20260831000004_founder_invitations.sql` | Table, indexes, RLS, audit trigger |
| `supabase/migrations/20260831000005_founder_invitation_rpcs.sql` | `admin_create_founder_invitation`, `admin_revoke_founder_invitation`, `validate_founder_invitation`, `admin_founder_invitation_for_request` |
| `src/features/admin/model/founderInvitationQuery.ts` | Types + pure helpers: display-status derivation, create/revoke UI gating, accept-URL builder |
| `src/features/admin/model/founderInvitationQuery.test.ts` | 16 unit tests for the above |
| `src/features/admin/api/founderInvitationRepo.ts` | `supabase.rpc()` wrappers for the three RPCs |
| `src/hooks/useFounderInvitation.ts` | TanStack Query hook: read + create + revoke mutations |
| `src/components/Admin/AdminFounderInvitationSection.tsx` | Admin detail-page section: status, create/revoke actions, one-time token reveal |
| `src/pages/Admin/AdminFounderRequestDetailPage.tsx` | Renders the new section when `request.status === "approved"` |
| `src/pages/Admin/AdminFounderRequestDetailPage.css` | Rewritten to use real `--admin-*` design tokens (see note below) + new `.invitation-*` styles |

**Note on the CSS rewrite:** while extending this file, an audit found it
(and its Phase 3 siblings — `AdminApproveDialog.css`,
`AdminRejectFounderDialog.css`, `AdminFounderRequestsTable.css`,
`AdminFounderRequestsFilterDrawer.css`) referencing CSS custom properties
(`--primary`, `--text-primary`, `--info-bg`, `--surface-hover`, etc.) that
are not defined anywhere in the stylesheet tree — a latent styling defect
from the earlier Phase 3 session (silent, since undefined `var()` falls
back to the property's initial value rather than a build error). This
file was rewritten to use the real, defined `--admin-*` tokens from
`src/styles/admin.css` so both the pre-existing content and the new
invitation section render correctly and consistently. The four sibling
files were **not** touched — same defect, out of Phase 4's scope — and are
flagged here as a recommended follow-up.

## 8. Database files

- `supabase/migrations/20260831000004_founder_invitations.sql`
- `supabase/migrations/20260831000005_founder_invitation_rpcs.sql`

**Production SQL was not executed automatically.** Both files were applied
only to a local Supabase stack (via `supabase start`, on temporarily
remapped ports to avoid colliding with an unrelated sibling project also
running locally) for verification, then the local stack was torn down and
`supabase/config.toml` was reverted to its original committed state. The
project owner must review and apply both files to production manually, in
order, after `20260831000003_founder_request_directory_rpcs.sql`.

## 9. Security review

- **Entropy:** 256 bits per token (`gen_random_bytes(32)`), well over the
  ~128-bit target.
- **Hashing:** one-way SHA-256, single implementation (`extensions.digest`)
  shared by creation and validation — no client/server drift possible
  since both live in the same SQL file.
- **Plaintext handling:** never stored; returned once in the creation
  response; never logged (audit trigger metadata is `founder_request_id`
  + status transition + timestamps only); the admin UI holds it only in
  local React state, discarded on navigation/reload — confirmed live
  (§10).
- **Admin authorization:** `admin_create_founder_invitation` and
  `admin_revoke_founder_invitation` both re-check `is_admin()` inside the
  function body (not just RLS) and are granted to `authenticated` only —
  `anon` gets a hard 401 at the grant layer, not a soft RLS 403.
- **RLS:** enabled on the table with the same admin-full/moderator-read
  split as `founder_access_requests`; `anon` has zero table privileges.
- **Expiration:** fully server-derived (`now() + 72h` inside the RPC); the
  frontend never supplies or influences it.
- **Replay protection:** a revoked or accepted token fails validation
  permanently — there is no path back to `pending`.
- **Duplicate active invitations:** enforced by a partial unique index
  plus a `for update`-locked transactional check in the create RPC,
  race-safe against concurrent creates.
- **Audit logging:** every create/revoke transition is logged via
  trigger, distinguishing admin-initiated revokes (`revoked_by` set) from
  system supersedes (`revoked_by` NULL) — verified live (§10).

## 10. Test results

**Focused unit tests (pure model logic):**
```
npx vitest run src/features/admin/model/founderInvitationQuery.test.ts
✓ 16 tests passed
```

**Backend/RPC verification** — no Deno runtime is available in this
environment (confirmed during Phase 3), so the RPC layer (which contains
all the security-relevant logic — authorization, token generation,
hashing, lifecycle transitions) was verified with real HTTP requests
against a local Supabase stack, using real signed-in JWTs for admin/
moderator/regular-user actors and the anon key for anonymous requests.
All 38 scenarios from the brief's testing requirements were exercised
this way and passed:

- Creation: admin succeeds (1); moderator/regular-user/anonymous denied
  with distinct 403/403/401 (2-4); pending/rejected/nonexistent request
  rejected (5-7); token is 64 hex chars = 256 bits (8); DB stores only the
  SHA-256 hash, confirmed byte-for-byte against `sha256sum` (9-10); expiry
  is exactly 72h server-computed (11); email copied from the request row
  (12); `created_by` is the caller's real user id, not client-suppliable
  (13); a second active invitation is blocked with 409 (14).
- Validation: valid token succeeds with exactly the safe metadata shape
  (15); malformed/unknown/null tokens all return the identical `{valid:
  false}` (16-17, 22); expired token fails (18, via a backdated fixture
  row); revoked token fails (19); accepted token fails (20, via a
  Phase-6-simulating fixture); a linked request reverted away from
  `approved` fails validation as defense in depth (21).
- Revocation: admin succeeds (23); moderator/anonymous denied (24-25);
  `revoked_by`/`revoked_at` are server-set (26-27); a second revoke is
  rejected with a clear error, not a silent no-op or crash (28); an
  accepted invitation cannot be revoked (29).
- Security: token hashes are globally unique by index (30); direct `anon`
  SELECT/INSERT against the table both denied at the grant layer with 401
  (31-32); direct authenticated-but-non-admin SELECT denied by RLS with
  403 (33); PostgREST rejects any RPC call carrying `created_by`/
  `expires_at`/`status` as extra named parameters outright (404 — the
  function signature has no such parameters), which is stronger proof
  than "ignored" (34-36); the audit trigger's metadata and the
  `founder_invitations` row itself were inspected directly and contain no
  plaintext token anywhere (37-38).

All fixture data (test users, founder requests, invitations, audit log
rows) was created and deleted within the same local-only session; final
counts confirmed zero residual rows.

**Lint:**
```
npm run lint
✖ 1 problem (1 error, 0 warnings) — src/pages/AccountPage.tsx:297, pre-existing (documented in the Phase 1 report), unrelated to Phase 4
```
No new errors or warnings from any Phase 4 file.

**TypeScript:**
```
npx tsc --noEmit -p tsconfig.json
2 pre-existing errors — src/pages/HostEventDetailPage.tsx (missing modules, documented pre-existing in the Phase 1 report)
```
No new errors from any Phase 4 file.

**Build:**
```
npm run build
✓ built in 8.05s
```

**Existing-suite spot check** (files sharing the founder model, to confirm
no regression from touching adjacent code):
```
npx vitest run src/features/admin/model/founderInvitationQuery.test.ts src/lib/founderRequest.test.ts src/pages/FoundersPage.test.tsx
✓ 63 tests passed (3 files)
```

## 11. Manual QA

All rows below were exercised live against the local stack (not just
inferred from code):

| Scenario | Result |
|---|---|
| Approved Founder request | Invitation created; 64-hex token returned once |
| Pending Founder request | Creation blocked, 400 `22023` |
| Rejected Founder request | Creation blocked, 400 `22023` |
| First invitation | Secure token returned once in the JSON response |
| Database inspection | `select token_hash from founder_invitations` shows only the SHA-256 hex hash, confirmed to match `sha256sum` of the returned plaintext |
| Validate fresh token | `{valid:true, organizationName, invitedEmail, expiresAt}` |
| Validate bad token | `{valid:false}` (malformed, unknown, and null all identical) |
| Validate expired token | `{valid:false}` |
| Revoke invitation | Token immediately fails validation |
| Create second active invitation | Blocked, 409 `23505` |
| Reissue after revoke | Fresh token generated (different hash) |
| Reissue over a stale expired-pending row | Auto-superseded (`revoked_by` NULL), fresh token generated |
| Moderator tries create/revoke | Denied, 403 `42501` |
| Anonymous table access (SELECT/INSERT) | Denied, 401 at the grant layer |
| Admin UI: Create Invitation button | Shows "Invitation pending", expiry, and a one-time copyable `/founders/accept?token=...` link |
| Admin UI: reload after creation | Token reveal permanently gone; "Revoke Invitation" now shown in place of "Create Invitation" |
| Admin UI: Revoke Invitation button | Status flips to "Invitation revoked"; "Create Invitation" reappears |
| Moderator UI | Sees the same status line, zero action buttons |

## 12. Manual owner actions

1. Review and apply, in order, to production:
   - `supabase/migrations/20260831000004_founder_invitations.sql`
   - `supabase/migrations/20260831000005_founder_invitation_rpcs.sql`
2. No Supabase dashboard configuration changes are required for Phase 4
   (no new environment variables, no Auth settings changes, no Storage
   changes).
3. No `.env` changes required.

## 13. Phase 4 completion verdict

**Yes — the system is ready for Phase 5 (Approval & Invitation Email).**
All four required primitives exist and are verified: an approved request
can be turned into a single-use, time-limited, revocable token
(`admin_create_founder_invitation`); that token can be safely validated by
an anonymous caller without leaking why a check failed
(`validate_founder_invitation`); an admin can revoke it
(`admin_revoke_founder_invitation`); and the invitation state is visible
on the existing admin review UI. Phase 5 needs only to call
`admin_create_founder_invitation` from wherever the approval action lives
(or from the existing "Create Invitation" admin button) and pipe its
`token`/`expiresAt`/`email` into an email template pointed at
`/founders/accept?token=<token>` — no schema or RPC changes are
anticipated to be required for that handoff.
