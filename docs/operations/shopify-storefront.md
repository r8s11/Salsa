# Shopify storefront

Run commands from the repository root. [Project setup](../../README.md).

## Native Shopify shop

Public routes `/shop` and `/shop/products/:handle` use the existing Salsa Segura
layout. Shopify Storefront API `2026-10` owns products, variants, prices,
availability, cart calculations, and checkout. Integration code lives in
`src/features/shopify/`; the app never processes payments or stores card data.

**Retail Edit is the production storefront**, not a development preview.
The catalog pairs an editorial product-photo hero and condensed display type
with whole-product photography, direct product links, checkout guidance and a
calendar CTA. Page-scoped GSAP/Lenis motion respects reduced motion and native
touch scrolling. Solar icons are bundled locally with attribution.
Product pages use named option buttons, a gallery, a details disclosure and
a mobile purchase bar above the public dock. Catalog navigation preloads
product data and uses a shared-image transition where supported; confirmed
adds animate into the cart. Reduced motion retains the same purchase flow
without either effect. The discarded Drop Grid and preview switcher are removed;
`?variant=retail` or `?variant=drop` no longer selects another design.
With JavaScript disabled, the shared app shell explains the event guide and links
to Boston/NYC events, the calendar, directories, and site information. It also
retains the shop message and direct link to the public merchant storefront.

Set these optional build-time values in `.env.local`:

```ini
VITE_SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
VITE_SHOPIFY_STOREFRONT_TOKEN=your-public-storefront-token
```

Use the canonical `*.myshopify.com` domain without a URL scheme/path and a
**public Storefront access token** from Shopify's Headless sales channel.
Never supply Admin API tokens, private Storefront tokens, or app secrets:
Vite embeds `VITE_*` values in the browser bundle. Missing configuration leaves
the rest of the app usable and displays a shop-unavailable state.

Shell exports take precedence over `.env` and `.env.local`. After correcting the
domain, update or unset a stale `VITE_SHOPIFY_STORE_DOMAIN` export before starting
Vite or building; changing the file alone does not override an exported value.

For local launches/builds that must use the values already in `.env.local`,
clear inherited Shopify overrides for that process:

```bash
env -u VITE_SHOPIFY_STORE_DOMAIN -u VITE_SHOPIFY_STOREFRONT_TOKEN npm run dev
env -u VITE_SHOPIFY_STORE_DOMAIN -u VITE_SHOPIFY_STOREFRONT_TOKEN npm run build
```

Do not use these commands in CI where the intended values come from secrets.
No token or local environment-file change is required for the Retail Edit cutover.

In Shopify, install/configure the Headless channel, enable product and cart/
checkout Storefront access, and publish the intended products to that channel.
Configure variant inventory, currency/markets, shipping, taxes, payments, and
checkout branding in Shopify. Prices and availability are not duplicated locally.
For Azure Static Web Apps, set the two same-named GitHub repository secrets;
the existing workflow forwards them to both build steps. Rebuild/redeploy after
changing them: Azure runtime application settings do not replace Vite build values.

Current launch-blocker remediation and merchant-review policy drafts are in
[`docs/shopify-phase-2-6-readiness.md`](../shopify-phase-2-6-readiness.md);
the [Phase 2.5 report](../shopify-phase-2-5-readiness.md) is historical evidence.

The cart provider stores only the Shopify cart ID at
`salsasegura:shopify-cart-id`. It restores the cart on public-layout startup,
removes IDs confirmed missing by Shopify, and retains IDs on network failures.
Cart mutations display Shopify's returned quantities and totals. Warning-only
responses with a valid cart are accepted, with a curated adjustment notice;
Shopify user errors still report failure. Checkout follows Shopify's returned `checkoutUrl`.
Keyboard mutations keep focus with the affected item while controls are locked,
then restore an enabled action; removals focus a surviving item or Browse the shop.
Escape restores the opener, and deliberate focus movement is not overridden.
Mobile navigation retains its dialog semantics and focus handling; the header
can wrap at enlarged text sizes without hiding the Shop destination or menu toggle.

The catalog and product pages share the public site's navy, rose and gold UI.
Product galleries use Shopify image dimensions when available; named options,
sold-out choices and prices come from Shopify. Select a quantity before adding.
An add stays on the product page and announces success; open the cart to review
Shopify's returned quantities and estimated totals. Removing a line is separate
from decreasing its quantity. Shipping and taxes are calculated at Shopify checkout.
Changing products resets purchase options and quantity. Feedback from an in-flight
add does not appear on a different product after navigation.

Shop and product pages use the existing client-side metadata helpers with clean,
query-free canonicals. Product JSON-LD includes only supplied product data and
Shopify variant offers; it does not invent ratings, reviews or inventory counts.
This is not SSR: client-side metadata does **not** provide true server-rendered
product social previews to crawlers that do not execute JavaScript.

Focused tests mock Shopify and never contact a production shop:

```bash
npm test -- --run src/features/shopify src/app/App.shopRoutes.test.tsx
```

All exported documents in `src/features/shopify/api/operations.ts` are validated
offline against the credential-free
[`2026-10` schema fixture](../../src/features/shopify/api/fixtures/storefront-2026-10.schema.json),
retrieved from Shopify's public versioned introspection endpoint. The validation
uses GraphQL.js `parse`, `buildClientSchema`, and `validate`; CI makes no Shopify
request. Re-fetch and review the fixture only when intentionally updating the
API version. The Storefront client remains pinned to `2026-10`.

Run the schema check with:

```bash
npm test -- --run src/features/shopify/api/operations.schema.test.ts
```

The client distinguishes configuration, transport, HTTP, GraphQL, malformed
response, mutation, pagination, and invalid-checkout failures. Product, variant,
gallery-image and cart-line pages use Shopify cursors and fail rather than silently truncate.
Money remains Shopify decimal strings. Cart mutations keep Shopify-returned
quantities and totals; checkout accepts only Shopify-returned HTTPS URLs without
rewriting them.
