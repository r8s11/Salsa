# No-Docker Storage Acceptance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Exercise flyer and profile-media upload contracts without Docker or a real Supabase Storage service.

**Architecture:** Add a loopback-only Bun acceptance server that implements only the Storage endpoints this repository uses: object upload, public object read, and object delete. It writes to a temporary directory, enforces bucket/MIME/size/path rules, and verifies locally signed JWT ownership for authenticated paths. It is test infrastructure—not a GoTrue replacement and not production runtime wiring.

**Tech Stack:** Bun/Node Web APIs, local filesystem, Web Crypto HMAC JWT verification, Supabase JS Storage client, Vitest or a standalone acceptance script.

**Spec:** User-approved no-Docker constraint from 2026-09-19. This plan does not change production upload URLs.

## Global Constraints

- Bind to `127.0.0.1` only.
- Store data only below a generated temp directory; remove it after the acceptance run.
- Never accept or print production service-role keys.
- Supported buckets: `event-flyers`, `profile-media` only.
- Event flyers: JPEG/PNG/WebP, max 5 MiB; anonymous writes only under `anonymous/`; authenticated writes only under `<sub>/`.
- Profile media: JPEG/PNG/WebP, max 5 MiB; authenticated writes only under `<sub>/`.
- This proves client/Storage protocol behavior, not GoTrue, CDN, hosted Storage internals, or live-project RLS.

---

### Task 1: Minimal Storage-Compatible Server

**Files:**

- Create: `scripts/storage-acceptance/server.mjs`
- Create: `scripts/storage-acceptance/jwt.mjs`

**Interfaces:**

- `startStorageServer({ port, root, jwtSecret }) -> Promise<{ url, close }>`.
- Routes: `POST /storage/v1/object/:bucket/*`, `GET /storage/v1/object/public/:bucket/*`, `DELETE /storage/v1/object/:bucket` with `{ prefixes: string[] }`.

- [ ] **Step 1: Write protocol-level failing acceptance cases**

Cases: anonymous flyer upload succeeds only under `anonymous/`; anonymous profile upload fails 403; authenticated owner upload succeeds; cross-owner upload/delete fails 403; invalid MIME fails 400; file over 5 MiB fails 413; public read returns exact bytes/content type; delete removes the object.

- [ ] **Step 2: Implement JWT verification**

Verify HS256 signature, `exp`, `role`, and non-empty `sub` using Web Crypto. Reject unsigned/invalid tokens; never trust decoded claims before signature verification.

- [ ] **Step 3: Implement the three routes**

Normalize/decode paths; reject absolute paths, `..`, unknown buckets, unsupported methods, overwrite without `x-upsert: true`, and writes outside the permitted namespace. Stream request bodies to files after validation.

### Task 2: Supabase JS Acceptance Matrix

**Files:**

- Create: `scripts/storage-acceptance/verify.mjs`
- Modify: `package.json`

**Interfaces:**

- Produces npm command `npm run verify:storage:no-docker`.

- [ ] **Step 1: Start server on an ephemeral port and create clients**

Create anon and authenticated `@supabase/supabase-js` clients against the loopback server; set locally signed access tokens only for authenticated cases.

- [ ] **Step 2: Exercise repository-equivalent calls**

Use `.storage.from(bucket).upload`, `.getPublicUrl`, and `.remove`. Assert every allow/deny case and exact cleanup.

- [ ] **Step 3: Guarantee cleanup**

Close the server and recursively remove the temporary directory in `finally`, including failed assertions.

- [ ] **Step 4: Run the acceptance command**

Require exit 0 and print a concise passed/total count. This command must not invoke Docker or contact the network.

## Boundary

This acceptance shim cannot make interactive authenticated local profile editing work by itself because the no-Docker stack also lacks GoTrue. Live avatar upload is repaired by applying the verified `profile-media` migration to the hosted project; local authenticated browser testing still needs either hosted Auth or a separate Auth emulator.
