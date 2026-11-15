# Documentation CI guard

## User request

> - Reconcile docs/DASHBOARD.md with newer status records; July snapshot still lists shipped work as pending.
> - Replace generic agent KPI targets with agreed, measurable baselines.
> - Add Markdown link and instruction-preservation checks to CI.

The first two items are documentation corrections. This requirements document and
[eval.md](eval.md) cover the new CI guard only. Implementation requires approval of the evals.

## Existing integration

The repository uses Node from `.nvmrc`, npm's lockfile, Vitest, and the installed `marked`
Markdown parser. The `quality` job in
[the Azure workflow](../../../.github/workflows/azure-static-web-apps-lemon-stone-01afe980f.yml)
already installs app/API dependencies, lints, tests, and builds; deployment depends on `quality`.
Shared coding instructions live in [AGENTS.md](../../../AGENTS.md). Claude imports them;
Gemini, Copilot, and OpenCode entry points link to them. The prior refactor preserved
Trail and Caveman blocks byte-for-byte and checked local link destinations and heading anchors.

## Requirements

1. Provide a deterministic, non-watch `npm run check:docs` command using existing dependencies.
   It must run offline, exit zero on success, and print file/link or instruction diagnostics
   with a nonzero exit on failure. It must not modify documentation or execute embedded content.
2. Validate the maintained source set: root `README.md`, `AGENTS.md`, `CLAUDE.md`, `GEMINI.md`,
   `PRODUCT.md`, `GLOSSARY.md`; `.github/copilot-instructions.md`; `.opencode/AGENTS.md`;
   `docs/DASHBOARD.md`; the five curated runbooks under `docs/operations/` listed below;
   `docs/user-guides/*.md`; and this feature's `rd.md` and `eval.md`.
   Validate inline/reference-style relative links and images, directories, same-document and
   cross-document Markdown heading fragments, encoded spaces/fragments, and duplicate-heading
   suffixes. Code examples are not links. Root-relative application URLs, external URLs,
   protocol-relative URLs, and non-file schemes are not fetched or interpreted as repository files.
3. Validate that Claude retains its canonical import and that Gemini, Copilot, and OpenCode
   explicitly direct readers to the existing repository-root `AGENTS.md`. Validate required
   canonical section headings. Missing, empty, duplicated, or altered protected Trail/Caveman
   blocks must fail against a committed, reviewed SHA-256 baseline, normalizing CRLF to LF.
   Intentional rule changes require updating that baseline in the same reviewed change.
   This detects protected-text drift; it does not claim semantic equivalence for arbitrary prose.
4. Add the command to the existing `quality` job after dependency installation and before deployment.
   Preserve lint, Vitest, production build, deployment's `needs: quality`, runtime configuration,
   permissions, and branch/event behavior. No new credentials, services, or external-link requests.
5. Add isolated fixture-based tests for real broken-link and lost-instruction failures. Cover
   links resolving outside the checkout, including symlinks, with explicit failure diagnostics.
   Make the curated docs eligible for version control; do not blanket-unignore tool caches,
   local agent profiles, historical scratch documentation, or personal configuration.
6. Document the command and intentional baseline-update procedure in the contributor guidance.
   Leave the product help renderer and canonical `docs/user-guides/` source ownership unchanged.

Curated runbooks: `events-and-geography.md`, `seo-and-itineraries.md`, `analytics.md`,
`shopify-storefront.md`, and `agent-measurement.md` in `docs/operations/`.

## Proposed files

- New: `scripts/check-docs.mjs`, `scripts/check-docs.test.mjs`, `scripts/docs-instructions.json`.
- Update: `package.json`, the existing Azure workflow, `README.md`, and `AGENTS.md`.
- The `.gitignore` exceptions for curated documentation also make these review documents visible;
  they do not introduce the checker or enable a CI step.

## Assumptions for review

- Check maintained documentation, not every historical plan, archive, generated design export,
  or ignored local agent mirror. A relative link from maintained documentation still has to resolve,
  even when its target is historical.
- Preserve the existing protected Trail/Caveman blocks and canonical section names, not a hash of
  all prose. Baseline updates must be deliberate, reviewable, and described; no auto-refresh fallback.
- No product UI changes, external link crawling, telemetry collection, or production mutations.
- All requested behavior is mapped to eval cases; no requirement is intentionally deferred.
