# Component library

Reusable UI components kept as reference copies for agents and future projects. Each
entry is a self-contained folder: the component, its stylesheet, its test, and a
README with props, call-site examples, and design rules.

These files are **snapshots**, not imports. The app never imports from `design/`
(it is outside `tsconfig` `include`, and ESLint ignores it). The live code stays in
`src/`. To use a component:

- **In this app:** import the canonical source listed below. Do not import from
  `design/`.
- **In another project:** copy the folder. Styles use Ritmo Vivo tokens
  (`--surface`, `--red`, `--gold-light`, `--font-display`, and so on) from
  [DESIGN.md](../../DESIGN.md); map them to the target project's tokens.

## Catalog

| Component | Canonical source | Used by | Snapshot |
|-----------|------------------|---------|----------|
| [VenueMapCard](VenueMapCard/README.md) | `src/features/events/components/VenueMapCard.tsx` | Event detail sidebar, school profile | 2026-11-27 |

## Adding a component

1. Create `design/components/<Name>/` and copy the component, its CSS, and its test
   verbatim from `src/`.
2. Write `<Name>/README.md`: canonical source path, props, each call site with a
   code example, design rules, and the drift-check command.
3. Add a row to the catalog table above.

## Checking drift

A snapshot goes stale when the source changes. Compare before you copy one:

```bash
diff -r --exclude=README.md design/components/VenueMapCard src/features/events/components \
  | grep -v "^Only in src"
```

No output means the snapshot matches. If it differs, refresh the snapshot from
`src/` and update its date in the catalog.
