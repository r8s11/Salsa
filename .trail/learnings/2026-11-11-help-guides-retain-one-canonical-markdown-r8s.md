---
title: Help guides retain one canonical Markdown source
author: R8S
date: 2026-11-11
branch: feature/in-product-help-20261110
id: l-77ba8de5
scope: repo
status: active
src: agent
touches:
  - ".github/copilot-instructions.md"
  - AGENTS.md
  - DESIGN.md
  - README.md
  - docs/user-guides/improvements.md
  - src/features/help/help.css
  - src/features/help/markdown/MarkdownBlocks.tsx
  - src/features/help/markdown/parseGuide.ts
  - src/features/help/selectHelp.ts
---

## Decided
- Keep docs/user-guides/ as the single canonical Markdown source for product help because the owner explicitly chose repository-readable guides without duplicated content. src/features/help/guides.ts imports eight allowed files and normalizes metadata and links for /help; do not move, duplicate or delete the originals.
## Tried and ruled out
- Moving guides to src/content/help/*.md or keeping duplicate copies was rejected because separate sources drift and violate the owner source-of-truth choice.
## Watch out
- Exclude docs/user-guides/improvements.md from raw imports because the earlier wildcard emitted that private backlog as a downloadable build chunk. Use the explicit eight-file import allowlist and verify production output when changing imports.
