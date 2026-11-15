# Agent measurement contract

Use this contract when defining success metrics for marketing, operations, or project work.
Run repository commands from the repository root. [Project setup](../../README.md).

## Baseline before target

No measured numerical baseline or owner-approved numerical target is recorded here.
A target in an agent template is not evidence of an agreed goal or a measured result.

For each metric, record its definition and unit, numerator and denominator when applicable,
source or query, audience or cohort, observation window and timezone, sample size,
measurement owner, and collection date. Record the observed value with its evidence.
Use **not measured** when evidence is unavailable; use **not applicable** when the metric
does not fit the task. Neither means zero. Keep proposals separate from observations.

Compare like-for-like windows and populations. State exclusions, missing data, uncertainty,
and attribution limits. Do not infer business impact from output volume, engagement,
a task being completed, or a before/after change alone.

Before work starts, agree the target, deadline, and guardrails with the responsible owner.
Record the owner's approval and date alongside the baseline. Until then, report observations
and proposed targets without calling the targets agreed or achieved. Revisit targets when
the population, measurement method, or operating conditions change.

## Existing Salsa Segura measurements

The definitions below already exist in the product; they do not establish current values or goals.

| Metric | Definition and evidence | Baseline and target status |
| --- | --- | --- |
| Weekly returning dancers | For a completed New York ISO week W, anonymous Umami visitors with `event-view:<metro>` in W and W−1. Share = returning / active in W. Run `node scripts/repeat-dancers.mjs <YYYY-MM> <metro-slug>` with server-side reporting credentials. See [Analytics](analytics.md#weekly-returning-dancers) for monthly identity rotation, unavailable windows, and privacy limits. | Not measured in this document; target requires owner approval. |
| Recurring coverage | 100 × tracked recurring nights with an approved listing in the next 14 New York calendar days / tracked recurring nights. A tracked night occurred on at least two distinct dates in the prior 28 days. Zero tracked nights yields no score. See [Analytics](analytics.md#recurring-coverage) for identity rules, deployment prerequisites, and SQL verification. | Not measured in this document; target requires owner approval. |
| Event intent actions | Counts of `rsvp-click:<metro>`, `ticket-click:<metro>`, and `event-share:<metro>` activations. A click does not prove attendance, purchase, or completed sharing. See [Analytics](analytics.md#analytics-baseline). | Not measured in this document; no conversion or revenue target is approved here. |

## Other work

Use task-specific evidence rather than the same percentage goal for every platform or project.
Marketing comparisons need platform-specific definitions and comparable audiences; delivery
metrics need approved scope, dates, and budgets; operational metrics need an agreed service
boundary. Experiments need a prespecified hypothesis and statistical design, not a promised lift.
Organizational measures must preserve consent, anonymity, and confidentiality; publish only
appropriately aggregated results and disclose any unrepresentative sample.
