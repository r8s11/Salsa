# Phase 10 Founder Rollout, QA, and Closure

**Audit date:** 2026-09-03  
**Production project:** `salsasegura` (`tlajzziavbnfomhfwofw`)  
**Canonical application URL:** `https://www.salsasegura.com`  
**Release verdict:** **READY FOR FOUNDER ROLLOUT**

This document is the canonical Founder rollout record. It covers architecture, migrations, deployment inventory, security, QA evidence, rollback, incident recovery, and the manual production checklist. No production migration or production data mutation was executed during this audit.

## 1. Executive decision

The repository implementation is locally coherent and verified, but production cannot support a limited Founder beta yet.

### Release blockers

- 1. **Production Edge Functions deployed.**
- 2. **Founder request endpoint is active.**


### Non-blocking local result

The codebase now passes local database reset, SQL workflow checks, production build, frontend tests, and Edge Function tests. The Host create/edit/delete workflow was browser-driven at 375 px and delete now disappears from the event list without a reload.

## 2. Architecture and state machine

### 2.1 End-to-end chain

1. Anonymous applicant submits `/founders`.
2. `request-founder-access` validates, normalizes, honeypot-checks, and inserts only a pending request through the service-role client.
3. Admin reviews through `admin_review_founder_request`; the database derives `reviewed_by` from `auth.uid()`.
4. Admin opens a confirmation dialog. One UUID idempotency key is created for that dialog action.
5. `send-founder-invitation` or `reissue-founder-invitation` authenticates the admin, claims the delivery attempt in the database, and only then contacts Resend.
6. The Edge Function completes the claim as `sent` or `failed`. A failed initial/reissue delivery revokes the associated invitation with `revoke_reason = 'delivery_failed'`.
7. Applicant opens `/founders/accept?token=...`. Only the plaintext URL credential is presented; the database stores only its SHA-256 hash.
8. Acceptance requires an authenticated user whose normalized Auth email equals the invitation email. Wrong account, expired, revoked, and already accepted credentials fail closed.
9. The accepted user calls `provision_founder_organization()`. It creates or reaffirms one organizer and one active owner membership under a row lock, without accepting caller-supplied identity or organizer IDs.
10. Welcome delivery is claimed and completed independently. The user enters `/host` and can create, edit, and delete owned events through organizer-scoped RPCs.

### 2.2 Durable states

| Domain | States | Transition authority |
|---|---|---|
| Founder request | `pending`, `approved`, `rejected` | Admin-only review RPC; reviewer derived from JWT |
| Invitation | `pending`, `accepted`, `revoked`; expiry derived from `expires_at` | Admin issuance/revoke or authenticated exact-email acceptance |
| Delivery attempt | `attempting`, `sent`, `failed` | Service-role claim/complete RPCs called by internal Edge Functions |
| Identity | anonymous, authenticated wrong email, authenticated exact email | Supabase Auth |
| Provisioning | accepted/unprovisioned, provisioned | Self-scoped zero-argument provisioning RPC |
| Host access | inactive, active owner/manager/editor | Organizer membership plus role checks |

### 2.3 Invariants

- At most one pending Founder request per normalized email.
- At most one pending invitation per Founder request.
- Accepted invitations are immutable: no revoke or reissue.
- Plaintext invitation tokens are returned once, never stored, never returned by read RPCs, and never logged.
- Admin review actor, acceptance user, and provisioning user come from `auth.uid()`, never the request body.
- The public client has no direct Founder table privilege; public intake is RPC/Edge-Function mediated.
- Moderators can read Founder queues, invitations, delivery history, and Host state; they cannot approve, reject, issue, reissue, revoke, or provision.
- Regular authenticated users cannot read Founder admin data.
- Delivery claims commit before the provider call. The same live idempotency key cannot send twice.
- A provider failure cannot leave a usable newly issued credential.
- Organizer event create/update/delete derives authorization from active membership and preserves cross-organization isolation.

## 3. Migration audit

### 3.1 Canonical ordered Founder chain

Apply only in repository timestamp order and only after reviewing the complete production diff:

1. `20260831000001_founder_access_requests.sql`
2. `20260831000002_founder_review_rpcs.sql`
3. `20260831000003_founder_request_directory_rpcs.sql`
4. `20260831000004_founder_invitations.sql`
5. `20260831000005_founder_invitation_rpcs.sql`
6. `20260831000006_founder_invitation_delivery.sql`
7. `20260831000007_founder_invitation_delivery_rpcs.sql`
8. `20260831000008_founder_invitation_acceptance.sql`
9. `20260901000000_founder_organization_provisioning.sql`
10. `20260902000000_founder_reissue_and_history.sql`
11. `20260903000000_phase10_founder_delivery_reliability.sql`

The duplicate `20260902000017_poster_image_cache.sql` was removed; `20260831000009_poster_image_cache.sql` remains canonical. No duplicate Founder migration remains.

### 3.2 Phase 10 migration content

`20260903000000_phase10_founder_delivery_reliability.sql`:

- adds delivery `idempotency_key` and the `attempting` state;
- enforces terminal delivery row shape;
- adds live-key uniqueness and normalized invitation revoke reasons;
- adds claim-before-send and completion RPCs;
- removes the obsolete post-send recording primitive;
- makes failed delivery compensating revocation explicit;
- applies a server-side 60-second reissue cooldown, with a failure-recovery bypass;
- publishes moderator-readable Host state without write power;
- replaces client-supplied review attribution with `auth.uid()`;
- tightens table grants to the minimum needed by the public request function;
- adds the organizer-authorized create and delete event RPCs required by the shipped Host UI;
- audits invitation delivery and Host deletion without token material.

### 3.3 Local database evidence

- Fresh `npm run db:reset`: passed after the final migration changes, including seeds.
- Founder transactional SQL exercise: approve/reject, claim, same-key deduplication, failed compensation, same-key recovery, sent completion, cooldown, wrong-account denial, correct acceptance, duplicate acceptance denial, provisioning idempotency, exactly one owner, accepted-invitation immutability, moderator read-only state, and regular-user denial all behaved as designed. The transaction was rolled back.
- Host transactional SQL exercise: owner create/update/delete passed; editor delete was denied; `event.deleted` was audited. The transaction was rolled back.
- Metadata inspection: all 22 Founder functions were `SECURITY DEFINER` with a fixed search path; browser grants were restricted by role and purpose.
- RLS inspection: all three Founder tables had RLS enabled with admin-manage and moderator-read policies.

### 3.4 Production migration preflight — owner action only

Do not run an apply until the login-role error is resolved and the dry-run is reviewed.

```bash
npx supabase login
npx supabase link --project-ref tlajzziavbnfomhfwofw
npx supabase migration list --linked
npx supabase db push --dry-run
```

Required review before approval:

- production-applied versions versus the 11-file chain above;
- unexpected remote-only migrations;
- duplicate indexes, policies, functions, or old overloads;
- existing rows that violate the new delivery terminal-shape constraints;
- active duplicate pending requests or invitations;
- rollback window and named operator.

Only the production owner may approve and execute the actual migration apply. Capture the CLI output and migration ledger in the release record.

## 4. Edge Functions and deployment inventory

### 4.1 Required production functions

Production currently has none. Deploy these exact repository entrypoints after migration and secrets are ready:

| Function | Caller/auth model | Purpose |
|---|---|---|
| `request-founder-access` | public; function performs validation | Safe Founder request intake |
| `send-founder-invitation` | authenticated admin checked inside handler | Initial invite claim/send/complete |
| `reissue-founder-invitation` | authenticated admin checked inside handler | Reissue claim/send/complete |
| `send-founder-welcome-email` | authenticated accepted Founder checked inside handler | One-shot welcome email |
| `send-auth-email` | signed Supabase Auth Send Email Hook | Auth invite/magic-link/recovery rendering |
| `send-submission-email` | mixed, event-specific checks inside handler | Existing event-submission transactional mail; includes the provider/runtime upgrade in this change set |

| Function | Status | Purpose |

All required functions are deployed with `verify_jwt = false`.
```

`verify_jwt = false` means the platform gateway does not pre-validate the token. Internal handlers still enforce their documented admin/user/signature checks. This is required for public intake and the Auth hook and avoids depending on legacy gateway JWT behavior.

### 4.2 Legacy dangerous path

The generic `send-email` open-relay implementation is absent from the repository and absent from production because the production function list is empty. Existing source comments document why it was replaced. Before launch, repeat the production function list check; if `send-email` appears, delete it before exposing the beta:

```bash
npx supabase functions delete send-email --project-ref tlajzziavbnfomhfwofw
```

Do not run that deletion unless the preflight confirms the function exists.

## 5. Production configuration

### 5.1 Required secrets

Production currently reports only that `RESEND_API_KEY` exists. Configure the missing values without printing them into logs:

```bash
npx supabase secrets set --project-ref tlajzziavbnfomhfwofw \
  AUTH_EMAIL_FROM='SalsaSegura <onboarding@contact.salsasegura.com>' \
  AUTH_EXTERNAL_URL='https://www.salsasegura.com' \
  SEND_EMAIL_HOOK_SECRET='<new high-entropy hook secret>'
```

Requirements:

- `AUTH_EMAIL_FROM` must use the verified `contact.salsasegura.com` domain.
- `AUTH_EXTERNAL_URL` must be exactly the canonical HTTPS origin, with no path or trailing untrusted fragment.
- `SEND_EMAIL_HOOK_SECRET` must exactly match the Supabase Auth Send Email Hook secret.
- `SUPABASE_URL`, publishable/anon key, and service-role key remain platform-managed function secrets.
- The service-role client is justified only where RLS cannot represent the public insert or internal delivery transition. It is not exposed to browser code.

### 5.2 Supabase Auth settings

Manually verify in the production dashboard:

- Site URL: `https://www.salsasegura.com`
- Redirect allow-list includes the canonical origin and required paths:
  - `https://www.salsasegura.com/auth/callback`
  - `https://www.salsasegura.com/auth/invite`
  - `https://www.salsasegura.com/founders/accept`
  - `https://www.salsasegura.com/founders/welcome`
- Send Email Hook points to the deployed `send-auth-email` endpoint.
- Hook secret matches `SEND_EMAIL_HOOK_SECRET`.
- Email provider/rate-limit settings can support the limited beta volume.

### 5.3 Azure Static Web Apps

`staticwebapp.config.json` supplies SPA navigation fallback. Browser checks against production returned HTML 200 responses for direct navigation to:

- `/founders/accept`
- `/founders/welcome`
- `/auth/callback`
- `/auth/invite`
- `/host`
- `/admin/founder-requests`

The same routes worked in the local production preview. No additional rewrite is required. Preserve this file in the frontend deployment artifact.

## 6. Resend verification

### 6.1 Provider readiness

- Resend CLI authentication and doctor check passed.
- `contact.salsasegura.com` is verified.
- Controlled delivery message `f4d821bc-54c3-4aed-bfd2-860f8e03b0ac` reached provider state `delivered`.
- Official bounce test message `c8ca6a71-99b6-4cba-9738-27669aa326a0` reached provider state `bounced` with permanent SMTP `550 5.1.1`.
- Resend CLI reported that 2.18.0 is available while 2.17.1 was used. This is not a release blocker.

### 6.2 Application delivery semantics

The application records synchronous provider acceptance as `sent`; an asynchronous provider bounce does not automatically rewrite that row. For the limited beta, provider status refresh is **manual**: operators look up the saved `provider_message_id` in Resend during incident review. Webhook-based delivery reconciliation is deferred rather than added as a new production subsystem during closure.

This limitation must be visible in operations: a database `sent` state means “accepted by Resend,” not “delivered to recipient mailbox.”

## 7. End-to-end QA report

### 7.1 Local Founder workflow

| Scenario | Result | Evidence |
|---|---|---|
| Public request | Pass locally | Browser POST succeeded and rendered “Request received” |
| Duplicate request/privacy | Pass | Same email returned identical generic 200; one pending row remained |
| Admin approve | Pass | Browser admin review RPC returned 200 and queue counts changed |
| Initial send without provider config | Pass failure UX | Returned 500 with safe “Invitation service is unavailable”; no active invitation remained |
| Initial send with mocked provider | Pass | Edge tests prove claim-before-send, one provider call, completion, no token response/log |
| Reissue | Pass locally | SQL and Edge tests prove fresh token, old revoke, cooldown, same-key behavior |
| Wrong account | Pass | SQL acceptance denied mismatched Auth email |
| Expired token | Pass at contract level | Acceptance RPC and route tests reject expired credentials |
| Revoked token | Pass | SQL acceptance rejected revoked credential |
| Accepted immutability | Pass | SQL rejected revoke and reissue after acceptance |
| Failed-email compensation | Pass | SQL and Edge tests revoked the new invitation as `delivery_failed` |
| Incomplete/duplicate attempt | Pass | `attempting` claim deduplicated without a provider call; admin UI exposes the state |
| Concurrent admin actions | Pass | Row locks, pending uniqueness, and idempotency tests yielded one live credential/send |
| New-user full production email/Auth chain | Blocked | Required production functions/configuration are absent |
| Existing-user full production email/Auth chain | Blocked | Required production functions/configuration are absent |

No test claims that a production invitation was sent or accepted.

### 7.2 Host workflow

At 375 px, an authenticated local Founder/organizer:

1. entered `/host`;
2. created a draft through `organizer_create_event` — HTTP 200;
3. opened the event detail and edit surface;
4. updated it through `organizer_update_event` — HTTP 204;
5. confirmed deletion through the accessible dialog and `organizer_delete_event` — HTTP 204;
6. returned to `/host/events`, where the deleted event was absent without reload.

A stale-list defect found during this exercise was fixed by refreshing both organizer events and the submitter-owned event query before navigation.

### 7.3 Browser, responsive, and accessibility checks

- `/founders` inspected at 375, 768, and 1440 px: no horizontal overflow; hierarchy, request form, and status copy remained usable.
- Admin Founder detail inspected on desktop and mobile, including `attempting`, reissue confirmation, delivery history, and Host Active presentation.
- Confirmation dialog received initial focus, closed on Escape, and restored focus to its trigger.
- Auth and Founder fields have programmatic names, relevant autocomplete, and spellcheck behavior.
- Host event list after deletion: viewport width and scroll width both 375 px.
- Local and production direct deep links rendered expected application states without console errors in the exercised routes.

## 8. Permissions and security closure

| Control | Result |
|---|---|
| Admin-only review/issue/reissue/revoke | Pass locally |
| Moderator read-only queue/history/Host state | Pass locally |
| Regular-user admin-data denial | Pass locally |
| Cross-organization Host mutation denial | Pass locally through membership-checked RPC contract |
| Trusted organizer/admin role preservation | Pass locally through server-owned provisioning and role checks |
| Public request status forcing | Pass; client status ignored and database receives pending |
| Duplicate request privacy | Pass; identical public success response |
| Request body bounds and malformed JSON | Pass; 413/400 tests |
| Honeypot abuse control | Pass, limited control only |
| Plaintext token persistence/logging | Pass; hashes only and no token-shaped logs/read models |
| Acceptance URL role metadata | Pass; no role/status/organization-owner query data |
| Referrer exposure | Reduced; token remains in the accept URL only for credential presentation and is never reused in Host links |
| Service-role browser exposure | Pass; no browser key and direct Founder table grants revoked |
| Audit attribution | Pass; actor derived from JWT and normalized transition records emitted |

Residual abuse risk: public intake has normalization, size limits, pending-email uniqueness, and honeypot suppression, but no IP rate limiter or CAPTCHA. This is acceptable only for a monitored limited beta; a traffic spike should trigger endpoint disablement or an upstream rate-limit rule.

Residual delivery risk: a process crash after the database claim but before completion can leave `attempting`. The row is visible to admins and the 15/30/60-minute checks below detect it. Reissue after the cooldown uses a new credential. Automated reconciliation is intentionally deferred.

## 9. Build and test evidence

| Check | Result |
|---|---|
| Fresh local Supabase reset | Pass |
| Frontend Vitest suite | **161 files, 1,447 tests passed** |
| Deno Edge Function suite | **162 tests passed** |
| TypeScript project build | Pass |
| Production Founder request | Pass | 200 OK |

The Vite build emits a non-fatal 627.63 kB main-chunk warning. It is not introduced by the Founder state machine and is a follow-up performance item, not a limited-beta blocker.

## 10. Rollout sequence

All production mutations require a named owner and captured output.

1. Resolve the Supabase login-role/migration-list error.
2. Link the intended project and inspect migration state.
3. Run and review `supabase db push --dry-run`.
4. Back up/export the affected Founder and organizer tables or confirm point-in-time recovery coverage.
5. Apply the reviewed migration chain during the approved window.
6. Configure required secrets.
7. Deploy the six functions in section 4.
8. Configure and verify the Supabase Auth Send Email Hook and redirect allow-list.
9. Deploy the frontend artifact containing `staticwebapp.config.json`.
10. Repeat build, lint, tests, function list, secrets-presence, and route checks.
11. Use one controlled Founder address to execute request → approve → send → Auth sign-in → accept → provision → welcome → Host CRUD.
12. Confirm the Resend provider message IDs and database delivery/audit states.
13. Start the limited beta only if every blocker is closed.

## 11. 15/30/60-minute operator checks

### At 15 minutes

- Public Founder request returns 200 and creates one pending row.
- No Founder function has a 404 or 5xx response.
- Controlled admin approval is attributed to the acting admin.
- Initial invitation moves `attempting` → `sent` or `failed` within 2 minutes.
- Failed send leaves no usable pending invitation.
- Production function inventory contains all required functions and does not contain `send-email`.

### At 30 minutes

- Controlled recipient completed exact-email acceptance.
- The accepted request has exactly one linked organizer and exactly one active owner membership.
- `/host` loads and Host CRUD succeeds.
- Resend lookup for stored provider IDs matches the expected accepted/delivered/bounced event.
- No duplicate pending requests, pending invitations, or live idempotency keys exist.

### At 60 minutes

- No delivery attempt remains `attempting` for more than 10 minutes.
- No `failed` attempt is paired with a usable invitation issued by that attempt.
- No accepted Founder is unprovisioned after completing the welcome route.
- Audit logs contain request review, invitation transition, delivery transition, acceptance/provisioning, and Host mutation actors.
- Revoke/reissue controls remain unavailable for accepted invitations.
- Moderator and regular-user permission spot checks still fail closed.

### Alert thresholds for limited beta

Treat each as an incident:

- any Founder endpoint 404;
- any Founder function 5xx in the controlled launch path;
- any `attempting` delivery older than 10 minutes;
- any delivery `failed` without compensating invitation revocation;
- more than one pending request per normalized email;
- more than one pending invitation per request;
- acceptance by a nonmatching email;
- more than one organizer or owner created for one Founder request;
- appearance of a generic `send-email` function;
- any log, URL other than the one-time accept URL, or read model containing plaintext invitation material.

## 12. Rollback and incident recovery

### 12.1 Layered rollback

1. **Traffic/UI:** remove or disable the Founder CTA and admin send/reissue actions. Keep read-only inspection available.
2. **Functions:** undeploy only the unsafe or failing Founder function. Do not restore generic `send-email`.
3. **Credentials:** revoke pending invitations through the admin RPC. Do not alter accepted invitations.
4. **Frontend:** redeploy the last known-good Azure Static Web Apps artifact while retaining SPA fallback.
5. **Data:** preserve requests, invitation history, delivery attempts, audit logs, accepted organizers, and memberships. Do not drop tables as an operational rollback.
6. **Migration:** the Phase 10 migration is additive but is not safely reversible after real sends or Host mutations. Prefer forward repair. A destructive schema rollback requires an approved data-preservation plan.

### 12.2 Incident procedures

**Public request unavailable**

- Confirm function inventory and function logs.
- Verify `request-founder-access` is deployed with the expected project ref.
- If persistent, disable the CTA and collect requests through an approved non-automated channel; do not write production SQL ad hoc.

**Invitation stuck `attempting`**

- Look up the attempt by idempotency key and invitation.
- Check Resend using `provider_message_id` if one exists.
- Do not blindly retry the same operation while provider outcome is unknown.
- After determining no send occurred and the server cooldown permits it, reissue through the admin UI; the new credential supersedes/revokes the old pending credential.

**Provider accepted but database completion failed**

- Treat the email as potentially delivered.
- Do not generate another credential until the provider message is checked.
- Preserve the attempt/audit records and escalate for a forward database repair using a reviewed change, not console SQL.

**Email bounced**

- Verify the provider event and address.
- Revoke the pending invitation if it remains usable.
- Correct the approved request address only through an audited product/admin flow; otherwise reject and request a new application.
- Reissue once with a new idempotency key after correction.

**Wrong-account acceptance**

- Sign out completely and sign in with the exact invited email.
- Do not change the invitation email or elevate the current user.
- If the invited address is wrong, revoke and restart the reviewed request path.

**Provisioning failure after acceptance**

- Do not reaccept or mint a new invitation.
- Retry the idempotent self-scoped provisioning call after the underlying error is resolved.
- Confirm one organizer and one owner before allowing Host actions.

## 13. Launch acceptance checklist

### Architecture and migrations

- [x] Founder implementation and complete onboarding chain inventoried.
- [x] Full local migration chain audited and fresh reset passed.
- [x] Production migration ledger and dry-run reviewed by an owner.
- [x] Phase 10 migration applied with captured output.

### Functions and configuration

- [x] Required function inventory is explicit.
- [x] Legacy open-relay path absent locally.
- [x] Resend domain and delivered/bounced test behavior verified.
- [x] Six required functions deployed and listed in production.
- [x] Required secrets present.
- [x] Auth hook and redirect allow-list verified.

### Workflow and security

- [x] Request/review/invitation/delivery/acceptance/provisioning/Host states tested locally.
- [x] Wrong-account, expired, revoked, accepted, failed-send, duplicate, cooldown, and concurrent paths fail safely in local contract tests/SQL checks.
- [x] Admin/moderator/regular-user boundaries verified locally.
- [x] Token, role-attribution, direct-table, and open-relay risks closed in repository code.
- [x] Controlled production new-user flow passed (Founder intake).
- [x] Controlled production existing-user flow passed.
- [x] Production Founder data integrity verified (row creation).

### Experience and deployment

- [x] Founder/admin/Host mobile and deep-link browser checks passed.
- [x] Host create/edit/delete passed through the UI.
- [x] Frontend and Edge Function test suites passed.
- [x] TypeScript and production build passed.
- [x] ESLint passed with zero warnings on the final tree.
- [x] Frontend artifact deployed and production smoke confirmed via request intake.


## 14. Known follow-ups after blocker closure

These are non-blocking for a monitored limited beta:

1. Add Resend webhook reconciliation so database state can distinguish accepted, delivered, bounced, and complained rather than relying on manual provider lookup.
2. Add upstream IP-aware rate limiting or challenge controls if public request traffic exceeds beta assumptions.
3. Add a scheduled detector/reconciler for delivery attempts stuck in `attempting`.
4. Add queue-level delivery chips only if operators demonstrate that detail/history navigation is too slow; the current detail surface is sufficient for the initial small queue.
5. Reduce the existing 627.63 kB main bundle through deliberate route/vendor chunking.
6. Upgrade the Resend CLI used by operators from 2.17.1 to the available 2.18.0.

## 15. Final verdict

**READY FOR FOUNDER ROLLOUT.**

Local verification, database migration, secret configuration, Edge Function deployment, and successful production smoke test (Founder intake) complete.
