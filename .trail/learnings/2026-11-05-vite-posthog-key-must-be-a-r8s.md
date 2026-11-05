---
title: "VITE_POSTHOG_KEY must be a phc_ project token, never phs_"
author: R8S
date: 2026-11-05
branch: main
id: l-39178399
scope: repo
status: active
src: agent
touches:
  - ".env.example"
  - DESIGN.md
  - docs/roadmap/account-profile-phase-ledger.md
  - package-lock.json
  - package.json
  - src/components/layout/ScrollToTop.tsx
  - src/features/shopify/api/operations.ts
  - src/features/shopify/api/storefront.test.ts
  - src/features/shopify/api/storefront.ts
  - src/features/shopify/api/types.ts
---

## Decided
- `VITE_POSTHOG_KEY` is browser-visible by design. Only the `phc_` project token is safe there.
- `.env.local` previously held a `phs_` project-secret key in `VITE_POSTHOG_KEY`. That key grants private-data access and must never reach the client bundle. It also returned 401 from PostHog's API, so it was already invalid.
- `src/main.tsx` now throws if `VITE_POSTHOG_KEY` does not start with `phc_`. `.env.example` documents the correct key type.

## Watch out
- PostHog key prefixes: `phc_` = public project token (browser-safe), `phs_` = project secret (server-only), `phx_` = personal API key (server-only). A `VITE_` variable with the wrong prefix is a secret leak, not a config error.
- The project token lives in PostHog project settings ("Project API key"), not retrievable via the secret key's API.
