---
feature: Markdown link and instruction-preservation CI guard
status: passed
approved: 2026-11-14
rd: rd.md
---

# Evals: Markdown link and instruction-preservation CI guard

Repository contributors receive an offline local command and a blocking check in the
existing CI quality job for maintained Markdown links and protected coding instructions.
No application UI or product behavior changes; no HTML mockup is needed.

## Build contract

- Build only after `status: approved`. Changing a case requires user re-approval (`status: review`).
- Run: `node ~/.agents/skills/write-evals/scripts/evals.mjs run docs/plans/documentation-ci/eval.md`.
- Record manual evidence with `node ~/.agents/skills/write-evals/scripts/evals.mjs record docs/plans/documentation-ci/eval.md <ID> pass|fail "<observation and evidence path>"`.
- Any code change makes prior automated results stale. Every automated case must pass; manual cases are advisory unless recorded as failing.
- Automated commands run from the repository root with exit zero meaning pass.
- Use the existing Vitest runner for `scripts/check-docs.test.mjs`; keep fixture directories isolated,
  create them with temporary-directory APIs, and remove them in test cleanup. Never mutate checked-in
  instructions to demonstrate failures. No build, workflow, or checker implementation before approval.

## Traceability

| Requirement from RD | Cases |
| --- | --- |
| 1. Offline deterministic command, diagnostics, read-only behavior | U1, U3, F1, F5, F6 |
| 2. Maintained scope and Markdown link/fragment variants | U1, U3, F1, F2, F6 |
| 3. Canonical entry points, headings, protected block preservation | U1, F3, F4 |
| 4. Blocking CI integration without replacing existing gates | U2, R1, R2, R4 |
| 5. Isolated regression fixtures and intentional version-control scope | U3, F1–F6, R4 |
| 6. Contributor procedure and unchanged help ownership | R3, R4 |

## Usage — every way to use the feature

### U1 — Contributor checks maintained documentation locally
- **Setup:** App dependencies installed using `npm ci`; maintained source set and protected baseline from RD are present.
- **Steps:** Run the checker twice without changing any files.
- **Expected:** Both runs exit zero with identical sorted diagnostics/summary; every required source file is checked, including canonical entry points and curated runbooks. No document or baseline changes on disk.
- **Verify:** `npm run check:docs && npm run check:docs`

### U2 — Pull requests and pushes remain gated by documentation checks
- **Setup:** Existing Azure workflow and proposed checker command; no GitHub publishing is authorized by this eval.
- **Steps:** Inspect the workflow's `quality` steps and deployment dependency.
- **Expected:** Documentation checking runs after installation, before deployment; a nonzero result fails `quality`; deployment still depends on `quality`. Existing lint, test, and build steps remain. No continue-on-error, changed permissions, added secrets, or skipped branch/event paths.
- **Verify:** manual — inspect the workflow and record its documentation-check step, dependency, and unchanged existing gates in eval evidence; do not push or dispatch a workflow without separate authorization.

### U3 — Valid Markdown link forms and intended exclusions are accepted
- **Setup:** `scripts/check-docs.test.mjs` creates an isolated fixture checkout with inline/reference links and images, directory links, encoded filenames, same/cross-document fragments, Unicode headings, duplicate headings, and CRLF files. Include external/non-file schemes, protocol-relative and root-relative app URLs, and code examples containing fake links.
- **Steps:** Run the fixture through the same checker implementation used by the CLI.
- **Expected:** Existing local targets and correct heading fragments pass. Duplicate-heading suffixes resolve to the correct heading. Intended exclusions are neither fetched nor treated as repository paths. Repeated runs have the same result and leave fixture bytes unchanged.
- **Verify:** `npx vitest run scripts/check-docs.test.mjs -t "valid Markdown links"`

## Failure — every way it could go wrong

### F1 — Broken relative link or image produces actionable failure
- **Setup:** Isolated fixtures each containing one nonexistent inline target, reference-style target, or image target; valid neighboring links remain present.
- **Steps:** Check each fixture through the checker and CLI boundary.
- **Expected:** Each check fails with the source filename and offending destination; CLI exits nonzero. A valid neighbor cannot hide the error. No fallback creates the missing target.
- **Verify:** `npx vitest run scripts/check-docs.test.mjs -t "broken local targets"`

### F2 — Invalid fragment does not pass because its file exists
- **Setup:** Fixture Markdown files with existing targets but absent same-document/cross-document headings and nonexistent duplicate-heading suffixes; include valid neighboring encoded and Unicode fragments.
- **Steps:** Validate each fragment.
- **Expected:** Every absent fragment fails with source and destination. Valid neighboring fragments pass. Heading numbering is deterministic and follows GitHub-style duplicate suffixes.
- **Verify:** `npx vitest run scripts/check-docs.test.mjs -t "missing heading fragments"`

### F3 — Lost or altered protected instructions fail closed
- **Setup:** A valid isolated AGENTS fixture with reviewed SHA-256 block fingerprints. Independently remove, empty, duplicate, or edit each Trail/Caveman block; separately change only CRLF line endings to LF.
- **Steps:** Validate each mutated fixture against its unchanged baseline.
- **Expected:** Missing, empty, duplicated, or altered blocks fail and identify the block. In particular, deleting or reversing a prohibition fails. Line-ending-only changes pass. The checker never refreshes its own baseline.
- **Verify:** `npx vitest run scripts/check-docs.test.mjs -t "protected instruction drift"`

### F4 — Entry-point or required-section loss is detected
- **Setup:** Valid fixture entry points and canonical section names. Independently remove a required file, remove Claude's import, redirect each linked adapter away from root AGENTS, or remove a required canonical heading.
- **Steps:** Check each mutation.
- **Expected:** Every mutation fails with the affected file or missing section. A still-existing but wrong target does not count as canonical guidance. Protected blocks elsewhere cannot mask the missing import, adapter, or section.
- **Verify:** `npx vitest run scripts/check-docs.test.mjs -t "canonical guidance missing"`

### F5 — Missing input and unreadable baseline cannot silently skip checking
- **Setup:** Isolated fixtures with a missing required runbook, malformed/missing baseline JSON, and an unreadable input simulated deterministically rather than by OS-specific permissions. Deny network access in the fixture's fetch stub.
- **Steps:** Invoke checks on each fixture and on the valid fixture with network access denied.
- **Expected:** Missing/unreadable required inputs produce nonzero results identifying the input. Valid offline checks succeed without any network attempt. Nothing substitutes an empty document or regenerated baseline.
- **Verify:** `npx vitest run scripts/check-docs.test.mjs -t "required input failures"`

### F6 — Repository traversal and embedded content are not executed
- **Setup:** Temporary checkout fixtures with links escaping the root through `..` and through a symlink, an in-root `../` link, and Markdown code containing a shell command that would create a sentinel if executed.
- **Steps:** Run the checker and inspect the fixture/sentinel state.
- **Expected:** Out-of-root links fail with their source and destination; valid in-root traversal passes. Embedded content is not executed, the sentinel does not exist, and no target file changes.
- **Verify:** `npx vitest run scripts/check-docs.test.mjs -t "repository boundaries"`

## Regression — what this feature must not break

### R1 — Existing test suite still passes
- **Setup:** App and API dependencies installed; existing test fixtures unchanged.
- **Steps:** Run the full non-watch Vitest suite.
- **Expected:** Full suite passes, including new isolated checker tests; no network or production credentials are required by the checker tests.
- **Verify:** `npx vitest run`

### R2 — Typecheck and production build succeed
- **Setup:** Build configuration as in the existing CI quality job; no checker-specific credentials.
- **Steps:** Run the production build, whose script includes `tsc -b` and Vite/postbuild steps.
- **Expected:** Typecheck and build exit zero without changing their existing environment contract.
- **Verify:** `npm run build`

### R3 — Product help keeps its canonical source and rendering behavior
- **Setup:** Existing help fixtures and `docs/user-guides/` source tree unchanged except for intentional documentation edits.
- **Steps:** Run the current help feature's tests.
- **Expected:** Guide loading, links, headings, and unsupported-Markdown handling retain their existing behavior; the checker does not move or duplicate product-guide sources.
- **Verify:** `npx vitest run src/features/help`

### R4 — Version-control boundaries and maintenance procedure stay explicit
- **Setup:** Curated runbooks/review docs, repository ignore rules, contributor guidance, and baseline-update procedure.
- **Steps:** Check curated paths with `git check-ignore --no-index`; inspect contributor guidance and workflow configuration.
- **Expected:** Curated runbooks and review docs can be committed without force; `.claude/` and unrelated scratch docs stay ignored. Guidance documents `npm run check:docs` and a deliberate reviewed baseline-update process. Existing runtime environment, branch/event filters, permissions, and deployment settings remain unchanged.
- **Verify:** manual — capture ignore-check output for all five runbooks, both review docs, one local agent profile, and an unrelated scratch path; record the documented baseline-update process and unchanged workflow settings.

## Design

Not applicable: developer tooling only, with no product UI or user-facing visual changes.
