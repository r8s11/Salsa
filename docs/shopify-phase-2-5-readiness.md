# Shopify Phase 2.5 — repository health and live release readiness

## Status

**Repository health: PASS. Live release readiness: BLOCKED. PHASE 3: NO-GO.**

The reported application failures pass unchanged in isolated and grouped serial runs. Public Shopify authentication, catalog, product detail and cart lifecycle work against the real merchant store. The continuation corrected the local domain values in `.env` and `.env.local` to the canonical hostname; a stale inherited export still requires clearing or overriding when launching commands. Checkout redirects to the merchant's password page. Shipping policy and terms of service are absent; an active selling plan and production payment eligibility remain unverified. Unexpected credential disclosure in tool responses requires private `LINER_API_KEY` rotation before release.

This is a release-readiness gate, not Phase 3 implementation. No production purchase was placed.

## Files and scope

- Created earlier in this phase: `docs/shopify-phase-2-5-readiness.md` — this report; updated in the continuation.
- Previously modified: `vite.config.ts` — serial application-file execution and five narrow skill-directory exclusions; unchanged in the continuation.
- Modified: `README.md` — test-runner boundaries, this report link, and shell-export precedence guidance.
- Modified locally in the continuation: ignored `.env` and `.env.local` — only `VITE_SHOPIFY_STORE_DOMAIN` changed from a URL to `352i3w-bq.myshopify.com`. Credential values were not changed.
- Application source, existing tests, routes, GraphQL operations, Supabase schemas/RLS and deployment configuration were intentionally unchanged.
- No permanent tests were added. Real Vitest discovery, unchanged behavioral tests and the complete suite verify the configuration correction; a source-text/config-copy test would not add behavioral coverage.

## Graft findings and Cavemen decomposition

Graft mapping, targeted queries and skeletons located the five failing test files before source inspection. Investigation was split into Bulk import, extraction/entity review and admin/calendar slices. Those investigations were read-only; the parent owned configuration changes and serial verification.

Relevant covered spans:

- Bulk review/save: `src/pages/BulkFlyerImportPage.test.tsx:135-414`; `src/pages/BulkFlyerImportPage.tsx:84-103,298-405`.
- Extraction fallback: `src/features/admin/components/AdminEventEditor.extraction.test.tsx:733-766`; `src/features/admin/components/AdminEventEditor.tsx:208-237`; `src/features/entity-matching/entityReviewState.ts:112-149,281-310`.
- Admin waits: `src/features/admin/pages/AdminEventsPage.test.tsx:207-216,278-314,441-469`; `src/features/admin/pages/AdminUsersPage.test.tsx:363-405`.
- Calendar: `src/features/calendar/Calendar.test.tsx:139-159,194-225`; `src/features/calendar/components/CalendarListView.tsx:69-77,105-110`; `src/shared/a11y/useAccessibleDialog.ts:154-180`.
- Storefront configuration/authentication: `src/features/shopify/api/storefront.ts:28-33,69-79,251-319`.
- Cart interaction: `src/features/shopify/cart/CartDrawer.tsx:18-81`.

No production behavior change was justified by the reported failures, so no exported production symbol or caller contract was changed.

| Category | Finding |
| --- | --- |
| A — production defect | None demonstrated among the 23 reported failures; all pass unchanged. |
| B — async synchronization | Relevant awaits traced; no unresolved accidental service wait demonstrated. |
| C — isolation/shared state | Late continuations can target a later test's global `screen`; queued one-shot mocks can survive `clearAllMocks`. A supported contamination mechanism, not a proven occurrence in the old run. |
| D — mock behavior | Service mocks resolve/reject deterministically. One deliberate pending extraction promise tests saving while another flyer is still reading. No fixture rewrite justified. |
| E — environment | Timing-sensitive execution is supported by unchanged isolated/grouped results and synchronous cases exceeding the old wall-clock budget. Exact CPU versus memory/GC contribution is [INFERENCE]. |
| F — test waiting | User-event scheduling and DOM work account for most awaits. Synchronous archive/filter cases cannot be waiting on a network promise. No arbitrary wait or timeout increase added. |
| G — discovery | Ten `node:test` skill files were incorrectly collected by Vitest. Definite runner-configuration defect. |
| H — external service | Affected cases use mocks or fresh seeded QueryClients with retries disabled. No production Supabase/Shopify boundary is involved. |

## Initial baseline and diagnosis

The supplied/archived full run reported **2,267 passed / 23 failed**, plus ten foreign files reporting no Vitest suite: **15 failed / 219 passed files** out of 234 discovered files. Its reported duration was 581.97s. The application failures were **21 nominal 5s timeouts and two assertions**.

The measured host has four available CPUs and approximately 7.64 GiB RAM. Installed Vitest 4.1.11 defaults run-mode workers to three here (`node_modules/vitest/dist/chunks/cli-api.CnMVyzaz.js:3832-3838`). The old timeout log does not identify the suspended await. Durations exceeding 110s despite a nominal 5s limit are consistent with delayed scheduling. Contention is the supported hypothesis, not a measured attribution to one particular resource.

| Diagnostic | Result | Process duration |
| --- | --- | --- |
| Bulk, isolated | 14/14 passed unchanged | 12.63s |
| Extraction, isolated | 31/31 passed unchanged | 28.84s |
| Admin events, isolated | 31/31 passed unchanged | 12.15s |
| Admin users, isolated | 12/12 passed unchanged | 7.29s |
| Calendar, isolated | 26/26 passed unchanged | 14.79s |
| Five files together, default workers | 114/114 passed unchanged | 44.79s |
| Five files together, serial | 114/114 passed unchanged | 68.32s |

Default grouped execution drove extraction/calendar file maxima to **4.65s / 4.57s**, close to the unchanged 5s limit. Serial grouping reduced their maxima to **2.50s / 2.77s**. Serial execution trades throughput for wall-clock headroom; it does not remove assertions or change budgets. The final default full command uses that policy and passes all 2,290 tests.

### Every reported application failure

All 23 cases passed in isolation, both grouped modes and the final full suite. Durations are milliseconds. Timeout cases are classified E/timing-sensitive; exact resource attribution remains [INFERENCE]. The old artifact does not identify an exact stalled await, so the boundary column inventories actual waits instead of pretending to localize an unobserved stall.

Group names identify these files:

- Bulk: `src/pages/BulkFlyerImportPage.test.tsx`.
- Extraction: `src/features/admin/components/AdminEventEditor.extraction.test.tsx`.
- Events: `src/features/admin/pages/AdminEventsPage.test.tsx`.
- Users: `src/features/admin/pages/AdminUsersPage.test.tsx`.
- Calendar: `src/features/calendar/Calendar.test.tsx`.

| Group / case | Old failure | Old ms | Isolated ms | Final full ms | Actual awaited boundary / synchronous work |
| --- | --- | ---: | ---: | ---: | --- |
| Bulk — publishes only flyers explicitly confirmed after review | 5s timeout | 7644 | 1795 | 1884 | Upload/analysis completion; review clicks; mocked publish summary. |
| Bulk — allows correcting extracted fields before saving admin drafts | Confirmed/Skipped assertion | 3532 | 1530 | 1406 | Confirmed assertion after upload/confirm; later edit, reconfirm and mocked save. |
| Bulk — keeps a flyer with no event type from blocking the rest of the batch | 5s timeout | 5030 | 1050 | 977 | Both analyses; confirmations; mocked publish summary. |
| Bulk — saves confirmed flyers while other flyers are still being read | 5s timeout | 8934 | 790 | 1038 | Publish while second extraction is deliberately pending; then resolve it. |
| Bulk — retries only a failed save without repeating a successful event | 5s timeout | 5291 | 1305 | 1289 | Analysis/review; resolved/rejected partial-save outcomes; summary and retry. |
| Bulk — opens the first ready flyer when the first upload fails analysis | 5s timeout | 111816 | 267 | 181 | Upload; rejected first extraction and resolved second; ready-title query. |
| Bulk — keeps validation errors readable when a rejected flyer has no preview | 5s timeout | 6327 | 113 | 138 | user.upload and validation UI; no upload API or extraction. |
| Extraction — fills location and address from the venue the admin explicitly chose | 5s timeout | 8350 | 1317 | 1253 | Common upload/analyze helper; existing venue choice; Apply. |
| Extraction — keeps the flyer's raw venue text while the match is still undecided | 5s timeout | 6289 | 674 | 642 | Common upload/analyze helper; Apply unresolved raw venue. |
| Extraction — keeps the flyer's raw venue text when the admin confirms the venue as new | 5s timeout | 115272 | 969 | 953 | Common upload/analyze helper; new venue choice; Apply. |
| Extraction — hands the reviewed entities and the admin's decisions to onSubmit | 5s timeout | 6210 | 1783 | 1622 | Analyze; entity decisions; Apply; resolved mocked submit. |
| Extraction — does not submit an entity review when the flyer produced none | 5s timeout | 7521 | 548 | 483 | Analyze; empty reconciled review; Apply; mocked submit. |
| Extraction — retrying analysis keeps decided and edited candidates and never re-adds the original | 5s timeout | 5567 | 2494 | 2185 | Analyze; candidate edit; resolved retry/reconciliation; Apply and submit. |
| Extraction — removing the flyer after analysis keeps decisions and drops the rest | 5s timeout | 5049 | 1524 | 1450 | Analyze; choose venue; resolved removal; manual fields and submit. |
| Extraction — reconciliation failure falls back to unresolved candidates and says so | Missing venue-group assertion | 3722 | 709 | 687 | Missing Venue: studio five group after rejected reconciliation; no intervening required service wait. |
| Extraction — keeps a clicked link when editing the event's venue text | 5s timeout | 5187 | 2583 | 2444 | Analyze; explicit venue choice; per-character field typing; submit. |
| Events — opens an empty form when Create Event is clicked | 5s timeout | 6442 | 755 | 744 | user.click Create; remaining assertions synchronous. |
| Events — uploads a flyer when creating an admin event and persists its URL | 5s timeout | 5891 | 825 | 848 | Click/type/upload; resolved upload/save; waitFor saved image URL. |
| Events — dismissing the Missing info chip clears the filter and restores hidden rows | 5s timeout | 120717 | 260 | 256 | user.click chip; remaining assertions synchronous. |
| Events — ?view=archived shows archived rows; default view does not | 5s timeout | 5549 | 104 | 113 | Entirely synchronous render/assertions. |
| Users — shows email invitation success without a temporary Organizer password | 5s timeout | 5383 | 668 | 1084 | Click/type/select/submit/Done; mock onSuccess is synchronous. |
| Calendar — keeps an expanded event reachable and restores focus after closing details | 5s timeout | 10463 | 2130 | 2287 | Synchronous list/expand/open/close; waitFor restored opener focus. |
| Calendar — resets expanded pages when dance-style filter or city changes | 5s timeout | 7170 | 2278 | 2267 | Entirely synchronous filter/city rerender and assertions. |

### Assertion decisions

1. **Confirmed versus Skipped:** confirmation validates and sets `reviewed:true`; only the distinct Skip action sets `state:skipped`. Editing should return Needs review. The original assertion is correct and retained. [INFERENCE] A preceding timed-out test's late global Skip click could affect the next render; no old per-await trace proves that click occurred.
2. **Missing unresolved venue group:** rejected entity reconciliation must retain extracted candidates as pending/unresolved and show their review groups, including Venue: studio five. It must not silently create/link entities or discard review. The original assertion is correct and retained. The old DOM contained a Social transition that this fallback test never performs; [INFERENCE] a preceding timed-out continuation could account for it.

Installed Vitest cancels its timeout wrapper, not the running async function; RTL cleanup unmounts trees but does not cancel user-event promises. This establishes a possible contamination mechanism, not its exact occurrence in the old failures. No speculative production or mock-isolation changes were bundled into this gate.

## Test infrastructure correction

`vite.config.ts` sets `fileParallelism:false`. Global/per-test timeouts, retries, assertions and application include patterns remain unchanged.

Exactly these additional subtrees are excluded:

- `.grok/skills/**`
- `.kiro/skills/**`
- `.vibe/skills/**`
- `.windsurf/skills/**`
- `data/skills/**`

Each contained caveman-explore/caveman-learn skill-package tests using Node's own `node:test` runner, not Salsa application suites. Existing exclusions were preserved; no blanket hidden-directory exclusion was introduced.

Real Vitest static discovery changed **234 → 224 files**, removing exactly those ten files and adding none. **All 218 src test files remained discoverable**, as did the other six application/script files. No legitimate application failure was hidden by exclusion.

## Quality gates

Initial audit commands were executed in this order, serially:

| Command | Observed result |
| --- | --- |
| `npm test -- --run src/features/shopify src/app/App.shopRoutes.test.tsx` | **7 files / 88 passed**, 0 failed; 19.07s reported duration. |
| `npm run build` | **PASS**: TypeScript and Vite production build completed. |
| `npm run lint` | **PASS**, zero lint warnings. |
| `npm test -- --run --reporter=json --outputFile=/tmp/salsa-phase25-full.json` | **224 files / 2,290 passed**, 0 failed, 0 skipped. All 23 old failed cases passed. |

The full JSON report spans approximately 480.95s from run start to the last completed file. The entire chained release command took 589.44s. Reporter/output flags did not filter the suite.

Build warnings retained, not suppressed:

- An entry chunk exceeds 500 kB: 677.20 kB minified. Shopify page chunks remain separately split: ShopPage 5.88 kB and ProductPage 7.42 kB minified.
- Sitemap generation received Supabase `PGRST205` / HTTP 404 for `public.public_events` and emitted stable routes without event URLs. Build still succeeds. This environment/schema mismatch is an additional deployment/SEO risk, not a Shopify/test-suite fix; no Supabase/RLS change was made.

## Live Shopify configuration and Headless publication

- The actual token was accepted using the browser-public `X-Shopify-Storefront-Access-Token` header; real catalog/cart operations succeeded. No token value was written into application source or documentation. Tool-response disclosure during the continuation is recorded below.
- HTTPS Storefront request returned **HTTP 200** and **X-Shopify-API-Version: 2026-10**, without GraphQL errors; the continuation reconfirmed this against the real store.
- The initial audit found `VITE_SHOPIFY_STORE_DOMAIN` containing an HTTPS scheme, which the client correctly rejects. The continuation changed both local environment files to the bare canonical hostname.
- The continuation's inherited process environment retained the old URL and took precedence over corrected files. Live smoke used an explicit canonical domain override; subsequent public probes and release commands unset only that stale domain export so Vite could load the corrected file value. Deployed GitHub build-secret values remain unverified.
- Three branded products appeared through this token's Storefront publication: **Unisex t-shirt ($14 starting), Unisex Hoodie ($40 starting), Embroidered Beanie ($18 starting)**, all USD. The t-shirt had a purchasable variant and a resolving image.

Authentication reference: [Shopify Storefront API](https://shopify.dev/docs/api/storefront).

## Live catalog and product detail

Against the real store, without response mocks:

- `/shop` loaded all three products, branded images, titles and prices; no credential/GraphQL alert appeared.
- `/shop/products/unisex-t-shirt` loaded title, description, six gallery choices, nine variant choices and price.
- Selecting Size 5XL changed price from **$14.00 to $20.00**. Switching thumbnails changed the image.
- Product quantity increased **1 → 2** and decreased **2 → 1**.
- The chosen product had **zero unavailable variants**. Sold-out selection could not be exercised there; existing mocked regression coverage remains green. Inventory was not changed to manufacture an unavailable state.
- A nonexistent real product handle displayed Product not found and a recovery link. Original invalid-configuration and empty-cart states were also exercised.

## Live cart lifecycle

Only normal shopper cart mutations were performed; no product, inventory, merchant setting or payment record was altered.

1. Add Size 5XL, quantity 1: native success feedback, correct product/variant and **$20.00**.
2. Cart ID persisted under the existing localStorage key. Its value and internal key were not logged.
3. Increase to quantity 2: Shopify-returned line/subtotal/estimated total became **$40.00**.
4. Decrease to quantity 1: returned totals became **$20.00**.
5. Refresh: same persisted cart restored Size 5XL, quantity 1 and **$20.00**.
6. Remove: empty-cart state appeared and checkout disappeared.
7. Re-add to the same existing cart: line-add succeeded without replacing the persisted ID.
8. Keyboard Space on Increase also updated the real quantity; the subsequent focus gap is reported below.
9. Final cleanup removed the smoke line and left the Shopify cart empty. Temporary tabs and local servers were closed.

Shopify remained authoritative for quantities/money. No local cart total was manually changed; no cart key was parsed or exposed.

## Checkout and merchant configuration

The native link used Shopify's returned HTTPS checkout URL without rewriting it. Clicking reached the merchant hostname, then **/password — Opening soon**, offering Enter using password. It did **not** reach an order summary with product, variant, quantity or price.

No password was entered, restriction bypassed, contact/shipping/payment form submitted, or order placed. Checkout item matching, production payments, shipping rates, taxes, branding and contact requirements could not be verified past this gate.

The public Storefront schema exposes no merchant subscription/active-plan field. An active plan permitting the intended flow is **unverified**, not assumed to be either a trial or a paid plan. No upgrade was attempted.

| Merchant item | Observed status |
| --- | --- |
| Contact/support information policy | Configured, nonempty body and URL. |
| Refund/return policy | Configured, nonempty body and URL. |
| Privacy policy | Configured, nonempty body and URL. |
| Shipping policy | **Missing**: Storefront returned null. |
| Terms of service | **Missing**: Storefront returned null. |
| Template placeholders | No INSERT/ADD/INCLUDE/LINK/YOUR bracket placeholder detected in the three present bodies; not legal approval. |
| Currency/country | USD / US. |
| Digital wallets | SHOPIFY_PAY, APPLE_PAY, GOOGLE_PAY returned; not proof of an operational production gateway. |
| Shipping destinations | 237 returned, including US; not proof of valid rates/taxes. |
| Public checkout | **Blocked by merchant password protection.** |
| Active selling plan | **Unverified; requires merchant Admin confirmation.** |

No legal text was authored or approved in this gate.

## Responsive and keyboard proof

Real catalog, product and populated cart were inspected in Chromium at **375, 768 and 1440 pixels**.

| Width | Catalog columns | Document overflow | Purchase control | Cart drawer | Checkout CTA |
| ---: | ---: | --- | --- | --- | --- |
| 375 | 1 | None observed | 44px high; center exposed | 375px; no horizontal overflow | 44px high, within viewport |
| 768 | 2 | None observed | 44px high; center exposed | 480px; no horizontal overflow | 44px high, within viewport |
| 1440 | 3 | None observed | 44px high; center exposed | 480px; no horizontal overflow | 44px high, within viewport |

Radix dialog labels/descriptions were present. Opening focused Close cart; Escape returned focus to the opener at all three widths. Tab reached the product link and Increase; Space completed a real mutation. **After that mutation focus moved to the dialog container**: repeated keyboard edits require reacquiring the control. This pre-existing gap remains; keyboard continuity is not fully passing.

These are emulated viewports and Chromium keyboard/pointer interactions, not physical-device or Safari proof. Product default selection after refresh can differ from the retained cart variant; the cart correctly restored Size 5XL independently.

## Impeccable review

Followed the installed audit playbook on the release surface. Ran the bundled detector on ShopPage, ProductPage, CartDrawer and their three stylesheets with existing DESIGN.md enabled. **Zero primary findings; two font-ramp advisories**, at `shop.css:44` and `cart/cart.css:30`. They are source advisories, not automatic proof of bad visual design; both are display-role typography and need intentional ramp documentation rather than a new theme.

### Implementation integrity verdict

**Coherent product-specific implementation: PASS, with scoped polish gaps.** Ritmo Vivo typography/colors and native public layout remain, real branded merchandise is used, and price/availability/cart/checkout stay Shopify-owned. No generic ecommerce theme or Phase 3 relationship model was introduced.

| Dimension | Score / 4 | Verified finding |
| --- | ---: | --- |
| Accessibility | 2 | Dialog semantics and Escape restoration work; quantity updates lose initiating keyboard focus. |
| Performance | 3 | Lazy shop/product chunks remain small; large entry warning remains. No responsiveness benchmark claimed. |
| Responsive design | 3 | Requested widths usable without observed overflow; Back to shop remains 36px high. |
| Theming | 3 | Existing tokens/fonts mostly reused; hard-coded scrim and product-state heading selector drift remain. |
| Implementation integrity | 3 | Authoritative commerce flow; no detector primary findings, two type-ramp advisories. |
| **Total** | **14/20 — Good** | **Scoped audit, not complete WCAG certification.** |

Measured cart contrast: heading/body approximately **13.30:1**, muted text **10.09:1**, minimum white checkout-text contrast across gradient endpoints **4.70:1**. Reduced-motion emulation, verified with matchMedia and direct Puppeteer override, removed catalog lift and image zoom. The generic browser-helper media override did not take effect and was reported as a tool issue, not mistaken for an app defect.

### Remaining surface findings

- **P1 — quantity-update focus continuity**, `src/features/shopify/cart/CartDrawer.tsx:59-63`. Disabling the initiating control moves focus to the dialog, where it remains after response. Impact: repeated keyboard edits lose task position. Recommend guarded aria-disabled/focus preservation, with an explicit next focus destination after removal. Suggested command: `$impeccable harden`.
- **P2 — small breadcrumb target**, `src/features/shopify/pages/ProductPage.tsx:169-170`. Back to shop measured **36px**, below the project's 44px mobile target; this is not a claim that 36px violates WCAG's 24px minimum. Increase the hit area without redesigning the link. Suggested command: `$impeccable adapt`.
- **P2 — product-state heading drift**, `src/features/shopify/shop.css:117-122` and `src/features/shopify/pages/ProductPage.tsx:174-194`. Shared display styling targets h2, while product states use h1. Live Product not found computed Be Vietnam Pro instead of Epilogue. Impact: states leave the display hierarchy. Suggested command: `$impeccable typeset`.
- **P3 — scrim token ownership**, `src/features/shopify/cart/cart.css:5`. Approved navy is embedded directly rather than owned by a named token. No measured readability failure. Suggested command: `$impeccable polish` after higher priorities.

These are existing issues, not new regressions from the Vitest-only implementation change. Audit instructions require documenting rather than silently redesigning/fixing unrelated UI. Preserve native branding, real imagery, honest totals/final shipping-tax wording, explicit feedback, visible purchase/checkout controls, labeled options, cart restore and recoverable missing-product/empty/configuration states.

Recommended order: `$impeccable harden`, `$impeccable adapt`, `$impeccable typeset`, then `$impeccable polish`. Re-run `$impeccable audit` after approved fixes. Recommendations are not claims that these fixes were applied.

## Continuation verification

No application or test behavior was changed. Each formerly failing file was run independently, then all five together under the existing serial configuration. All **114 tests passed** in both modes; the maximum grouped test duration was **2,858ms**, below the unchanged 5s budget. All 23 archived cases were matched by name to passing results; this does not prove the exact cause of the old failures.

| File group | Tests passed independently / grouped | Independent command duration |
| --- | --- | ---: |
| Bulk import | 14 / 14 | 11.51s |
| Extraction/entity review | 31 / 31 | 27.57s |
| Admin events | 31 / 31 | 11.26s |
| Calendar | 26 / 26 | 14.27s |
| Admin users | 12 / 12 | 6.94s |

Fresh static discovery returned **224 files**, zero affected skill-suite files, and retained all five application files. No timeout increase, assertion rewrite, new exclusion or speculative production fix was applied.

The real t-shirt smoke selected **Size 3XL**, changing price **$14.00 → $17.00**. Keyboard Enter switched gallery image 2. Product quantity changed **1 → 2 → 1**. The first add created a cart; adding again used the existing cart and returned quantity 2 / **$34.00**. Increasing to 3 returned **$51.00**, decreasing to 2 returned **$34.00**, and refresh restored Size 3XL / quantity 2 / **$34.00**. Removal returned zero items, the native empty state and no checkout link. Only the existing cart-ID storage key was present; no cart key was parsed or logged. The smoke cart was left empty and the temporary tab/server were closed.

At **375, 768 and 1440px**, the catalog's first product was inside the initial viewport, product images resolved, document/drawer overflow was absent, and purchase/checkout controls were 44px high and unobstructed. Escape restored opener focus; Shift+Tab/Tab wrapped between checkout and Close. Background purchase/cart controls were aria-hidden while the dialog was open.

Fresh axe-core 4.13.0 audits found **zero violations** on catalog, product and populated cart, with **1 / 2 / 3 incomplete checks** respectively. These results do not certify complete WCAG compliance or negate the previously documented quantity-update keyboard-focus gap.

The native Shopify checkout link again reached **HTTPS /password — Opening soon**, not an order summary. No password, customer details or payment data were entered and no order was placed. Public merchant queries confirmed USD / US, 237 shipping destinations including US, accepted card-brand metadata, present refund/privacy/contact-information policies, and absent shipping policy/terms. Contact information contained an email and no detected bracket template placeholder; this is not legal approval or proof of a working payment gateway.

### Final serialized release gates

The focused tests, build, lint and full suite ran sequentially, not concurrently.
Each command used `env -u VITE_SHOPIFY_STORE_DOMAIN` so Vite read the corrected
local hostname instead of the stale inherited URL. No token was changed.

| Gate | Final observed result |
| --- | --- |
| `npm test -- --run src/features/shopify src/app/App.shopRoutes.test.tsx` | **PASS: 7 files / 88 tests**, 17.63s. |
| `npm run build` | **PASS:** TypeScript, Vite and postbuild completed; Vite build 12.43s. |
| `npm run lint` | **PASS:** ESLint completed with the existing zero-warning limit. |
| `npm test -- --run --reporter=json --outputFile=/tmp/salsa-phase25-current-full.json` | **PASS: 224 files / 2,290 tests; zero failed, pending or todo tests.** JSON-recorded elapsed time 492.43s. |

All **23 archived failure names** matched exactly one passing assertion in the
final full-suite report. The slowest of these assertions took **2,268ms**.
Together with the independent/grouped reproduction above, this provides
passing evidence without weakening assertions or increasing deadlines; the
precise causes of the historical failures remain unproven.

The full-suite file count matches static discovery: **218 `src/` files plus six
root/script suites**. No affected skill suite was discovered. No new application
regression tests were added because no production defect was established.

Non-blocking output remains: the existing >500kB generated-chunk warning,
postbuild omission of event sitemap URLs because `public.public_events` is
absent from the configured endpoint's schema cache, and jsdom navigation/
`scrollTo` notices. None caused a failed quality gate.

### Final scoped Impeccable detector

The installed detector was run against the shop/product pages, their styles,
and the cart drawer/styles. It returned **two advisory findings only**:
`shop.css:44` uses a `3.5rem` fluid endpoint and `cart/cart.css:30` uses
`1.75rem`, both outside the documented type ramp. No redesign or unrelated
surface changes were made. The live viewport, keyboard and axe evidence above
completes the scoped review; automated results do not clear the existing
quantity-update focus risk.

### Credential handling incident

An anchored search for the non-secret domain line unexpectedly returned neighboring credential lines; the surgical domain-only edit response also echoed the complete environment files. Both tool behaviors were reported. This exposed the private **`LINER_API_KEY`** in tool output: **rotate it and do not reuse the exposed value**. The public Storefront token and Supabase publishable key also appeared; they are browser-public keys, not Admin/private Storefront credentials.

No credential value was copied into application source, this report or README, and no commit was made. `git check-ignore -v -- .env .env.local` confirmed both files remain ignored. The original no-disclosure acceptance criterion is **not satisfied** by this continuation; this incident is not hidden behind a PASS.

## Acceptance criteria

| Criterion | Status / evidence |
| --- | --- |
| Every old failure classified | PASS: 21 timing-sensitive timeouts and two correct assertions; per-case table above. |
| Genuine production regressions fixed with tests | No production defect demonstrated among reported failures; no speculative fix/test invented. |
| Foreign skill discovery removed | PASS: ten files removed, all src discovery retained. |
| Focused Shopify suite | PASS: 88/88. |
| Build | PASS; warnings listed, not hidden. |
| Lint | PASS, zero warnings. |
| Full suite accurately reported | PASS: 2,290/2,290 across 224 files, no failures/skips. |
| Public token works | PASS: accepted public header, real catalog/cart calls. |
| Storefront 2026-10 works | PASS: response version header confirmed. |
| Published product accessible | PASS: three branded products; t-shirt purchasable. |
| Real shop/product detail | PASS with corrected local files and stale inherited export cleared/overridden for verification; deployed build secrets remain unverified. |
| Create/add/update/remove cart | PASS: real native lifecycle/empty state. |
| Cart persists through refresh | PASS: same ID, correct variant/quantity/price. |
| Checkout reaches real order summary | **FAIL/BLOCKED: password page, not checkout.** |
| No production purchase | PASS: no order/contact/shipping/payment submission. |
| No credentials printed/committed by this work | **FAIL for tool-output disclosure:** private LINER key rotation required. No credentials added to source/docs or committed; local environment files remain ignored. |
| No Phase 3 schema/code | PASS: no app-source or Supabase edits. |
| Merchant blockers explicitly listed | PASS: password gate, missing policies, unverified plan/payment/shipping/tax eligibility, stale exports/deployed secret values and private-key rotation. |
| Representative Phase 2 surfaces usable | PASS for observed layout/CTA behavior; keyboard continuity remains a P1 risk. |
| Impeccable after fixes | COMPLETE: detector and visual/layout/keyboard/contrast/state/motion evidence above. |

## Remaining launch blockers and next actions

1. Local domain files are corrected. Clear/update stale `VITE_SHOPIFY_STORE_DOMAIN` shell exports and verify the **bare canonical myshopify.com hostname** in build secrets. Deployed secret values were not inspected. Rebuild/redeploy: these are Vite build-time values.
2. Merchant must permit legitimate checkout and resolve password protection through normal Shopify configuration. Repeat native checkout smoke afterward; do not add a bypass.
3. Merchant must confirm an active plan supporting this flow, production payments, shipping rates, taxes, branding and contact requirements. Public API wallet/destination data is insufficient.
4. Publish approved shipping policy and appropriate terms; review existing refund/privacy/contact policies. This report provides no legal approval.
5. Resolve/evaluate the P1 keyboard-focus gap before public launch; do not claim full accessibility clearance while it remains.
6. Review the sitemap environment/schema mismatch separately; no Supabase security change belongs in this gate.
7. Rotate the private `LINER_API_KEY` exposed by unexpected tool output. Do not paste its replacement into source, docs or chat.

No commerce_entity_links, Shopify/event mappings, organizer/instructor/venue/city merchandise relationships, marketplace sellers, Stripe Connect, subscription/digital-product implementation, payouts or Supabase commerce RLS were added. No Phase 3 work started.

**PHASE 3: NO-GO — tests are stabilized and local domain files are corrected, but public Shopify checkout remains blocked. Missing merchant policies, unverified selling eligibility, the existing keyboard-focus risk and private-key rotation remain release prerequisites.**
