# Admin User Details Redesign

## Context

`/admin/users/:id` already implements the complete operational contract for a profile or magic-link submitter: identity, account state, role, contributions, event navigation, audit activity, organizer context, moderation actions, and the existing protected dialogs. Its current visual composition is a sequence of uniformly weighted cards.

The supplied Salsa Segura Redesign Master establishes the target visual language: dark-navy operational surfaces, a structured admin shell, compact uppercase metadata, rose-red decisive actions, gold emphasis, and translucent borders. This phase recreates the detail page within that language without changing its behavior or data contract.

> **Reference limitation / deliberate adaptation:** the supplied master does not contain a dedicated user-detail screen. This design applies its verified admin-shell language to the existing user-detail content rather than inventing reference-specific fields, controls, or workflows.

## Grounded state of the codebase

| Area | Existing behavior | Redesign implication |
| --- | --- | --- |
| Route and data | `AdminUserDetailPage` resolves a user from `useAdminUsers`, events from `useAdminEvents`, and audit entries from `useUserAuditLog`. | Keep all fetches, loading/error/retry paths, filters, and field values unchanged. |
| Identity header | Avatar, display name, identity line, role/status badges, and joined date already render in the page header. | Turn it into the page’s command header; do not create a parallel identity source. |
| Account and activity | Account fields and Activity Summary are separate cards; guest and profile branches intentionally show different fields. | Combine their visual rhythm only; preserve every profile/guest distinction and label. |
| Moderation | `rowActionItems` opens existing role, flag, suspend, ban, restore, and unflag dialogs, including only-admin protection. | Place these controls in a visual action rail without changing eligibility, dialogs, or handler behavior. |
| Supporting data | Events and audit activity have loading, empty, error, retry, and navigation states. | Preserve all states and links while making scan order clearer. |
| Styling | `AdminUserDetailPage.css` owns page-specific layout; shared admin tokens and button/badge components own the visual system. | Refine page CSS with current `--admin-*` tokens and existing shared components; add no palette or global token. |

## Core architecture decision

**Decision: preserve the existing single page component and data flow, and rebuild only its semantic layout grouping plus page-scoped CSS.**

| Choice | Benefit | Cost / ripple |
| --- | --- | --- |
| Retain `AdminUserDetailPage` and its hooks. | No query, route, mutation, or dialog regression risk. | JSX is reorganized but no new feature boundary is introduced. |
| Introduce layout-only wrappers and explicit section class hooks. | A desktop command-header/main-column/side-rail composition can collapse cleanly to mobile. | Targeted page test updates may be required if heading or landmark grouping changes. |
| Reuse `AdminUserAvatar`, role/status badges, shared buttons, and dialogs. | Existing semantics, colors, and behavior remain consistent across the admin shell. | Visual detail is constrained to current admin design tokens; no new component system. |

## Deliverables

### 1. Profile command header

The page begins with the existing back link followed by a dedicated header surface. It contains the current avatar, display name, identity line, badges, and joined/first-activity date.

The header introduces a compact uppercase `USER PROFILE` eyebrow and visually separates identity metadata from operational controls. It does not duplicate, rename, or hide existing identity fields.

### 2. Responsive information architecture

At desktop widths, the content becomes a two-column grid:

- **Main column:** Account & activity overview, Events & Contributions, and Activity timeline.
- **Side rail:** Account state / moderation context, conditional Organizer context, and Administrative Actions.

At mobile widths, the grid becomes one vertical flow. The command header and every action remain full-width and readable; the side rail must not retain a fixed width or horizontal layout.

### 3. Account intelligence panel

The existing Account and Activity Summary fields are presented together in a single structured definition-list-style surface, with muted uppercase labels and values aligned for fast scanning.

Profile and guest user branches retain exactly their current fields, labels, verification chip, and role/account-type meaning. Contributions and pending counts remain visible and unchanged.

### 4. Activity and contribution panels

Events & Contributions retains its five-event limit, status badges, edit links, empty state, and `View all in Events` action. The redesign makes each row a compact, touch-safe operational row with clear title/status separation.

Activity retains audit loading, error/retry, empty, date, actor, and log-label behavior. Timeline entries receive a restrained vertical rail using existing admin border and text tokens; no audit data is reformatted into claims not supplied by the API.

### 5. Moderation and administrative action rail

The side rail gives Moderation and Administrative Actions visual priority without changing action availability. Existing only-admin protection and all dialog confirmation/reason requirements remain authoritative.

- Neutral controls use existing secondary button treatment.
- Destructive controls preserve the existing danger treatment.
- Rose-red remains a decisive/destructive action cue; it is not used for static status decoration.
- Current status/reason remains visible before controls so an operator acts with context.

### 6. Organizer context

The Organizer panel remains conditional on `user.role === "organizer"`. It retains the upcoming-event count and filtered events link, but uses the same concise metadata and panel styling as the rest of the side rail.

### 7. Accessibility, state handling, and tests

Preserve the existing `h1`, section headings, native links and buttons, focus-visible behavior, dialogs, `aria-busy`, `role="status"`, `role="alert"`, retry buttons, and route targets.

Tests must preserve existing observable data and action contracts. Add assertions only for newly meaningful document structure or responsive class hooks; do not test incidental CSS values.

## Wireframes

### Desktop

```text
← Users
USER PROFILE
┌───────────────────────────────────────────────────────────────────────┐
│ [avatar]  Ada Lovelace                         [Role] [Account state] │
│           ada@salsa.test · @ada                                      │
│           Joined August 5, 2026                                      │
└───────────────────────────────────────────────────────────────────────┘

┌───────────────────────────────────────────┐  ┌────────────────────────┐
│ ACCOUNT & ACTIVITY                         │  │ MODERATION             │
│ Email        ada@salsa.test  [Verified]    │  │ Current state / reason │
│ Username     @ada                           │  ├────────────────────────┤
│ Type         Registered User                │  │ ORGANIZER (conditional)│
│ Role         Organizer                      │  │ upcoming events        │
│ Contributions 3       Pending 0             │  ├────────────────────────┤
└───────────────────────────────────────────┘  │ ADMINISTRATIVE ACTIONS │
                                               │ [Change role]          │
┌───────────────────────────────────────────┐  │ [Suspend]              │
│ EVENTS & CONTRIBUTIONS                     │  │ [Ban]                  │
│ Event title                         [status]│  └────────────────────────┘
│ View all in Events →                       │
└───────────────────────────────────────────┘
┌───────────────────────────────────────────┐
│ ACTIVITY                                   │
│ ┃ Aug 5  Role changed by Admin             │
│ ┃ Aug 3  Event submitted by Ada            │
└───────────────────────────────────────────┘
```

### Mobile

```text
← Users
USER PROFILE
┌─────────────────────────────┐
│ [avatar] Ada Lovelace        │
│ ada@salsa.test              │
│ [Role] [Account state]      │
└─────────────────────────────┘
┌─────────────────────────────┐
│ ACCOUNT & ACTIVITY          │
│ label / value rows          │
└─────────────────────────────┘
┌─────────────────────────────┐
│ MODERATION                  │
└─────────────────────────────┘
┌─────────────────────────────┐
│ ORGANIZER — when applicable │
└─────────────────────────────┘
┌─────────────────────────────┐
│ EVENTS & CONTRIBUTIONS      │
└─────────────────────────────┘
┌─────────────────────────────┐
│ ACTIVITY                    │
└─────────────────────────────┘
┌─────────────────────────────┐
│ ADMINISTRATIVE ACTIONS      │
│ full-width controls         │
└─────────────────────────────┘
```

## Verification

1. Run focused `AdminUserDetailPage` tests for profile, guest, organizer, status, only-admin, event, audit loading/error/empty, and action-dialog states.
2. Run TypeScript, lint, and production build.
3. Browser-drive desktop and narrow mobile views using a local user fixture. Confirm the profile/guest layout, organizer condition, audit states, action dialogs, event navigation, escape/focus behavior, and no horizontal mobile overflow.

## What this design does not decide

- New user data, API fields, queries, mutations, moderation rules, or role permissions.
- Changes to the existing action dialogs or their copy.
- Global admin-shell redesigns, new admin tokens, new icons, or public-site layout changes.
- A distinct mobile navigation model.
