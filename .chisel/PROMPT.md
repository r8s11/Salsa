# Chisel Project: Salsa

This project uses Chisel for documentation and specs.

## Structure
- Docs: `.chisel/docs/` (Markdown)
- Specs: `.chisel/specs/` (Markdown with YAML frontmatter; each spec's lifecycle stage lives in its `status` field: draft, ready, in-progress, shipped, or archived)

## Guidelines
When performing tasks in this repo, you can use `chisel docs` and `chisel spec` with the `--machine` flag to inspect and update the project state efficiently.

Use `chisel context create <query>` to gather relevant docs and specs as structured context.