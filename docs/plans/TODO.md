# TODO

## Blocked: `temporal-polyfill` 0.3.x → 1.x bump (Step 14, Dependency modernization pass)

**Status:** Attempted and reverted. `package.json` remains pinned at `^0.3.0`.

**Blocker:** `@schedule-x/calendar@4.6.1` (and the rest of the `@schedule-x/*` suite at
4.6.1) declares a `peerDependency` on `temporal-polyfill` pinned to the exact string
`"0.3.0"` — not a caret range. Bumping the root `temporal-polyfill` dependency to `^1.0.3`
produces two independent, hard failures:

1. **Peer dependency conflict.** `npm install` reports `ERESOLVE`/`invalid` for
   `@schedule-x/calendar`'s peer requirement on `temporal-polyfill@0.3.0`.
2. **TypeScript build failure.** With `temporal-polyfill@1.0.3` installed, `tsc -b` fails
   with `Cannot find namespace 'Temporal'` / `Cannot find name 'Temporal'` across
   `src/components/Calendar/Calendar.tsx`, `src/features/events/model/convert.ts`, and
   `src/utils/series.ts` — all three files rely on the ambient global `Temporal`
   namespace injected by `import "temporal-polyfill/global"`, and 1.x's type
   declarations for the `/global` entrypoint don't register the same global augmentation
   TypeScript picks up automatically in 0.3.x.

**What was verified before reverting:** the `temporal-polyfill/global` import path and
`Temporal.Instant.from().toZonedDateTimeISO()` conversion behavior work identically in a
standalone 1.0.3 install (isolated from this repo's dependency tree) — the runtime API
itself is not the problem. The blocker is entirely the `@schedule-x` peer-dependency pin
plus a TypeScript ambient-types regression in the 1.x `/global` entrypoint.

**Path to resolution (not attempted, out of scope for this step):**
- Wait for a `@schedule-x/*` release with a loosened/updated `temporal-polyfill` peer
  range, or
- Drop the `temporal-polyfill/global` ambient-import pattern in favor of the tree-shakeable
  named-export API (`import { Temporal } from "temporal-polyfill"`) across all three call
  sites, which may sidestep the global-augmentation gap — untested, would need its own
  isolated validation pass.

**Do not re-attempt this bump without re-reading the current `@schedule-x/*` and
`temporal-polyfill` changelogs** — versions may have moved since 2026-08-04.
