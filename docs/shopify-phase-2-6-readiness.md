# Shopify Phase 2.6 — launch blocker remediation

Phase 2.6 only. Phase 3 has not started. This report supersedes the password-gate and cart-focus findings in the Phase 2.5 report; it does not supersede unverified merchant settings.

## Launch gate

| Original blocker | Status | Evidence / remaining prerequisite |
| --- | --- | --- |
| Public checkout/password | RESOLVED | Fresh public Shopify root and actual headless checkout no longer redirect to `/password`. No password setting was changed by this remediation. |
| Merchant configuration | BLOCKED | Shopify Admin redirects to account sign-in. Plan, production gateway, shipping configuration, fulfillment and merchant tax review remain unverified. |
| Shipping policy and terms | MANUAL REVIEW | Both are absent from Storefront policy metadata. Draft/workflow below requires merchant approval and publication. |
| Cart keyboard focus | RESOLVED | Local action-intent focus continuity; nine new regressions and live keyboard success, failure and removal checks. |
| Compromised LINER key | BLOCKED | Replacement works through the recovered local Salsa Edge Function (HTTP 200). Runtime credential matches local configuration. Provider revocation remains unproven; no remote production deployment was verified. |

**Phase 3: NO-GO** until credential revocation/replacement, merchant readiness verification and approved policy publication are complete.

## Credential incident — first action track

The key belongs to **LINER API Platform**, not Shopify. The server consumer is `supabase/functions/liner-search/index.ts`; the browser calls that Edge Function and must never receive the key. `scripts/liner-search-example.mjs` also consumes the environment key.

### Credential update recheck

After the owner reported the update, a fresh process loaded local configuration without the inherited `LINER_API_KEY` override. The local key differs from the inherited process key.

- Updated local credential: read-only balance authentication **HTTP 200**; one-result web search **HTTP 200**, with a valid titled result and HTTP(S) URL.
- Distinct inherited process credential: balance authentication **HTTP 200**. This proves that credential is still accepted, not that the originally exposed key has been revoked. No old credential was recovered from chat or logs.
- Initial configured Supabase invocation returned **HTTP 503**. Subsequent diagnosis found the frontend pointed at sibling Bellocampo's gateway on `54321`, while Salsa's own gateway is `54331`; both Edge Runtime containers were stopped. This was a local target/runtime failure, not evidence of a LINER provider authentication failure.
- No credential values, provider balance data, headers or private result payloads were printed. The replacement was not copied into source or documentation.

### Local runtime recovery — verified

The owner selected **Use Salsa on 54331**, acknowledging that this changes the local auth/database target as well as the function target.

- Corrected ignored `.env` and `.env.local` to Salsa's `http://127.0.0.1:54331` and its CLI-generated public publishable key. Existing LINER values and unrelated configuration were preserved.
- Started `SalsaLinerRuntime` with `env -u LINER_API_KEY npx --no-install supabase functions serve --env-file .env`. This serves the existing Salsa functions, preserves gateway JWT policy and avoids the stale inherited LINER override. The service is left running persistently for local use.
- Private container inspection confirms `supabase_edge_runtime_Salsa` is running and its LINER credential matches the current local file configuration.
- Actual `supabase-js` invocation of `liner-search` against the corrected configured endpoint returned **HTTP 200**, one valid titled result and HTTP(S) URL. No mock/provider substitute was used.
- Bellocampo's containers, database and function deployment were not changed. No whole-stack restart, migration, reset or provider revocation was performed.
- Stale credential inheritance was found in coding-assistant/tool processes, not a running Salsa search service. Those sessions were not killed; the current Eval process no longer inherits the key, and new verification/service commands explicitly avoid stale overrides.

Remaining owner actions:

1. In [LINER API Keys](https://platform.liner.com/keys), verify the exposed key is revoked/deleted. Privately confirm its authentication is rejected. Investigate the still-valid inherited credential and revoke it if obsolete or exposed.
2. Restart the coding-assistant/tool broker and affected sessions from a shell with the intended environment (or without a LINER override). The running Salsa runtime already uses the replacement; restarting it cannot revoke a provider key.
3. If there is a separate remote production Supabase project, update its function secret and verify that deployment separately. The endpoint diagnosed and recovered here was local, not a hosted production deployment.

The original pre-update check returned HTTP 200, and no search was performed with that compromised credential during the initial remediation. Replacement-dependent local functionality is now verified; provider revocation and any separate remote deployment remain unverified.

Initial pre-update safe scans found zero exact then-configured-key matches in 1,200 tracked files and 5,053 Git blob objects reachable from local refs/reflogs. The tracked-file scan also found zero suspected private credential-pattern files. These scans were not repeated against the replacement and do not cover chat/tool logs, remote forks or unreachable Git objects. The key was not found as a GitHub Actions secret; the deployed Supabase secret cannot be inventoried without authorized project access. No `.env` contents or credential values were printed.

Provider source: [LINER quick start](https://liner.com/developers/docs/quick-start).

## Cart accessibility remediation

`CartDrawer.tsx` records the focused initiating action and line/variant identity before a mutation. While native controls are disabled, focus moves to that item's named quantity group. When Shopify's authoritative response settles:

- Increase/decrease returns to the initiating enabled action.
- Decreasing to one moves to Increase instead of the now-disabled Decrease.
- Replacement line IDs are matched by an unambiguous variant identity.
- Removal prefers a following surviving line, then a preceding line.
- Last removal focuses Browse the shop, with Close as the fallback.
- Failed mutations return to the original enabled action without inventing new quantities.
- Moving focus deliberately during a request cancels restoration; closing with Escape leaves opener restoration to Radix.

No provider API changes, focus timeouts, production document queries or CSS redesign. Existing native disabled-state behavior and checkout locking remain intact.

Nine new `user-event` regressions cover increased/decreased authoritative quantities, replaced line IDs, minimum quantity, next/previous removal, empty-cart removal, failure, deliberate focus movement and Escape while pending. The expanded drawer suite failed before the fix and passed after it: 15 tests, 4.78 seconds on the initial green run.

## Public checkout proof

Actual Storefront API version served: `2026-10`. The canonical public store domain is `352i3w-bq.myshopify.com`.

- T-shirt: Size 3XL, quantity 1, $17.00 USD subtotal; Shopify checkout showed the matching product/variant and $0.68 estimated tax, total $17.68 before shipping.
- Beanie: Color Black, quantity 1, $18.00 USD; actual cart-to-checkout transitions succeeded at 375, 768 and 1440 CSS pixels.
- Shipping displayed **Enter shipping address**. No address/customer/payment information was entered; no order or purchase was submitted.
- Checkout has an email contact field and delivery telephone field. Branding observed: **SalsaSegura** text header; no custom merchant logo observed. Merchant intent for contact requirements and branding remains unverified.
- Payment UI exposed card and accelerated-payment choices. No visible test-mode notice was observed. This does **not** prove live gateway activation or real-order eligibility.
- Refund and privacy links were visible in checkout. Storefront metadata contains refund, privacy and contact-information bodies; their public policy URLs return HTTPS 200 without the password gate. The contact page has a policy section, Contact information heading and merchant identity. Content accuracy requires merchant review.
- Shipping policy and terms are absent. Do not create headless links to missing or fabricated policies.

Public access changed externally between Phase 2.5 and this verification. No protection was bypassed, and no merchant setting was changed. If private access returns, use Shopify's [official public/private store workflow](https://help.shopify.com/en/manual/online-store/themes/password-page); do not bypass it or purchase a plan without owner approval.

## Merchant readiness — MANUAL ACTION REQUIRED

Use the authenticated Shopify Admin for this store. Public metadata is only corroboration, not configuration evidence.

| Area | Required owner verification | Public evidence / limit |
| --- | --- | --- |
| Plan | **Settings → Plan**: record current plan, trial status and real-order checkout eligibility. Confirm Headless channel support for the intended use. If an upgrade is necessary, identify the lowest suitable plan and obtain approval before purchase. | Actual checkout is reachable. Current plan is unknown; no specific paid plan is recommended without that evidence. |
| Payments | **Settings → Payments**: activation/verification complete, intended provider enabled for USD, test mode off, merchant payout readiness confirmed privately. | Card metadata and payment UI are present; neither proves live status. No financial configuration changed. |
| Origin/fulfillment | **Settings → Locations** and **Shipping and delivery**: active origin location, inventory allocation, fulfillment owner/service and shipping profiles for all three products. | Physical shippable products are available. Origin and fulfillment arrangement unknown. |
| Zones/rates | **Shipping and delivery**: intended US zone and market, active rates for representative carts/weights, correct profile assignment, unsupported destinations excluded. | Metadata lists 237 destinations including the US. This is not proof that any destination has a rate. No address-based rate quote was requested. |
| Taxes | **Settings → Taxes and duties**: merchant reviews registrations, collection regions, product tax categories, inclusion/exclusion and duties treatment. Obtain qualified advice where needed. | $0.68 estimated checkout tax observed on the $17 tee. No legal determination or registration verification claimed. |
| Contact | **Settings → Checkout**: approve email/phone contact choices and shipping-phone requirement; confirm reachable customer-support information in policies/store details. | Email contact and delivery telephone inputs observed. Required/optional merchant intent not verified. |
| Branding | **Settings → Checkout → Customize**: approve merchant name/logo, contrast and mobile rendering. | SalsaSegura text header observed; no custom logo observed. Headless Ritmo Vivo UI remains unchanged. |

## Shipping policy — draft for merchant review, NOT published

The following intentionally contains unresolved merchant-review fields. **Do not publish until every bracketed field is replaced with verified operational facts.** API destination availability must not be presented as a shipping promise.

### SalsaSegura shipping policy

SalsaSegura sells physical merchandise through Shopify checkout. Item prices and currency are shown before checkout; delivery charges and applicable tax amounts are determined by Shopify for the order.

**Where we ship:** [MERCHANT REVIEW: list supported countries/regions after verifying active markets, shipping zones and rates; confirm whether US-only at launch and any exclusions.]

**Order processing:** [MERCHANT REVIEW: confirm fulfillment provider, origin location, actual processing window, business-day definition, cut-off times and any made-to-order/preorder arrangements. No dispatch date is promised in this draft.]

**Shipping methods and charges:** [MERCHANT REVIEW: list actual services and how charges are calculated; verify all product shipping profiles and mixed-product carts. State free-shipping thresholds only if configured and verified.]

**Delivery estimates:** [MERCHANT REVIEW: approved service-specific estimates and delay handling. Distinguish processing from transit; do not guarantee delivery dates without an operational basis.]

**Tracking:** [MERCHANT REVIEW: confirm whether tracking is provided, when customers receive it and where they can obtain support.]

**International orders:** [MERCHANT REVIEW: either state international shipping is unavailable or confirm eligible destinations and responsibility for duties/import charges using verified Shopify settings.]

**Address changes, lost/damaged packages and delivery issues:** [MERCHANT REVIEW: approved procedures, reporting window and actual carrier/fulfillment responsibilities. Align with the published refund policy.]

**Contact:** [MERCHANT REVIEW: confirmed customer-support email/contact channel and response expectations.]

Publication: authenticated **Settings → Policies → Written policies → Shipping policy**; merchant reviews complete text before **Save**. Verify the public policy URL and checkout footer afterward.

## Terms of service — official template workflow, MANUAL REVIEW

No generated terms were retrieved: the authenticated Admin/template interface was unavailable. Do not replace Shopify's actual template with invented legal boilerplate or claim the workflow was executed.

1. Merchant opens **Settings → Policies → Written policies → Terms of service**.
2. Select **Insert template** in the English checkout workflow.
3. Review/edit the generated text for the actual legal merchant identity, business address/contact, products, order acceptance, payment/currency, fulfillment, returns, cancellations, applicable consumer rights and jurisdiction. Align all referenced shipping/refund/privacy pages. Remove every template instruction/placeholder; seek qualified review where appropriate.
4. Merchant approves and selects **Save** to publish. No legal compliance conclusion is provided here.
5. Verify `/policies/terms-of-service`, `/policies/shipping-policy`, existing refund/privacy/contact URLs and the corresponding Shopify checkout footer links. Review their wording as well as presence.

Official source: [Shopify — Adding store policies](https://help.shopify.com/en/manual/checkout-settings/refund-privacy-tos). Shopify documents that policies require merchant review and are automatically linked in checkout after publication.

## Live/accessibility/design verification

- Native Chromium: keyboard catalog/product activation, gallery selection, real add, increase, decrease, minimum quantity, mutation failure, removal to a survivor, last removal and Escape/opener restoration exercised. Smoke cart left empty.
- Failure injection aborted one cart quantity request; original quantity remained one, a retry alert appeared and focus returned to Increase.
- Catalog, product, cart and actual checkout transitions: 375, 768 and 1440 CSS pixels; no horizontal page overflow; drawer fits viewport. Screenshots confirm the existing navy/rose/gold UI and visible checkout CTA.
- Axe 4.13.0: catalog 0 violations / 1 incomplete; product 0 / 2 incomplete; populated failure-state cart 0 / 3 incomplete. Automated axe results are not complete accessibility certification.
- Installed Impeccable context and cart detector ran; detector returned `[]`. No redesign or unrelated style changes.

Automated gate results are recorded after the serial verification run below. User-installed `@shopify/storefront-api-client@2.0.0` and dependency/lockfile changes were preserved; the existing Vite storefront was not converted to Hydrogen.

## Serial automated gates

The initial Phase 2.6 verification commands below unset the stale inherited `VITE_SHOPIFY_STORE_DOMAIN` so Vite reads the corrected local configuration. No Shopify token was changed. The later owner-approved local Supabase client configuration correction is recorded separately below.

| Command | Result | Duration |
| --- | --- | --- |
| `npm test -- --run src/features/shopify src/app/App.shopRoutes.test.tsx` | PASS — 7 files, 97 tests | Vitest 21.01s; wall 21.89s |
| `npm run build` | PASS — TypeScript, Vite and postbuild | Vite 14.70s; wall 42.24s |
| `npm run lint` | PASS — zero warnings | Wall 42.89s |
| `npm test -- --run --reporter=json --outputFile=/tmp/salsa-phase26-full.json` | PASS — 224 files, 2,299 tests; zero failed/pending/todo | JSON elapsed 507.16s; wall 507.94s |

The first build exposed focus-event target typing and the missing `ButtonLink` anchor-ref prop. Both were corrected before the successful focused/build/lint sequence. `ButtonLink` now declares the React 19 anchor ref that its existing prop spread already forwards; existing internal/external link behavior is unchanged.

Initial build warnings were reported, not hidden: the entry chunk was 677.60 kB minified; sitemap generation omitted event URLs because the then-configured Supabase endpoint returned `PGRST205`/404 for `public.public_events`. The later recovery rebuild still reports the chunk-size warning but no longer reports that sitemap error.

After the type corrections and all serial gates, the production build was served with `npm run preview`. Native keyboard add/increase returned the real beanie quantity 2 / $36.00 and focused Increase. Last removal focused Browse the shop; Escape focused the zero-item cart opener. The production smoke cart was left empty, the tab closed and the preview service stopped.

Initial changed deliverables: `src/features/shopify/cart/CartDrawer.tsx`, `src/features/shopify/cart/CartDrawer.test.tsx`, `src/components/ui/ButtonLink.tsx`, `README.md`, and this report. The subsequent owner-approved local recovery also updated ignored `.env`/`.env.local` Supabase URL/public-key configuration and regenerated `dist/`. No LINER credential value, merchant setting, policy publication, dependency or lockfile was changed by the assistant.

## Local LINER recovery verification

- `env -u LINER_API_KEY -u VITE_SHOPIFY_STORE_DOMAIN npm run build`: **PASS**, Vite 14.51s, wall 45.53s. TypeScript, Vite and sitemap postbuild completed against Salsa's corrected backend.
- Rebuilt-asset scan: **232 files**, zero exact current private LINER-key matches; the corrected `54331` URL is present and the obsolete `54321` URL is absent.
- Native Chromium production-preview `/calendar` smoke: application main mounted, actual Supabase requests used **54331**, none used **54321**. Browser and temporary preview service were closed.
- Real `supabase-js` `liner-search` invocation: **HTTP 200**, valid result; private runtime inspection confirms the replacement is loaded.
- `SalsaLinerRuntime` remains running persistently. Restart command: `env -u LINER_API_KEY npx --no-install supabase functions serve --env-file .env`, from `/home/r8s/code/Salsa`; stop the existing serving process before starting another.
- No application source changed during this recovery, so no additional test suite or lint run is claimed. The full-suite results above belong to the preceding code verification.

## Commerce acceptance pass and merge readiness

Code changes in this pass: `CartProvider.tsx` and `ProductPage.tsx` accept warning-only Shopify cart responses (valid cart, no user errors) with a curated notice; user errors still fail. `Header.tsx`/`Header.css` use a `div` banner that becomes a dialog only while the mobile menu is open, and wrap at enlarged text. Tests added for sold-out/no-variant products, warning-only add/update, user-error-plus-warning, awaited terminal states and the late-product race.

| Command | Result |
| --- | --- |
| `npm test -- --run src/features/shopify src/app/App.shopRoutes.test.tsx src/components/layout/Header.test.tsx` | PASS — 8 files, 129 tests |
| `npm run build` | PASS; chunk-size and `PGRST205` sitemap warnings remain |
| `npm run lint` | PASS — zero warnings |
| `npm test -- --run` (JSON reporter) | PASS — 224 files, 2,303 tests, 508.05s; run before a final one-test fixture edit, after which `CartProvider.test.tsx` (9 tests) and lint were re-run and passed |

Live checks (real Shopify, dev and compiled builds): keyboard variant/add/quantity/remove, warning notice with checkout retained, last-removal and Escape focus, 375/768/1440 px and 200% text without overflow, axe 0 violations on shop, product and open mobile menu. Shopify HTTPS checkout showed Size 3XL, $51.00 subtotal, $53.04 estimated total; no order was submitted and the smoke cart was emptied.

**Merge readiness: READY for the code change set.** No commerce-related test, build or lint failure remains. Advisory Impeccable type-ramp notes (cart, shop, header CSS) were left unchanged.

**Merchant launch blockers (not code, not resolved by merging):**

1. Shopify Admin: plan, live payments, shipping rates/origin and tax review unverified (Admin requires sign-in).
2. Shipping policy and terms of service unpublished (draft workflow above requires merchant approval).
3. LINER key revocation unverified; unrelated to Shopify but gates Phase 3.

## Retail Edit production cutover

The owner selected **Retail Edit** as the production storefront. `/shop` and
product deep links now ship the selected catalog, option buttons, purchase
panel and cart styling without development-only query flags. Drop Grid,
preview switching, preview URL helpers and the incumbent catalog markup/styles
were removed. Shopify API operations, credentials and merchant settings were
not changed.

Local verification initially reproduced shop-unavailable: the browser received
an inherited URL-form domain while `.env` and `.env.local` already contained
the canonical bare domain. Verification launches/builds cleared inherited
Shopify overrides with `env -u`; strict domain validation remains unchanged.
README documents that local-only command and warns against clearing intended
CI secrets.

- Focused tests: **7 files / 101 passed**. Named option selection,
  sold-out combinations, product races, cart warnings/errors, quantities,
  persistence and public routes are covered. No full-suite run is claimed.
- Final TypeScript/Vite build and scoped ESLint: **PASS**. Existing 679.16 kB
  entry-chunk warning remains; it was not suppressed.
- Real Storefront desktop/mobile smoke: three merchandise products, size M /
  quantity 2 / $28 cart, keyboard quantity 3 / $42, focus continuity,
  mobile persistence after reload, and active-line removal.
- Actual Shopify mobile checkout loaded with the matching $42 order summary
  and contact/delivery/payment controls. No address, customer/payment data or
  order was submitted.
- Compiled production preview: desktop 1440×1000 and mobile 390×844 catalog
  and populated/empty cart inspected; no horizontal overflow. Mobile
  reduced-motion navigation focused the product heading, added a real $18
  beanie and retained HTTPS checkout. Both compiled smoke lines were removed.
  No page JavaScript errors were observed.
- The single correction batch moved the confirmed-add flight below the
  drawer: live clone layer 1199 versus drawer 1201, leaving checkout controls
  unobstructed even when opened immediately. Detector's sole advisory
  base-cart font size was snapped to the documented 1.5rem step.
- README, DESIGN.md and the shop surface brief now describe production
  ownership. Merchant Shopify CDN photography remains the asset source.
  Temporary verification tabs and servers were closed.

**Code cutover verified; not deployed.** This does not clear the merchant
plan, live-payment, shipping/origin/rate, tax or policy-publication gates above.
The unrelated LINER revocation gate is also unchanged.

## Storefront editorial refinement — 2026-10-05

This visual update does not change the launch gate, merchant settings, Storefront
operations, cart calculations, product routes, or checkout ownership.

- `RetailCatalog.tsx` and `retail-catalog.css`: product-photo hero, self-hosted
  Barlow Condensed type, gold collection CTA, whole-product media, responsive
  collection, checkout guidance and calendar CTA. Product prices and links
  remain Shopify-authoritative. Existing loading, error, empty and unavailable
  states remain in `ShopPage.tsx`.
- `useCatalogMotion.ts`: scoped GSAP intro and heading reveals with one Lenis
  instance while the catalog is mounted. Locomotive Scroll was rejected because
  Lenis is already used by the site. No Three.js/WebGL was added.
- Headings expose unsplit accessible names; decorative words are hidden from
  assistive technology. Touch scrolling remains native, dialogs are excluded
  from smooth scrolling, and reduced-motion changes revert animation state.
- Motion teardown removes ticker callbacks, frame work, listeners and
  ScrollTriggers. Runtime instrumentation exposed Lenis 1.3.26's delayed
  native-scroll reset re-adding root classes after `destroy()`. Calling public
  `stop()` before `destroy()` fixes that behavior without private API access.
  Navigation then left no Lenis classes and zero catalog ScrollTriggers.
- `index.html`: a static `noscript` shop message links to the documented public
  Shopify merchant storefront. This is a browsing fallback, not server-rendered
  catalog data or a claim that headless checkout works without JavaScript.
- Assets: all product photos remain merchant-supplied Shopify CDN imagery.
  Solar icons by [480 Design](https://icon-sets.iconify.design/solar/) are locally
  bundled through Iconify and visibly credited under
  [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). No generated people,
  testimonials, partnerships, stock photos or shipping promises were added.

Verification:

- Production build and sitemap generation passed using
  `env -u VITE_SHOPIFY_STORE_DOMAIN npm run build`. The build still warns about
  a 683.46 kB minified app chunk; no bundle-size warning was hidden.
- Targeted ESLint passed for the catalog, motion hook and two updated page-test
  files. No full-repository lint or full test-suite result is claimed.
- Focused unchanged customer-behavior assertions passed: four suites,
  **51 tests** (`ShopPages`, `StorefrontUX`, `CartDrawer`, `CartProvider`).
  The page suites mock only the browser motion hook because jsdom lacks
  `matchMedia` and real layout; motion was exercised in Chromium instead.
- Real merchant collection rendered at 1440×1000 and 390×844; 320px and 768px
  checks found no horizontal overflow. Coarse-pointer touch taps opened and
  closed the cart. Keyboard collection navigation focused its heading;
  controls had visible 3px focus outlines and Escape restored the cart opener.
- Live Storefront smoke selected size M, added one $14 t-shirt, showed the
  matching drawer and HTTPS checkout link, then removed the test line. No
  checkout submission, customer information, payment or order was created.
- Compiled production `/shop` and direct-refresh `/shop/products/unisex-t-shirt`
  rendered with correct canonical metadata. Product navigation focused
  `product-heading` and removed catalog root classes after the transition.
- Reduced-motion preference changes removed Lenis and restored all heading
  transforms/opacity. Blocking Shopify images retained four named missing-media
  fallbacks and all three product links. Disabling JavaScript rendered the
  static merchant-store link without overflow.

Not deployed. Existing merchant-readiness and credential-revocation gates above
remain unchanged.

### Isolated pre-push verification

The storefront commit was assembled in a temporary Git index, excluding
unrelated staged skill, calendar and entity-accessibility work. Its exact
source snapshot was materialized with existing dependencies and ignored local
environment configuration, without changing the shared worktree or user index.

- Full Vitest suite: **224 files / 2,303 tests passed**. The app-level anonymous
  shop route test now uses the same browser-motion mock as the page suites.
- Production build, storefront-scoped ESLint, route-test ESLint and TypeScript
  build passed. This isolated snapshot's app-chunk warning is **679.15 kB**;
  the earlier 683.46 kB measurement included unrelated working-tree changes.
- The compiled isolated snapshot rendered three real merchant products at
  390×844 without overflow. Product navigation removed Lenis classes and direct
  refresh rendered `/shop/products/unisex-t-shirt`; no browser errors were observed.
- jsdom still reports its unsupported `window.scrollTo` and document-navigation
  operations. Those notices were not suppressed; all tests passed.
