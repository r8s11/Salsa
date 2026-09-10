# Phase 10 — Tags & Taxonomy Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace free-form event dance-style arrays with controlled taxonomy relationships and deliver accessible admin pages to manage dance styles and event attributes.

**Architecture:** Introduce one typed `taxonomy_terms` table and a normalized `event_taxonomy_terms` join. A feature-local model/repository/hooks layer owns taxonomy access; pages and components consume those hooks. Existing `events.event_type` stays the direct required controlled field; `events.dance_styles` is migrated once and removed only by a separately reviewed optional SQL cleanup script after application cutover.

**Tech Stack:** React 19, TypeScript strict mode, React Router v7, TanStack Query v5, Supabase/Postgres/RLS, Vitest, React Testing Library, Lucide, existing `.admin-shell` CSS.

## Global Constraints

- Implement **Phase 10 only**: `/admin/tags`, `/admin/tags/new`, and `/admin/tags/:id`; do not enter Settings, public taxonomy pages, organizer taxonomy, or aliases.
- Use one `taxonomy_terms` table with `dance_style` and `event_attribute` categories plus `event_taxonomy_terms`; do not introduce free-form tags or a parallel legacy storage contract.
- Keep `events.event_type` as the existing required direct `social | class | workshop` field.
- A saved slug is stable: editing a label must not auto-change its slug.
- Database constraints—not frontend checks alone—must prevent case-only duplicates and duplicate event-term pairs.
- Archive preserves relationships and removes terms from normal event entry. Delete is available only when term usage is zero. Merge reassigns relationships transactionally and archives the source.
- Never auto-merge based on text similarity. Parent/child schema support is permitted, but no hierarchy UI is in scope.
- SQL files live in `sql/phase-10/`, are individually commented and idempotent where possible, and are never run against production by this work.
- Do not run `supabase db push`, `supabase db reset`, or any production database command.
- Reuse existing admin patterns: `AdminActionMenu`, `AdminConfirmDialog`, `AdminViewTabs`, URL-state toolbars, desktop-table/mobile-card layout, `.admin-shell` tokens, and the theme context.
- New Supabase access belongs in `src/features/admin/api/taxonomyRepo.ts`; components and hooks never call Supabase directly.
- Test observable behavior and boundaries with Vitest/RTL. Use `within()` when desktop and mobile variants duplicate visible strings.
- Complete each task with its focused Vitest command; before handoff run `npx tsc --noEmit`, `npm run lint`, `npm run test`, `npm run build`, and browser-drive the changed admin surfaces.

---

## File Structure

| Path | Responsibility |
|---|---|
| `sql/phase-10/001_create_taxonomy_terms.sql` | Taxonomy schema, database-derived normalization, constraints, RLS, audit support, and directory/detail/search RPCs. |
| `sql/phase-10/002_create_event_taxonomy_terms.sql` | Event-term join table, exact-set replacement and transactional submission-approval RPCs, plus FK/index protections. |
| `sql/phase-10/003_seed_taxonomy_terms.sql` | Idempotent canonical dance-style and attribute seeds. |
| `sql/phase-10/004_migrate_event_dance_styles.sql` | Deterministic legacy-array migration plus validation queries. |
| `sql/phase-10/005_remove_events_dance_styles.sql` | Explicit optional, destructive, post-deploy cleanup only. |
| `src/features/admin/model/taxonomy.ts` | Term/domain types, URL/filter parsing, form normalization and validation helpers. |
| `src/features/admin/api/taxonomyRepo.ts` | Sole taxonomy data-access module; RPC directory/detail/search and mutations. |
| `src/features/admin/hooks/useAdminTaxonomy.ts` | TanStack Query keys, queries, mutations, and cache invalidation. |
| `src/components/Admin/AdminTaxonomyStatusBadge.tsx` | Accessible status label/icon treatment. |
| `src/components/Admin/AdminTaxonomyForm.tsx` | Shared controlled create/edit form. |
| `src/components/Admin/AdminTaxonomyTable.tsx` | Desktop table/mobile cards and row actions. |
| `src/components/Admin/AdminTaxonomyToolbar.tsx` | Search/filter/view controls and URL-state interactions. |
| `src/components/Admin/AdminMergeTaxonomyDialog.tsx` | Focus-managed keep/source selection and irreversible consequence confirmation. |
| `src/pages/AdminTagsPage.tsx` | Tags directory route shell. |
| `src/pages/AdminTaxonomyNewPage.tsx` | Create route shell. |
| `src/pages/AdminTaxonomyDetailPage.tsx` | Detail/edit/usage/admin actions shell. |
| `src/components/Admin/AdminEventForm.tsx` | Replaces hard-coded `DANCE_STYLE_OPTIONS` with controlled loaded terms. |
| `src/features/admin/model/adminEventForm.ts` | Changes form state/payload mapping from string arrays to term IDs. |
| `src/features/events/api/eventsRepo.ts` | Persists an event's complete taxonomy relationship set in the existing event mutation flow. |
| `src/features/events/model/types.ts` | Replaces `dance_styles` with taxonomy relationship data needed by admin editing. |
| `src/App.tsx`, `src/layouts/AdminLayout.tsx`, `src/components/Admin/AdminSidebar.tsx` | Tags routes, breadcrumb, and enabled navigation. |
| `src/styles/admin.css` plus component CSS | Token-based accessible responsive styling. |

## Task 1: Add reviewed, manual taxonomy SQL deliverables

**Files:**
- Create: `sql/phase-10/001_create_taxonomy_terms.sql`
- Create: `sql/phase-10/002_create_event_taxonomy_terms.sql`
- Create: `sql/phase-10/003_seed_taxonomy_terms.sql`
- Create: `sql/phase-10/004_migrate_event_dance_styles.sql`
- Create: `sql/phase-10/005_remove_events_dance_styles.sql`
- Test: SQL inspection queries embedded in `004_migrate_event_dance_styles.sql`

**Interfaces:**
- Produces: `public.taxonomy_terms`, `public.event_taxonomy_terms`; RPCs `admin_taxonomy_directory`, `admin_taxonomy_detail`, `admin_taxonomy_search`, `merge_taxonomy_terms`, `replace_event_taxonomy_terms`, `approve_event_submission`; SQL-facing term categories/statuses.
- Consumes: `public.events`, `public.profiles`, `public.audit_logs`, and existing `public.set_updated_at()` conventions.

- [ ] **Step 1: Write the Unicode-normalization preflight at the top of `001_create_taxonomy_terms.sql` and legacy mapping assertions in `004_migrate_event_dance_styles.sql`**

```sql
-- PostgreSQL normalize(..., NFKC) requires UTF8 and must be immutable for
-- use by the generated normalized_name column. All three values must be true.
select
  current_setting('server_encoding') = 'UTF8' as server_is_utf8,
  normalize('Ｓａｌｓａ', NFKC) = 'Salsa' as nfkc_available,
  exists (
    select 1
    from pg_proc
    where proname = 'normalize'
      and provolatile = 'i'
  ) as normalize_is_immutable;

-- Non-production proof that canonically equivalent names collide. The rollback
-- guarantees this test leaves no data behind.
begin;
create temporary table taxonomy_unicode_probe (
  name text not null,
  normalized_name text generated always as (lower(btrim(normalize(name, NFKC)))) stored,
  unique (normalized_name)
);
insert into taxonomy_unicode_probe (name) values ('Salsa');
do $$
begin
  begin
    insert into taxonomy_unicode_probe (name) values ('Ｓａｌｓａ');
    raise exception 'NFKC-equivalent taxonomy names did not collide';
  exception
    when unique_violation then null;
  end;
end;
$$;
rollback;

-- Place the following mapping assertion in 004, after 001–003 have succeeded.
-- It must return zero rows before legacy array data is accepted:
select legacy_style
from (
  select distinct unnest(dance_styles) as legacy_style
  from public.events
) legacy
left join public.taxonomy_terms term
  on term.category = 'dance_style'
 and term.slug = legacy.legacy_style
where term.id is null;
```

- [ ] **Step 2: Run the assertion manually only against a non-production copy if one is available**

Run: copy the assertion query into the approved local/staging SQL console.

Expected: the normalization preflight returns only `true` values, and the mapping query returns zero unmapped legacy style values; otherwise stop and correct the reviewed migration. Do not run this or any phase SQL against production.

- [ ] **Step 3: Implement `001_create_taxonomy_terms.sql` as additive, commented DDL**

```sql
create table if not exists public.taxonomy_terms (
  id uuid primary key default gen_random_uuid(),
  category text not null check (category in ('dance_style', 'event_attribute')),
  name text not null check (btrim(name) <> ''),
  normalized_name text generated always as (lower(btrim(normalize(name, NFKC)))) stored,
  slug text not null check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  description text,
  parent_id uuid references public.taxonomy_terms(id) on delete restrict,
  status text not null default 'active'
    check (status in ('active', 'needs_review', 'archived')),
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint taxonomy_terms_normalized_name_unique unique (category, normalized_name),
  constraint taxonomy_terms_slug_unique unique (slug),
  constraint taxonomy_terms_not_own_parent check (parent_id is null or parent_id <> id)
);
```

Add indexes for `(category, status, display_order, name)` and `parent_id`; add the established `set_updated_at` trigger idempotently; enable RLS with admin read/write policies following the existing `profiles`/venue migration policy vocabulary. Add directory/detail/search RPCs that return event usage counts with optional category/status/search filters. `merge_taxonomy_terms(p_keep_id uuid, p_merge_id uuid)` must reject identical IDs/different categories, insert non-duplicate destination pairs, delete only source join pairs, update the source to archived, and append an `audit_logs` record in one transaction. The database, not the client, derives `normalized_name` by Unicode NFKC normalization, trim, and lowercase, so every insert/update gets the same uniqueness key.

- [ ] **Step 4: Implement join, seeds, migration, submission approval, and optional cleanup scripts**

```sql
-- 002: no duplicate relationship is possible.
create table if not exists public.event_taxonomy_terms (
  event_id uuid not null references public.events(id) on delete cascade,
  taxonomy_term_id uuid not null references public.taxonomy_terms(id) on delete restrict,
  primary key (event_id, taxonomy_term_id)
);
create index if not exists event_taxonomy_terms_term_event_idx
  on public.event_taxonomy_terms (taxonomy_term_id, event_id);

-- 004: preserve pairs and tolerate reruns.
insert into public.event_taxonomy_terms (event_id, taxonomy_term_id)
select event.id, term.id
from public.events event
cross join lateral unnest(event.dance_styles) as legacy_style
join public.taxonomy_terms term
  on term.category = 'dance_style'
 and term.slug = legacy_style
on conflict do nothing;
```

Seed all specified canonical values with `insert ... on conflict (slug) do update` that does not overwrite an administrator-edited name/description. In the additive `002_create_event_taxonomy_terms.sql`, define `approve_event_submission(p_submission_id uuid, p_taxonomy_term_ids uuid[])` as a security-definer moderator-only RPC: read immutable `submitted_data`, overlay `coalesce(edited_data, '{}'::jsonb)` to form the effective payload, validate its required event fields, create the canonical `events` row from that effective payload, validate and insert selected term pairs, then set `event_submissions.status = 'approved'`, `approved_event_id`, `reviewed_by`, and `reviewed_at` in one transaction. It never mutates `submitted_data`. Make `005` explicitly start with `-- OPTIONAL AND DESTRUCTIVE: execute only after application deployment and manual validation`, then use `alter table public.events drop column dance_styles;` without including it in another file.

- [ ] **Step 5: Add post-migration verification SQL and inspect all SQL files**

Run: `grep -nE "(create table|create function|insert into|drop column|production)" sql/phase-10/*.sql`

Expected: five named, commented files; only `005` contains `drop column`; `004` includes legacy-row versus join-row count checks and unmapped-value checks.

- [ ] **Step 6: Commit the SQL deliverables**

```bash
git add sql/phase-10
git commit -m "feat: add Phase 10 taxonomy SQL"
```

## Task 2: Define tested taxonomy domain types and pure rules

**Files:**
- Create: `src/features/admin/model/taxonomy.ts`
- Create: `src/features/admin/model/taxonomy.test.ts`

**Interfaces:**
- Produces: `TaxonomyCategory`, `TaxonomyStatus`, `TaxonomyTerm`, `TaxonomyTermDetail`, `TaxonomyForm`, `TaxonomyFilters`, `normalizeTaxonomyName(name)`, `slugifyTaxonomyName(name)`, `validateTaxonomyForm(form)`, `canDeleteTaxonomyTerm(usageCount)`, `canChangeTaxonomyCategory(usageCount)`.
- Consumes: no repository or React types.

- [ ] **Step 1: Write failing pure-model tests**

```ts
it("normalizes case, whitespace, and NFKC-equivalent Unicode for database uniqueness", () => {
  expect(normalizeTaxonomyName("  SALSA  ")).toBe("salsa");
  expect(normalizeTaxonomyName("Ｓａｌｓａ")).toBe("salsa");
});

it("does not allow deleting a term with event usage", () => {
  expect(canDeleteTaxonomyTerm(1)).toBe(false);
  expect(canDeleteTaxonomyTerm(0)).toBe(true);
});

it("rejects an empty name and malformed slug", () => {
  expect(validateTaxonomyForm(blankForm)).toMatchObject({ name: "Enter a name" });
  expect(validateTaxonomyForm({ ...validForm, slug: "Salsa On2" })).toMatchObject({ slug: expect.any(String) });
});
```

- [ ] **Step 2: Run the focused tests to verify they fail**

Run: `npx vitest run src/features/admin/model/taxonomy.test.ts`

Expected: FAIL because the module and exports do not exist.

- [ ] **Step 3: Implement the model without React dependencies**

```ts
export type TaxonomyCategory = "dance_style" | "event_attribute";
export type TaxonomyStatus = "active" | "needs_review" | "archived";

export function normalizeTaxonomyName(name: string): string {
  return name.normalize("NFKC").trim().toLocaleLowerCase("en-US");
}

export function canDeleteTaxonomyTerm(usageCount: number): boolean {
  return usageCount === 0;
}
```

Define form/default/filter types explicitly; make `slugifyTaxonomyName` deterministic and reject an empty result. Keep URL parsing/serialization in this file so the page does not invent a second filter convention.

- [ ] **Step 4: Run focused tests to verify they pass**

Run: `npx vitest run src/features/admin/model/taxonomy.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the model boundary**

```bash
git add src/features/admin/model/taxonomy.ts src/features/admin/model/taxonomy.test.ts
git commit -m "feat: define taxonomy domain model"
```

## Task 3: Add repository and query hooks with cache-safe mutations

**Files:**
- Create: `src/features/admin/api/taxonomyRepo.ts`
- Create: `src/features/admin/api/taxonomyRepo.test.ts`
- Create: `src/features/admin/hooks/useAdminTaxonomy.ts`
- Create: `src/features/admin/hooks/useAdminTaxonomy.test.tsx`

**Interfaces:**
- Consumes: Task 2 types and SQL RPCs from Task 1.
- Produces: `fetchTaxonomyDirectory(filters)`, `fetchTaxonomyTerm(id)`, `searchActiveTaxonomyTerms(category, query)`, `createTaxonomyTerm(form)`, `updateTaxonomyTerm(id, form)`, `archiveTaxonomyTerm(id)`, `restoreTaxonomyTerm(id)`, `mergeTaxonomyTerms(keepId, mergeId)`, `deleteTaxonomyTerm(id)`; hooks `useAdminTaxonomy(filters)`, `useAdminTaxonomyTerm(id)`, `useActiveTaxonomyTerms(category)`.

- [ ] **Step 1: Write repository failure-path tests using the existing Supabase mock style**

```ts
it("uses the taxonomy directory RPC and surfaces its database error", async () => {
  mockedRpc.mockReturnValue({ data: null, error: { message: "forbidden" } });
  await expect(fetchTaxonomyDirectory(defaultFilters)).rejects.toThrow("Failed to load taxonomy terms: forbidden");
});

it("merges through the transactional RPC rather than client-side reassignment", async () => {
  await mergeTaxonomyTerms("keep-id", "source-id");
  expect(mockedRpc).toHaveBeenCalledWith("merge_taxonomy_terms", { p_keep_id: "keep-id", p_merge_id: "source-id" });
});
```

- [ ] **Step 2: Run focused repository tests to verify they fail**

Run: `npx vitest run src/features/admin/api/taxonomyRepo.test.ts`

Expected: FAIL because taxonomy repository exports do not exist.

- [ ] **Step 3: Implement one sole data-access module and hooks**

```ts
export async function fetchTaxonomyDirectory(filters: TaxonomyFilters): Promise<TaxonomyTerm[]> {
  const { data, error } = await supabase.rpc("admin_taxonomy_directory", {
    p_search: filters.search,
    p_category: filters.category,
    p_status: filters.status,
    p_view: filters.view,
  });
  if (error) throw new Error(`Failed to load taxonomy terms: ${error.message}`);
  return (data ?? []) as TaxonomyTerm[];
}
```

Use query keys `['admin', 'taxonomy', filters]`, `['admin', 'taxonomy-term', id]`, and `['admin', 'active-taxonomy', category]`. On every successful mutation invalidate all three prefixes as needed; merge invalidates the source and survivor detail keys. Keep event relationship replacement as a separately named repository function for Task 9.

- [ ] **Step 4: Run repository and hook tests**

Run: `npx vitest run src/features/admin/api/taxonomyRepo.test.ts src/features/admin/hooks/useAdminTaxonomy.test.tsx`

Expected: PASS; mutations invalidate the directory and active-term caches.

- [ ] **Step 5: Commit data access and cache behavior**

```bash
git add src/features/admin/api/taxonomyRepo.ts src/features/admin/api/taxonomyRepo.test.ts src/features/admin/hooks/useAdminTaxonomy.ts src/features/admin/hooks/useAdminTaxonomy.test.tsx
git commit -m "feat: add admin taxonomy data access"
```

## Task 4: Build reusable taxonomy status, form, and merge controls

**Files:**
- Create: `src/components/Admin/AdminTaxonomyStatusBadge.tsx`
- Create: `src/components/Admin/AdminTaxonomyStatusBadge.test.tsx`
- Create: `src/components/Admin/AdminTaxonomyForm.tsx`
- Create: `src/components/Admin/AdminTaxonomyForm.test.tsx`
- Create: `src/components/Admin/AdminMergeTaxonomyDialog.tsx`
- Create: `src/components/Admin/AdminMergeTaxonomyDialog.test.tsx`
- Create: component CSS files adjacent to each component where existing style patterns do so

**Interfaces:**
- Consumes: Task 2 model and Task 3 hook/mutation callback shapes; existing `AdminConfirmDialog` visual/focus conventions.
- Produces: form callback `onSubmit(form: TaxonomyForm)`, merge callback `onMerge({ keepId, mergeId }: { keepId: string; mergeId: string })`.

- [ ] **Step 1: Write failing RTL tests for accessible controls**

```tsx
it("names archived status in text, not color alone", () => {
  render(<AdminTaxonomyStatusBadge status="archived" />);
  expect(screen.getByText("Archived")).toBeVisible();
});

it("prevents submit and shows an inline error for an empty name", async () => {
  render(<AdminTaxonomyForm initial={blankForm} onSubmit={onSubmit} />);
  await userEvent.click(screen.getByRole("button", { name: "Save term" }));
  expect(await screen.findByText("Enter a name")).toBeVisible();
  expect(onSubmit).not.toHaveBeenCalled();
});

it("states merge impact and focuses the dialog heading", async () => {
  render(<AdminMergeTaxonomyDialog source={source} candidates={[keep]} sourceUsageCount={12} onMerge={onMerge} onClose={onClose} />);
  expect(screen.getByText("12 event relationships will move to Salsa.")).toBeVisible();
  expect(document.activeElement).toHaveAccessibleName("Merge taxonomy terms");
});
```

- [ ] **Step 2: Run component tests to verify they fail**

Run: `npx vitest run src/components/Admin/AdminTaxonomyStatusBadge.test.tsx src/components/Admin/AdminTaxonomyForm.test.tsx src/components/Admin/AdminMergeTaxonomyDialog.test.tsx`

Expected: FAIL because components do not exist.

- [ ] **Step 3: Implement minimal reusable controls**

Use existing semantic admin classes and token variables. The form must generate a slug only while the slug has not been manually changed, preserve saved slugs on label edit, disable category changes when `usageCount > 0`, and expose native labels/inputs. Merge must constrain choices to same-category terms, display an exact usage count, call `onMerge` only after confirmation, support Escape, trap focus, and restore focus to its trigger.

- [ ] **Step 4: Run component tests to verify they pass**

Run: `npx vitest run src/components/Admin/AdminTaxonomyStatusBadge.test.tsx src/components/Admin/AdminTaxonomyForm.test.tsx src/components/Admin/AdminMergeTaxonomyDialog.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit reusable controls**

```bash
git add src/components/Admin/AdminTaxonomyStatusBadge* src/components/Admin/AdminTaxonomyForm* src/components/Admin/AdminMergeTaxonomyDialog*
git commit -m "feat: add taxonomy admin controls"
```

## Task 5: Implement directory toolbar, table, responsive cards, and actions

**Files:**
- Create: `src/components/Admin/AdminTaxonomyToolbar.tsx`
- Create: `src/components/Admin/AdminTaxonomyToolbar.test.tsx`
- Create: `src/components/Admin/AdminTaxonomyTable.tsx`
- Create: `src/components/Admin/AdminTaxonomyTable.test.tsx`
- Create: component CSS files as needed

**Interfaces:**
- Consumes: `TaxonomyFilters`, `TaxonomyTerm`, status badge from Tasks 2/4, existing `AdminActionMenu` and `AdminViewTabs`.
- Produces: callbacks `onFiltersChange(next: TaxonomyFilters)`, `onArchive(id)`, `onRestore(id)`, `onDelete(id)`, `onMerge(id)`, and term detail links.

- [ ] **Step 1: Write failing list behavior tests**

```tsx
it("changes the selected category filter from the controlled select", async () => {
  render(<AdminTaxonomyToolbar filters={defaultFilters} onFiltersChange={onFiltersChange} />);
  await userEvent.selectOptions(screen.getByLabelText("Category"), "dance_style");
  expect(onFiltersChange).toHaveBeenCalledWith({ ...defaultFilters, category: "dance_style" });
});

it("renders usage with an accessible event count and disables delete for referenced terms", () => {
  render(<AdminTaxonomyTable terms={[salsaWithUsage]} {...handlers} />);
  expect(screen.getByLabelText("Used by 42 events")).toBeVisible();
  expect(screen.getByRole("menuitem", { name: "Delete Salsa" })).toHaveAttribute("aria-disabled", "true");
});

it("uses a mobile card container in addition to the desktop table", () => {
  render(<AdminTaxonomyTable terms={[unusedAttribute]} {...handlers} />);
  expect(screen.getByRole("table")).toBeInTheDocument();
  expect(screen.getByLabelText("Taxonomy terms mobile list")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run list tests to verify they fail**

Run: `npx vitest run src/components/Admin/AdminTaxonomyToolbar.test.tsx src/components/Admin/AdminTaxonomyTable.test.tsx`

Expected: FAIL because list components do not exist.

- [ ] **Step 3: Implement URL-driven controls and dual list layout**

Mirror `AdminUsersToolbar` debouncing and active-filter chips. Use view tabs All, Active, Dance Styles, Attributes, Unused, Needs Review, Archived. Render desktop headers Name/Category/Slug/Usage/Status/Updated/Actions, then a semantically labelled mobile-card list. Keep delete present but disabled with explanatory text when usage is nonzero; archive/restore wording reflects status. Use `within()` in tests to scope duplicate desktop/mobile names.

- [ ] **Step 4: Run list tests to verify they pass**

Run: `npx vitest run src/components/Admin/AdminTaxonomyToolbar.test.tsx src/components/Admin/AdminTaxonomyTable.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit the directory building blocks**

```bash
git add src/components/Admin/AdminTaxonomyToolbar* src/components/Admin/AdminTaxonomyTable*
git commit -m "feat: add taxonomy directory controls"
```

## Task 6: Wire routes, navigation, directory, create, and detail pages

**Files:**
- Create: `src/pages/AdminTagsPage.tsx`
- Create: `src/pages/AdminTagsPage.test.tsx`
- Create: `src/pages/AdminTaxonomyNewPage.tsx`
- Create: `src/pages/AdminTaxonomyNewPage.test.tsx`
- Create: `src/pages/AdminTaxonomyDetailPage.tsx`
- Create: `src/pages/AdminTaxonomyDetailPage.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/Admin/AdminSidebar.tsx`
- Modify: `src/layouts/AdminLayout.tsx`

**Interfaces:**
- Consumes: Tasks 3–5.
- Produces: protected routes `/admin/tags`, `/admin/tags/new`, `/admin/tags/:id`; navigation/breadcrumb labels.

- [ ] **Step 1: Write failing route/page tests**

```tsx
it("shows the tags directory and creates a navigable add-term route", async () => {
  renderAdminRoute("/admin/tags");
  expect(await screen.findByRole("heading", { name: "Tags & Taxonomy" })).toBeVisible();
  await userEvent.click(screen.getByRole("link", { name: "Add term" }));
  expect(await screen.findByRole("heading", { name: "Add taxonomy term" })).toBeVisible();
});

it("shows usage context before exposing destructive administration", async () => {
  renderAdminRoute("/admin/tags/salsa-id");
  expect(await screen.findByText("Used by 42 events")).toBeVisible();
  expect(screen.getByRole("button", { name: "Archive Salsa" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Delete Salsa" })).toBeDisabled();
});
```

- [ ] **Step 2: Run page tests to verify they fail**

Run: `npx vitest run src/pages/AdminTagsPage.test.tsx src/pages/AdminTaxonomyNewPage.test.tsx src/pages/AdminTaxonomyDetailPage.test.tsx`

Expected: FAIL because pages/routes are absent.

- [ ] **Step 3: Implement page shells and navigation cutover**

Add lazy imports and child routes in `App.tsx`. Change the sidebar Tags item to `{ group: 'Platform', label: 'Tags', icon: Tag, to: '/admin/tags', built: true }`. Add `/admin/tags` to `SECTION_LABEL` and make nested tag paths resolve to “Tags”.

`AdminTagsPage` owns `URLSearchParams` → `TaxonomyFilters` conversion and passes query state to the toolbar/table. `AdminTaxonomyNewPage` redirects to `/admin/tags/:id` after create. `AdminTaxonomyDetailPage` handles loading/not-found/error state, shows metadata/usage/related-event link, and composes archive/restore/delete confirmation plus merge dialog. Never optimistically claim a merge or delete succeeded before its mutation returns.

- [ ] **Step 4: Run page tests to verify they pass**

Run: `npx vitest run src/pages/AdminTagsPage.test.tsx src/pages/AdminTaxonomyNewPage.test.tsx src/pages/AdminTaxonomyDetailPage.test.tsx src/components/Admin/AdminSidebar.test.tsx src/layouts/AdminLayout.test.tsx`

Expected: PASS; Tags is no longer marked “Soon”.

- [ ] **Step 5: Commit routes and page behavior**

```bash
git add src/App.tsx src/components/Admin/AdminSidebar.tsx src/layouts/AdminLayout.tsx src/pages/AdminTagsPage* src/pages/AdminTaxonomyNewPage* src/pages/AdminTaxonomyDetailPage*
git commit -m "feat: add taxonomy management pages"
```

## Task 7: Replace event dance-style arrays with persisted taxonomy relationships

**Files:**
- Modify: `src/features/events/model/types.ts`
- Modify: `src/features/admin/model/adminEventForm.ts`
- Modify: `src/features/admin/model/adminEventForm.test.ts`
- Modify: `src/features/events/api/eventsRepo.ts`
- Modify: `src/features/events/api/eventsRepo.test.ts`
- Modify: `src/features/admin/api/taxonomyRepo.ts`
- Modify: `src/features/admin/api/taxonomyRepo.test.ts`

**Interfaces:**
- Consumes: SQL join table (Task 1), `TaxonomyTerm` and active-term query (Tasks 2/3).
- Produces: `taxonomy_term_ids: string[]` form/payload contract; `replaceEventTaxonomyTerms(eventId, termIds)` with exact-set semantics.

- [ ] **Step 1: Write failing contract tests for exact relationship replacement**

```ts
it("maps selected taxonomy term IDs into the admin event payload", () => {
  expect(adminFormToPayload({ ...form, taxonomy_term_ids: ["salsa-id", "outdoor-id"] })).toMatchObject({
    taxonomy_term_ids: ["salsa-id", "outdoor-id"],
  });
});

it("replaces the complete event relationship set without retaining deselected terms", async () => {
  await replaceEventTaxonomyTerms("event-id", ["salsa-id"]);
  expect(mockedRpc).toHaveBeenCalledWith("replace_event_taxonomy_terms", {
    p_event_id: "event-id",
    p_taxonomy_term_ids: ["salsa-id"],
  });
});
```

- [ ] **Step 2: Run focused contract tests to verify they fail**

Run: `npx vitest run src/features/admin/model/adminEventForm.test.ts src/features/events/api/eventsRepo.test.ts src/features/admin/api/taxonomyRepo.test.ts`

Expected: FAIL because the legacy dance-style contract is still present.

- [ ] **Step 3: Implement clean storage-contract cutover**

Add `replace_event_taxonomy_terms(p_event_id uuid, p_taxonomy_term_ids uuid[])` to `002_create_event_taxonomy_terms.sql`: validate every term exists and is active or already attached historical data, delete join rows absent from the exact supplied set, and insert supplied rows with `on conflict do nothing` in one transaction.

Replace `dance_styles: string[]` in admin form/type/payload contracts with `taxonomy_term_ids: string[]`. Update event creation/update mutations so an event write completes before its relationship RPC runs; if relationship persistence fails, surface an error and preserve the event mutation state for retry rather than silently saving partial selected terms. Remove every production `DANCE_STYLE_OPTIONS` usage and array writer; no compatibility alias is retained.

- [ ] **Step 4: Run focused tests to verify they pass**

Run: `npx vitest run src/features/admin/model/adminEventForm.test.ts src/features/events/api/eventsRepo.test.ts src/features/admin/api/taxonomyRepo.test.ts`

Expected: PASS; event payloads no longer expose `dance_styles`.

- [ ] **Step 5: Commit the data contract cutover**

```bash
git add src/features/events/model/types.ts src/features/admin/model/adminEventForm.ts src/features/admin/model/adminEventForm.test.ts src/features/events/api/eventsRepo.ts src/features/events/api/eventsRepo.test.ts src/features/admin/api/taxonomyRepo.ts src/features/admin/api/taxonomyRepo.test.ts sql/phase-10/002_create_event_taxonomy_terms.sql
git commit -m "feat: persist event taxonomy relationships"
```

## Task 8: Replace hard-coded event editor options with controlled taxonomy selectors

**Files:**
- Modify: `src/components/Admin/AdminEventForm.tsx`
- Modify: `src/components/Admin/AdminEventForm.test.tsx` (create if absent)
- Modify: `src/components/Admin/AdminEventForm.css`

**Interfaces:**
- Consumes: `useActiveTaxonomyTerms('dance_style')`, `useActiveTaxonomyTerms('event_attribute')`, and `taxonomy_term_ids` from Task 7.
- Produces: selected term IDs via the existing `onSubmit(AdminEventFormValues)` callback.

- [ ] **Step 1: Write failing event-editor tests**

```tsx
it("renders active dance style terms from the taxonomy query, not a constant", async () => {
  render(<AdminEventForm {...props} />);
  expect(await screen.findByRole("checkbox", { name: "Salsa" })).toBeChecked();
  expect(screen.queryByRole("checkbox", { name: "Archived Mambo" })).not.toBeInTheDocument();
});

it("submits selected dance styles and attributes as taxonomy IDs", async () => {
  render(<AdminEventForm {...props} />);
  await userEvent.click(await screen.findByRole("checkbox", { name: "Outdoor" }));
  await userEvent.click(screen.getByRole("button", { name: "Save event" }));
  expect(props.onSubmit).toHaveBeenCalledWith(expect.objectContaining({ taxonomy_term_ids: ["salsa-id", "outdoor-id"] }));
});
```

- [ ] **Step 2: Run the component test to verify it fails**

Run: `npx vitest run src/components/Admin/AdminEventForm.test.tsx`

Expected: FAIL because hard-coded dance-style checkboxes and `dance_styles` remain.

- [ ] **Step 3: Implement term-driven controls**

Use separate labelled fieldsets for Dance Styles and Event Attributes. Provide loading/error/empty states; an empty active category must state “No active dance styles available” rather than invite free text. Keep native checkboxes or an existing accessible multi-select pattern; do not add a custom combobox dependency solely for this phase. The Create Term escape hatch is a link to `/admin/tags/new?category=dance_style` for admins, not a silent inline record creator. Show selected terms by ID against the active-term data and retain archived existing attachments visibly for historical edit state without offering archived terms as new selections.

- [ ] **Step 4: Run event-editor tests to verify they pass**

Run: `npx vitest run src/components/Admin/AdminEventForm.test.tsx src/features/admin/model/adminEventForm.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit controlled event selection**

```bash
git add src/components/Admin/AdminEventForm.tsx src/components/Admin/AdminEventForm.test.tsx src/components/Admin/AdminEventForm.css
git commit -m "feat: use taxonomy terms in event editor"
```

## Task 9: Add moderation mapping without changing original submissions

**Files:**
- Modify: `src/features/admin/api/submissionsRepo.ts`
- Modify: `src/features/admin/api/submissionsRepo.test.ts`
- Modify: `src/hooks/useAdminSubmissions.ts`
- Modify: `src/pages/Admin/AdminSubmissionsPage.tsx`
- Modify: `src/pages/Admin/AdminSubmissionsPage.test.tsx`
- Modify: `src/pages/Admin/AdminSubmissionDetailPage.tsx`
- Modify: `src/pages/Admin/AdminSubmissionDetailPage.test.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `useActiveTaxonomyTerms` and `replaceEventTaxonomyTerms` from Tasks 3/7.
- Produces: `approveSubmissionWithTaxonomy({ submissionId, taxonomyTermIds })`; protected moderation routes `/admin/submissions` and `/admin/submissions/:id`; moderator-selected canonical `taxonomy_term_ids` applied only during approval.

- [ ] **Step 1: Write failing preservation and routing tests**

```tsx
it("navigates a reviewer from the submissions table to a detail page", async () => {
  renderAdminRoute("/admin/submissions");
  await userEvent.click(await screen.findByRole("menuitem", { name: "View Details" }));
  expect(await screen.findByRole("heading", { name: /Submission / })).toBeVisible();
});

it("uses moderator edits for the approved event while preserving submitted source text", async () => {
  const submission = submissionWithRawStyle("salsa on 2", {
    title: "Original Salsa Night",
    event_date: "2026-09-01",
  }, {
    title: "Corrected Salsa Night",
    event_date: "2026-09-08",
  });
  renderAdminRoute("/admin/submissions/submission-id", { submission });
  await userEvent.click(await screen.findByRole("checkbox", { name: "Salsa On2" }));
  await userEvent.click(screen.getByRole("button", { name: "Approve submission" }));
  expect(mockedApprove).toHaveBeenCalledWith({
    submissionId: "submission-id",
    taxonomyTermIds: ["salsa-on2-id"],
  });
  expect(mockedApprovedEvent).toMatchObject({
    title: "Corrected Salsa Night",
    event_date: "2026-09-08",
  });
  expect(mockedSubmissionUpdate.submitted_data).toMatchObject({
    title: "Original Salsa Night",
    event_date: "2026-09-01",
  });
});
```

- [ ] **Step 2: Run focused moderation tests to verify they fail**

Run: `npx vitest run src/pages/Admin/AdminSubmissionsPage.test.tsx src/pages/Admin/AdminSubmissionDetailPage.test.tsx src/features/admin/api/submissionsRepo.test.ts`

Expected: FAIL because the route has no detail mapping flow and approval persists only a status.

- [ ] **Step 3: Implement approval-time canonical mapping**

Add `approveSubmissionWithTaxonomy` to `submissionsRepo`; it calls `approve_event_submission` with the submission ID and selected term IDs. The database function—not a sequence of browser writes—creates the approved event, inserts its relationships, and updates submission status/approval metadata atomically. Expose it from `useAdminSubmissions` as a mutation that invalidates both `['submissions']` and taxonomy/event query keys on success.

Change `AdminSubmissionsPage` “View Details” to navigate to `/admin/submissions/:id`; do not directly approve from the table because mapping must happen in the detail flow. Update `AdminSubmissionDetailPage` to show raw submitted style text as read-only source context plus active canonical dance-style checkboxes. Its approve action invokes `approveSubmissionWithTaxonomy`; it never mutates `submitted_data`. Add the `submissions/:id` child route in `App.tsx` and replace the current `/admin/submissions` alias to `AdminEventsPage` with the existing submissions page.

If a legacy submission's `submitted_data` lacks `dance_styles`, show “No dance styles were supplied” and still permit no-term approval; do not invent a source-history field or aliases.

- [ ] **Step 4: Run focused moderation tests to verify they pass**

Run: `npx vitest run src/pages/Admin/AdminSubmissionsPage.test.tsx src/pages/Admin/AdminSubmissionDetailPage.test.tsx src/features/admin/api/submissionsRepo.test.ts`

Expected: PASS; source submission text is unchanged and event taxonomy relationships are persisted only on approval.

- [ ] **Step 5: Commit submission moderation integration**

```bash
git add src/features/admin/api/submissionsRepo.ts src/features/admin/api/submissionsRepo.test.ts src/hooks/useAdminSubmissions.ts src/pages/Admin/AdminSubmissionsPage.tsx src/pages/Admin/AdminSubmissionsPage.test.tsx src/pages/Admin/AdminSubmissionDetailPage.tsx src/pages/Admin/AdminSubmissionDetailPage.test.tsx src/App.tsx
git commit -m "feat: map submissions to taxonomy terms"
```

## Task 10: Run final integration verification and document manual SQL order

**Files:**
- Modify: `Docs/plans/phase10-tags-taxonomy-management.md` only if implementation reveals a material approved-spec correction; otherwise leave unchanged.
- Verify: source/tests/SQL/browser behavior.

**Interfaces:**
- Consumes: all prior tasks.
- Produces: evidence that SQL delivery is separate and application behavior is complete.

- [ ] **Step 1: Run all focused Phase 10 tests**

Run:

```bash
npx vitest run \
  src/features/admin/model/taxonomy.test.ts \
  src/features/admin/api/taxonomyRepo.test.ts \
  src/features/admin/hooks/useAdminTaxonomy.test.tsx \
  src/components/Admin/AdminTaxonomyStatusBadge.test.tsx \
  src/components/Admin/AdminTaxonomyForm.test.tsx \
  src/components/Admin/AdminMergeTaxonomyDialog.test.tsx \
  src/components/Admin/AdminTaxonomyToolbar.test.tsx \
  src/components/Admin/AdminTaxonomyTable.test.tsx \
  src/pages/AdminTagsPage.test.tsx \
  src/pages/AdminTaxonomyNewPage.test.tsx \
  src/pages/AdminTaxonomyDetailPage.test.tsx \
  src/components/Admin/AdminEventForm.test.tsx
```

Expected: PASS.

- [ ] **Step 2: Run project gates**

Run:

```bash
npx tsc --noEmit
npm run lint
npm run test
npm run build
```

Expected: each exits 0; lint emits zero warnings.

- [ ] **Step 3: Browser-smoke the actual admin surface**

Run: `npm run dev`, then authenticate using the local admin workflow and browser-drive:

1. `/admin/tags`: search, category/status/view filtering, desktop table and mobile viewport card layout.
2. `/admin/tags/new`: create a non-conflicting test term; verify generated slug and return to detail.
3. `/admin/tags/:id`: verify usage label, archive/restore, disabled delete for referenced term, and merge confirmation consequence text.
4. `/admin/events`: verify only active taxonomy terms are offered; select a dance style and attribute; save/reload; verify selections persist.
5. `/admin/submissions`: verify a moderator can map canonical terms while original submitted text remains unchanged.

Expected: every interaction completes without console errors; keyboard Tab/Escape behavior works for menus/dialogs; Light/Dark/System visuals remain token-driven.

- [ ] **Step 4: Verify manual SQL delivery and state execution order in handoff**

Run: `grep -nE "OPTIONAL AND DESTRUCTIVE|drop column|insert into public.event_taxonomy_terms|merge_taxonomy_terms|approve_event_submission" sql/phase-10/*.sql`

Expected: `005_remove_events_dance_styles.sql` is the only destructive cleanup; no source applies production SQL automatically.

Report execution order exactly: `001_create_taxonomy_terms.sql` → `002_create_event_taxonomy_terms.sql` → `003_seed_taxonomy_terms.sql` → `004_migrate_event_dance_styles.sql` → deploy application → manually validate counts and admin/event workflows → optional `005_remove_events_dance_styles.sql`.

- [ ] **Step 5: Commit any verification-only documentation correction**

```bash
git add Docs/plans/phase10-tags-taxonomy-management.md
git commit -m "docs: clarify Phase 10 taxonomy rollout"
```

Only perform this commit when the document actually changed. Do not create an empty commit.

## Plan self-review

- **Spec coverage:** Tasks 1–3 cover normalized schema, constraints, SQL separation, seed/migration/cleanup and access boundaries. Tasks 4–6 cover all three admin routes, management UX, filters, status, usage, merge/archive/delete, navigation, mobile, theme/accessibility. Tasks 7–8 remove free-form arrays and integrate controlled terms into the event editor. Task 9 maps moderation choices without rewriting submission history. Task 10 verifies behavior and repeats the manual SQL order/safety boundary.
- **Intentional boundaries:** event type remains direct; parent schema is supported without hierarchy UI; aliases, redirects, organizer relations, public pages, and Settings remain excluded.
- **Consistency:** all task interfaces use `TaxonomyTerm`, `TaxonomyForm`, `taxonomy_term_ids`, `replaceEventTaxonomyTerms`, `useActiveTaxonomyTerms`, and `mergeTaxonomyTerms` consistently.
- **Completeness:** every task names concrete repository files and commands; the moderation task uses `src/pages/Admin/AdminSubmissionsPage.tsx` and `src/pages/Admin/AdminSubmissionDetailPage.tsx`, the existing Phase 7 surfaces.
