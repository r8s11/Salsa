# Admin Shell Theme System & Sidebar Collapse Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the two real gaps identified in `Docs/plans/phase1-admin-shell-revision.md`: a light/dark/system theme system with persisted preference, and a user-triggered sidebar collapse — plus the semantic token rename and hardcoded-hex sweep that both depend on, an Appearance/Account account-menu extension, and a minimal toast component.

**Architecture:** A `ThemeContext` (mirrors the existing `CityContext` pattern exactly) resolves `light|dark|system` to an effective theme, writes `data-theme` on `.admin-shell`, and persists to `localStorage`. Every `--admin-*` custom property in `admin.css` is renamed to the brief's semantic vocabulary and gets a `.admin-shell[data-theme="dark"]` override block with real (not inverted) dark values. Every hardcoded hex color found in the audit (status/role badges, popovers, topbar translucency, one broken CSS-var fallback) is replaced with a token reference. Sidebar collapse is a third, user-controlled width state reusing the existing ≥768px icon-rail CSS as its visual, gated to ≥1024px, persisted the same way as theme.

**Tech Stack:** React 19, TypeScript, Vite, CSS custom properties (no CSS-in-JS, no Tailwind — this codebase hand-writes scoped `.css` files per component).

## Global Constraints

- No new database table — `localStorage` only (`admin-theme`, `admin-sidebar-collapsed`), per the design doc's explicit Decision.
- Token rename is a clean cutover: every `--admin-bg`/`--admin-surface-subtle`/`--admin-surface-high`/`--admin-primary`/etc. reference across every `.css` file must be updated to its new name in the same pass that renames the definition — no file may reference an old name after this plan lands, and no dual-naming aliases are kept.
- Dark theme values are considered, not derived by inverting/filtering light values (no `filter: invert()`, no mechanical lightness-flip) — see the design doc §14 for exact values to use.
- Every component this plan touches must keep working identically in light mode after the rename — this is a rename-and-extend, not a redesign; no visual change to any existing light-mode screen.
- Match existing code style exactly (scoped `.admin-shell` selectors, `admin-<component>__<part>` class naming, native `<details>` for disclosures per the codebase's existing account-menu pattern).
- Run only the specific test file(s) named in each task's steps while executing tasks — full-suite `npx vitest run`, `npm run build`, and `npm run lint` run once, at the very end (the final task), not per task.
- `prefers-reduced-motion` must continue to be respected wherever this plan adds or touches a CSS transition (the existing `admin.css` reduced-motion block for the skeleton shimmer is the pattern to extend, not replace).

---

## File Structure

| File | Responsibility |
|---|---|
| `src/contexts/themeContextObject.ts` | `ThemeContext` + `ThemeContextValue` type (mirrors `cityContextObject.ts`) |
| `src/contexts/ThemeContext.tsx` | `ThemeProvider` — resolves `system` via `matchMedia`, persists to `localStorage`, writes `data-theme` |
| `src/contexts/useTheme.ts` | `useTheme()` hook (mirrors `useCity.ts`) |
| `src/contexts/ThemeContext.test.tsx` | Tests for resolution logic and persistence |
| `src/app/providers.tsx` | Modified — `ThemeProvider` joins the provider stack |
| `src/styles/admin.css` | Modified — token rename, dark override block, hardcoded-hex sweep for badges/skeleton |
| `src/components/Admin/AdminActionMenu.css`, `AdminEventForm.css`, `AdminEventsTable.css`, `AdminUsersTable.css`, `AdminEventsToolbar.css`, `AdminUsersToolbar.css`, `AdminPagination.css` | Modified — remaining hardcoded-hex sweep |
| `src/layouts/AdminLayout.css` | Modified — topbar/drawer-backdrop translucency tokens, Appearance submenu styles |
| `src/layouts/AdminLayout.tsx` | Modified — Appearance submenu markup + wiring |
| `src/components/Admin/AdminSidebar.tsx` / `.css` | Modified — collapse toggle, collapsed state, tooltips, attention-count support (count plumbing only — no real counts wired yet, since `/admin/submissions` doesn't exist; the prop is added and unused until Phase 7) |
| `src/components/Admin/AdminToast.tsx` / `.css` | New — minimal toast component |
| `src/layouts/AdminLayout.test.tsx`, `src/components/Admin/AdminSidebar.test.tsx` (new) | Tests for the new behaviors |

---

### Task 1: `ThemeContext` — provider, hook, resolution logic

**Files:**
- Create: `src/contexts/themeContextObject.ts`
- Create: `src/contexts/ThemeContext.tsx`
- Create: `src/contexts/useTheme.ts`
- Create: `src/contexts/ThemeContext.test.tsx`
- Modify: `src/app/providers.tsx`

**Interfaces:**
- Produces: `export type Theme = "light" | "dark" | "system";` and `export interface ThemeContextValue { theme: Theme; effectiveTheme: "light" | "dark"; setTheme: (theme: Theme) => void; }` (`themeContextObject.ts`); `export function ThemeProvider({ children }: { children: ReactNode })` (`ThemeContext.tsx`); `export function useTheme(): ThemeContextValue` (`useTheme.ts`).
- Consumes: nothing new — mirrors `CityContext.tsx`/`cityContextObject.ts`/`useCity.ts` exactly in shape.

- [ ] **Step 1: Write the failing tests first**

`src/contexts/ThemeContext.test.tsx`:

```tsx
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ThemeProvider } from "./ThemeContext";
import { useTheme } from "./useTheme";

function TestConsumer() {
  const { theme, effectiveTheme, setTheme } = useTheme();
  return (
    <div>
      <p data-testid="theme">{theme}</p>
      <p data-testid="effective">{effectiveTheme}</p>
      <button onClick={() => setTheme("dark")}>dark</button>
      <button onClick={() => setTheme("light")}>light</button>
      <button onClick={() => setTheme("system")}>system</button>
    </div>
  );
}

function mockMatchMedia(prefersDark: boolean) {
  const listeners: ((event: MediaQueryListEvent) => void)[] = [];
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query === "(prefers-color-scheme: dark)" ? prefersDark : false,
    media: query,
    addEventListener: (_: string, listener: (event: MediaQueryListEvent) => void) => {
      listeners.push(listener);
    },
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
  return {
    fireChange: (matches: boolean) =>
      listeners.forEach((listener) => listener({ matches } as MediaQueryListEvent)),
  };
}

describe("ThemeProvider", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    document.documentElement.removeAttribute("data-theme");
    const shell = document.querySelector(".admin-shell");
    shell?.removeAttribute("data-theme");
  });

  it("defaults to system when nothing is stored, resolving via matchMedia", () => {
    mockMatchMedia(true);
    render(<ThemeProvider><TestConsumer /></ThemeProvider>);
    expect(screen.getByTestId("theme")).toHaveTextContent("system");
    expect(screen.getByTestId("effective")).toHaveTextContent("dark");
  });

  it("reads a previously persisted explicit theme from localStorage", () => {
    window.localStorage.setItem("admin-theme", "light");
    mockMatchMedia(true);
    render(<ThemeProvider><TestConsumer /></ThemeProvider>);
    expect(screen.getByTestId("theme")).toHaveTextContent("light");
    expect(screen.getByTestId("effective")).toHaveTextContent("light");
  });

  it("ignores an invalid stored value and falls back to system", () => {
    window.localStorage.setItem("admin-theme", "not-a-real-theme");
    mockMatchMedia(false);
    render(<ThemeProvider><TestConsumer /></ThemeProvider>);
    expect(screen.getByTestId("theme")).toHaveTextContent("system");
  });

  it("setTheme updates state, persists to localStorage, and updates effectiveTheme", () => {
    mockMatchMedia(false);
    render(<ThemeProvider><TestConsumer /></ThemeProvider>);
    fireEvent.click(screen.getByText("dark"));
    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
    expect(screen.getByTestId("effective")).toHaveTextContent("dark");
    expect(window.localStorage.getItem("admin-theme")).toBe("dark");
  });

  it("live-updates effectiveTheme when the OS preference changes while theme is system", () => {
    const { fireChange } = mockMatchMedia(false);
    render(<ThemeProvider><TestConsumer /></ThemeProvider>);
    expect(screen.getByTestId("effective")).toHaveTextContent("light");
    fireChange(true);
    expect(screen.getByTestId("effective")).toHaveTextContent("dark");
  });

  it("useTheme throws when used outside ThemeProvider", () => {
    const ConsumerOnly = () => {
      useTheme();
      return null;
    };
    // Suppress the expected React error-boundary console noise for this one assertion.
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<ConsumerOnly />)).toThrow("useTheme must be used inside <ThemeProvider>");
    spy.mockRestore();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/r8s/code/Salsa && npx vitest run src/contexts/ThemeContext.test.tsx`
Expected: FAIL — none of the three files exist yet.

- [ ] **Step 3: Implement `themeContextObject.ts`**

```ts
import { createContext } from "react";

export type Theme = "light" | "dark" | "system";

export interface ThemeContextValue {
  theme: Theme;
  effectiveTheme: "light" | "dark";
  setTheme: (theme: Theme) => void;
}

export const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);
```

- [ ] **Step 4: Implement `useTheme.ts`**

```ts
import { useContext } from "react";
import { ThemeContext, type ThemeContextValue } from "./themeContextObject";

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error("useTheme must be used inside <ThemeProvider>");
  }
  return ctx;
}
```

- [ ] **Step 5: Implement `ThemeContext.tsx`**

```tsx
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { ThemeContext, type Theme } from "./themeContextObject";

const STORAGE_KEY = "admin-theme";
const VALID: readonly Theme[] = ["light", "dark", "system"];

function readStoredTheme(): Theme {
  if (typeof window === "undefined") return "system";
  const stored = window.localStorage.getItem(STORAGE_KEY);
  return VALID.includes(stored as Theme) ? (stored as Theme) : "system";
}

function prefersDark(): boolean {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme);
  const [systemPrefersDark, setSystemPrefersDark] = useState(prefersDark);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (event: MediaQueryListEvent) => setSystemPrefersDark(event.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  const effectiveTheme: "light" | "dark" =
    theme === "system" ? (systemPrefersDark ? "dark" : "light") : theme;

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, theme);
  }, [theme]);

  useEffect(() => {
    const shell = document.querySelector(".admin-shell");
    shell?.setAttribute("data-theme", effectiveTheme);
  }, [effectiveTheme]);

  const setTheme = useCallback((next: Theme) => setThemeState(next), []);

  return (
    <ThemeContext.Provider value={{ theme, effectiveTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd /home/r8s/code/Salsa && npx vitest run src/contexts/ThemeContext.test.tsx`
Expected: PASS, all 6 tests green.

- [ ] **Step 7: Wire `ThemeProvider` into the app**

In `src/app/providers.tsx`, add the import and wrap `children` with it, outermost among the app's own contexts (it should wrap everything, matching the design doc's "app-wide, not admin-scoped" decision) but inside `StrictMode`/`QueryClientProvider`:

```tsx
import { ThemeProvider } from "../contexts/ThemeContext";
```

and change the return to:

```tsx
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <CityProvider>
              {children}
            </CityProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </StrictMode>
```

- [ ] **Step 8: Run tsc**

Run: `cd /home/r8s/code/Salsa && npx tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 9: Commit**

```bash
cd /home/r8s/code/Salsa
git add src/contexts/themeContextObject.ts src/contexts/ThemeContext.tsx src/contexts/useTheme.ts src/contexts/ThemeContext.test.tsx src/app/providers.tsx
git commit -m "Add ThemeContext: light/dark/system resolution, localStorage persistence"
```

---

### Task 2: Token rename + dark theme override block in `admin.css`

**Files:**
- Modify: `src/styles/admin.css` (root token block, every `var(--admin-*)` reference within this file, new dark override block)

**Interfaces:**
- Produces: every token below, defined once under `.admin-shell` (light values) and overridden once under `.admin-shell[data-theme="dark"]` (dark values). This is the vocabulary every later task in this plan (and every existing `.css` file, updated in Tasks 3–4) references.

- [ ] **Step 1: Replace the root token block**

In `src/styles/admin.css`, replace the current token block (lines 7-42: `.admin-shell { --admin-bg: ...; ... }`) with:

```css
.admin-shell {
  --admin-background: #f8fafc;
  --admin-surface: #ffffff;
  --admin-surface-elevated: #ffffff;
  --admin-surface-secondary: #f1f5f9;
  --admin-text-primary: #0f172a;
  --admin-text-secondary: #64748b;
  --admin-text-muted: #64748b;
  --admin-text-subtle: #94a3b8;
  --admin-nav-text: #475569;
  --admin-brand: #e11d48;
  --admin-brand-hover: #be123c;
  --admin-brand-tint: rgba(225, 29, 72, 0.04);
  --admin-brand-ring: rgba(225, 29, 72, 0.5);
  --admin-danger: #dc2626;
  --admin-danger-strong: #b91c1c;
  --admin-danger-tint: #fef2f2;
  --admin-danger-border: #fecaca;
  --admin-success: #047857;
  --admin-success-strong: #10b981;
  --admin-success-tint: #ecfdf5;
  --admin-success-border: #a7f3d0;
  --admin-warning: #b45309;
  --admin-warning-tint: #fffbeb;
  --admin-warning-dot: #f59e0b;
  --admin-warning-border: #fde68a;
  --admin-information: #4338ca;
  --admin-information-tint: #eef2ff;
  --admin-information-border: #c7d2fe;
  --admin-border: #e2e8f0;
  --admin-border-md: #cbd5e1;
  --admin-divider: #e2e8f0;
  --admin-overlay: rgba(15, 23, 42, 0.5);
  --admin-topbar-bg: rgba(255, 255, 255, 0.9);
  --admin-skeleton-highlight: #e9eef5;
  --admin-radius: 8px;
  --admin-radius-lg: 12px;
  --admin-sidebar-w: 260px;
  --admin-rail-w: 72px;
  --admin-header-h: 64px;
  --admin-content-max: 1440px;
  --admin-shadow-sm: 0 1px 2px rgba(15, 23, 42, 0.06);
  --admin-shadow-md: 0 4px 12px rgba(15, 23, 42, 0.08);

  background: var(--admin-background);
  color: var(--admin-text-primary);
  font-family: var(--font-body);
  min-height: 100vh;
}

.admin-shell[data-theme="dark"] {
  --admin-background: #0f1115;
  --admin-surface: #171a20;
  --admin-surface-elevated: #1e2229;
  --admin-surface-secondary: #20242c;
  --admin-text-primary: #f1f5f9;
  --admin-text-secondary: #94a3b8;
  --admin-text-muted: #94a3b8;
  --admin-text-subtle: #64748b;
  --admin-nav-text: #cbd5e1;
  --admin-brand: #e11d48;
  --admin-brand-hover: #f43f5e;
  --admin-brand-tint: rgba(225, 29, 72, 0.12);
  --admin-brand-ring: rgba(225, 29, 72, 0.6);
  --admin-danger: #f87171;
  --admin-danger-strong: #fca5a5;
  --admin-danger-tint: rgba(220, 38, 38, 0.14);
  --admin-danger-border: rgba(248, 113, 113, 0.35);
  --admin-success: #34d399;
  --admin-success-strong: #10b981;
  --admin-success-tint: rgba(16, 185, 129, 0.14);
  --admin-success-border: rgba(52, 211, 153, 0.35);
  --admin-warning: #fbbf24;
  --admin-warning-tint: rgba(245, 158, 11, 0.14);
  --admin-warning-dot: #f59e0b;
  --admin-warning-border: rgba(251, 191, 36, 0.35);
  --admin-information: #818cf8;
  --admin-information-tint: rgba(99, 102, 241, 0.14);
  --admin-information-border: rgba(129, 140, 248, 0.35);
  --admin-border: rgba(255, 255, 255, 0.08);
  --admin-border-md: rgba(255, 255, 255, 0.14);
  --admin-divider: rgba(255, 255, 255, 0.08);
  --admin-overlay: rgba(0, 0, 0, 0.6);
  --admin-topbar-bg: rgba(23, 26, 32, 0.9);
  --admin-skeleton-highlight: #262b34;
  --admin-shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);
  --admin-shadow-md: 0 4px 12px rgba(0, 0, 0, 0.4);
}
```

(Note: `--admin-text-secondary` and `--admin-text-muted` are intentionally identical values in both themes — the design doc's token list names both, but the current codebase only ever needed one "muted" concept; keep both names defined identically so every existing `var(--admin-text-muted)` call site keeps working without a second rename pass, while `--admin-text-secondary` exists for any new code Task 5+ writes. Do not deduplicate this in this task — it is deliberate, not an oversight.)

- [ ] **Step 2: Update every `var(--admin-*)` reference within `admin.css` itself to the new names**

Read the full current `src/styles/admin.css` (549 lines) and replace every occurrence of the following old token names with their new equivalents, throughout the file (buttons, cards, fields, status/role/account-status badges, skeleton):

| Old | New |
|---|---|
| `--admin-bg` | `--admin-background` |
| `--admin-surface-subtle` | `--admin-surface-secondary` |
| `--admin-surface-high` | `--admin-surface-secondary` |
| `--admin-text` | `--admin-text-primary` |
| `--admin-text-strong` | `--admin-text-primary` |
| `--admin-primary` | `--admin-brand` |
| `--admin-primary-hover` | `--admin-brand-hover` |
| `--admin-primary-tint` | `--admin-brand-tint` |
| `--admin-primary-ring` | `--admin-brand-ring` |
| `--admin-attention-tint` | `--admin-warning-tint` |
| `--admin-attention-ink` | `--admin-warning` |
| `--admin-attention-dot` | `--admin-warning-dot` |
| `--admin-positive-tint` | `--admin-success-tint` |
| `--admin-positive-ink` | `--admin-success` |

(`--admin-surface` and `--admin-danger`/`--admin-danger-tint` keep their names — only the ones in the table above change. `--admin-text-strong` and `--admin-text` BOTH map to the new single `--admin-text-primary` — this is an intentional consolidation the design doc's token list implies, since the old codebase had two near-identical "strong text" tokens with no real distinction; verify nothing depended on them actually differing before collapsing, by checking whether `--admin-text` and `--admin-text-strong` were ever set to different literal values anywhere — they were not, both were `#0f172a`/`#1e293b` respectively in the old block, which ARE different. Re-check: `--admin-text: #0f172a` and `--admin-text-strong: #1e293b` are two distinct near-black shades. Do NOT collapse them — instead map `--admin-text` → `--admin-text-primary` (`#0f172a`) and keep `--admin-text-strong` as its own token, added to the new list as `--admin-text-strong: #1e293b` in both the light block and a dark equivalent `#ffffff`. Add this one extra token to Step 1's block that isn't in the design doc's own list — the design doc's token list was written before this exact discrepancy was noticed; this is a legitimate, small correction to make during implementation, not a deviation to ask about.)

Additionally replace the two literal hex values still inline in this file after Step 1 removes them from the root block:
- Skeleton gradient (`admin-shell .admin-skeleton`, currently `#e9eef5` mid-stop) → `var(--admin-skeleton-highlight)`.
- Status badge block (lines ~433-467 in the pre-edit file): `#ecfdf5`→`var(--admin-success-tint)`, `#047857`→`var(--admin-success)`, `#a7f3d0`→`var(--admin-success-border)`, `#10b981`→`var(--admin-success-strong)`, `#fde68a`→`var(--admin-warning-border)`, `#fef2f2`→`var(--admin-danger-tint)`, `#b91c1c`→`var(--admin-danger-strong)`, `#fecaca`→`var(--admin-danger-border)`.
- Role badge block (lines ~469-511): `#4338ca`→`var(--admin-information)`, `#c7d2fe`→`var(--admin-information-border)`, `#eef2ff`→`var(--admin-information-tint)`, `#fecdd3`→`var(--admin-danger-border)` (the admin-role pill's border was visually a pink/rose tint distinct from the danger palette in the original design — reuse `--admin-danger-border` since it's the closest existing token and the visual difference is negligible; do not invent a new one-off token for a single border color).
- Account status badge block (lines ~513-549): same hex-to-token mapping as the status badge block above (`#10b981`→`--admin-success-strong`, `#ecfdf5`→`--admin-success-tint`, `#047857`→`--admin-success`, `#a7f3d0`→`--admin-success-border`, `#fde68a`→`--admin-warning-border`, `#fef2f2`→`--admin-danger-tint`, `#b91c1c`→`--admin-danger-strong` (three occurrences: suspended text, banned background, banned border), `#fecaca`→`--admin-danger-border`, `#fff`→ literal `#fff` stays as-is on the banned badge's inverted white text — this one is intentionally NOT a token, since it's a fixed white-on-red inversion that should render identically in both themes, same reasoning as button text-on-brand colors).

- [ ] **Step 3: Verify no old token name remains anywhere in the file**

Run: `cd /home/r8s/code/Salsa && grep -nE -- "--admin-(bg|surface-subtle|surface-high|primary\b|primary-hover|primary-tint|primary-ring|attention-tint|attention-ink|attention-dot|positive-tint|positive-ink)\b" src/styles/admin.css`
Expected: no output (zero matches) — every old name must be gone from this file.

- [ ] **Step 4: Visual smoke check via build (no visual regression tool available — rely on careful review)**

Run: `cd /home/r8s/code/Salsa && npx tsc --noEmit -p . && npm run build`
Expected: both clean (CSS custom-property renames don't affect TS/build output directly, but this confirms nothing else broke).

- [ ] **Step 5: Commit**

```bash
cd /home/r8s/code/Salsa
git add src/styles/admin.css
git commit -m "Rename admin.css tokens to semantic names; add dark theme override block"
```

---

### Task 3: Sweep remaining hardcoded hex in component `.css` files

**Files:**
- Modify: `src/components/Admin/AdminActionMenu.css`
- Modify: `src/components/Admin/AdminEventForm.css`
- Modify: `src/components/Admin/AdminEventsTable.css`
- Modify: `src/components/Admin/AdminUsersTable.css`
- Modify: `src/components/Admin/AdminEventsToolbar.css`
- Modify: `src/components/Admin/AdminUsersToolbar.css`
- Modify: `src/components/Admin/AdminPagination.css`
- Modify: `src/layouts/AdminLayout.css`

**Interfaces:** consumes every token from Task 2 (must run after Task 2 — the tokens this task references must already exist).

- [ ] **Step 1: `AdminActionMenu.css`**

The dropdown-menu panel's `background: #ffffff;` (line 15) → `background: var(--admin-surface-elevated);` (a popover is elevated chrome, distinct from the page's base `--admin-surface` cards, per the design doc's token list — this is the first of several places that distinction now matters).

- [ ] **Step 2: `AdminEventForm.css`**

Line 88 currently reads `border-color: var(--admin-border-md, #cbd5e1);` — this CSS variable (`--admin-border-md`) was never actually defined anywhere before Task 2, so this rule always silently fell back to the literal `#cbd5e1`. Task 2 now defines `--admin-border-md` for real (light: `#cbd5e1`, dark: `rgba(255,255,255,0.14)`). Simplify this line to `border-color: var(--admin-border-md);` (drop the now-redundant literal fallback — the variable is guaranteed to exist).

- [ ] **Step 3: `AdminEventsTable.css` and `AdminUsersTable.css`**

Both files have two identical occurrences of `color: #b91c1c;` (row-error text, e.g. `.admin-events-table__error td` / `.admin-users-table__error td` and their mobile-card equivalents) → `color: var(--admin-danger-strong);` in all four locations (two per file).

- [ ] **Step 4: `AdminEventsToolbar.css` and `AdminUsersToolbar.css`**

Both files have three `background: #ffffff;` occurrences (the date/status/role popover panels) → `background: var(--admin-surface-elevated);` in all six locations (three per file), and one `color: #ffffff;` (the drawer-filter-count badge's text, sitting on a `var(--admin-brand)` background) → this one stays literal `#ffffff` (white text on the solid brand-red pill is correct in both themes, same reasoning as button text — do not tokenize it).

- [ ] **Step 5: `AdminPagination.css`**

`background: #ffffff;` (page-number button default) → `background: var(--admin-surface-elevated);`. `color: #ffffff;` (active/current page button, sitting on `var(--admin-brand)` background) stays literal, same reasoning as above.

- [ ] **Step 6: `AdminLayout.css`**

- Line 62, topbar `background: rgba(255, 255, 255, 0.9);` → `background: var(--admin-topbar-bg);`.
- Line 31, drawer backdrop `background: rgba(15, 23, 42, 0.5);` → `background: var(--admin-overlay);`.

- [ ] **Step 7: Verify no stray hardcoded hex remains in any touched file**

Run: `cd /home/r8s/code/Salsa && grep -nE "#[0-9a-fA-F]{3,8}" src/components/Admin/AdminActionMenu.css src/components/Admin/AdminEventForm.css src/components/Admin/AdminEventsTable.css src/components/Admin/AdminUsersTable.css src/components/Admin/AdminEventsToolbar.css src/components/Admin/AdminUsersToolbar.css src/components/Admin/AdminPagination.css src/layouts/AdminLayout.css`
Expected: only the two intentionally-literal white-text-on-brand occurrences remain (`AdminEventsToolbar.css`/`AdminUsersToolbar.css`'s badge text, `AdminPagination.css`'s active-page text) — confirm each remaining match is one of those three, not a missed rename.

- [ ] **Step 8: Full component-test regression check**

Run: `cd /home/r8s/code/Salsa && npx vitest run src/pages/AdminEventsPage.test.tsx src/pages/AdminUsersPage.test.tsx src/components/Admin/AdminEventsTable.test.tsx src/components/Admin/AdminActionMenu.test.tsx`
Expected: all pass unchanged — this is a pure CSS value swap, no class names or markup changed, so every existing test (which asserts on text/roles/classes, never literal color values) must be unaffected.

Run: `cd /home/r8s/code/Salsa && npx tsc --noEmit -p . && npm run build`
Expected: clean.

- [ ] **Step 9: Commit**

```bash
cd /home/r8s/code/Salsa
git add src/components/Admin/AdminActionMenu.css src/components/Admin/AdminEventForm.css src/components/Admin/AdminEventsTable.css src/components/Admin/AdminUsersTable.css src/components/Admin/AdminEventsToolbar.css src/components/Admin/AdminUsersToolbar.css src/components/Admin/AdminPagination.css src/layouts/AdminLayout.css
git commit -m "Sweep remaining hardcoded hex colors in admin component CSS to semantic tokens"
```

---

### Task 4: Flash-of-wrong-theme prevention + `data-theme` on real DOM before first paint

**Files:**
- Modify: `index.html` (inline blocking script)
- Modify: `src/layouts/AdminLayout.tsx` (apply `data-theme` to the actual `.admin-shell` root element on mount, not just via the context's own effect — the context's effect in Task 1 only fires after React commits, which is one frame too late for the very first paint)

**Interfaces:** consumes `Theme`/localStorage key `admin-theme` from Task 1 (must match exactly — this is a second, independent reader of the same storage key, and both must resolve identically).

- [ ] **Step 1: Add the blocking inline script to `index.html`**

Read the current `index.html` first to find the `<head>` section's existing structure (confirm there's no conflicting inline script already there). Add, as early as possible in `<head>` (before any stylesheet link, so no frame renders with a default theme before this runs):

```html
<script>
  (function () {
    try {
      var stored = localStorage.getItem("admin-theme");
      var theme = stored === "light" || stored === "dark" ? stored : null;
      if (!theme) {
        var prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
        theme = prefersDark ? "dark" : "light";
      }
      document.documentElement.dataset.pendingAdminTheme = theme;
    } catch (e) {}
  })();
</script>
```

(This stashes the resolved theme on `<html>`'s dataset rather than directly on `.admin-shell`, because `.admin-shell` doesn't exist in the DOM yet at this point in page load — React hasn't rendered anything. `AdminLayout.tsx`'s mount effect, Step 2 below, reads this stashed value and applies it to the real `.admin-shell` element synchronously on mount, before paint.)

- [ ] **Step 2: Apply the pending theme synchronously in `AdminLayout.tsx`**

In `src/layouts/AdminLayout.tsx`, add `useLayoutEffect` (not `useEffect` — must run before paint) near the component's other hooks:

```tsx
import { useLayoutEffect } from "react";
```

and, inside the component body:

```tsx
  useLayoutEffect(() => {
    const pending = document.documentElement.dataset.pendingAdminTheme;
    if (pending) {
      document.querySelector(".admin-shell")?.setAttribute("data-theme", pending);
      delete document.documentElement.dataset.pendingAdminTheme;
    }
  }, []);
```

This runs once, synchronously, immediately after `AdminLayout` mounts (before the browser paints), applying the pre-resolved theme from Step 1 to the real element. `ThemeProvider`'s own effect (Task 1) then keeps it in sync for every subsequent theme change — the two never conflict because this one only ever fires once, on first mount, before `ThemeProvider`'s effect has had a chance to run at all.

- [ ] **Step 3: Manual verification (no automated test can verify absence of a visual flash)**

Run: `cd /home/r8s/code/Salsa && npm run dev`, open `/admin` with dark mode set as the OS preference (or `localStorage.setItem("admin-theme", "dark")` set beforehand), hard-refresh several times, and visually confirm no light-background flash occurs before the dark theme applies.

- [ ] **Step 4: Run tests + tsc**

Run: `cd /home/r8s/code/Salsa && npx vitest run src/layouts/AdminLayout.test.tsx && npx tsc --noEmit -p .`
Expected: both clean (existing `AdminLayout.test.tsx` tests don't touch theming and must be unaffected).

- [ ] **Step 5: Commit**

```bash
cd /home/r8s/code/Salsa
git add index.html src/layouts/AdminLayout.tsx
git commit -m "Prevent flash-of-wrong-theme on initial load"
```

---

### Task 5: Appearance submenu in the account menu

**Files:**
- Modify: `src/layouts/AdminLayout.tsx`
- Modify: `src/layouts/AdminLayout.css`
- Modify: `src/layouts/AdminLayout.test.tsx`

**Interfaces:** consumes `useTheme()` (Task 1).

- [ ] **Step 1: Write the failing tests**

Add to `src/layouts/AdminLayout.test.tsx` (read the current file first to match its existing `vi.mock("../contexts/useAuth", ...)` pattern; add an equivalent mock for `useTheme` alongside it):

```tsx
const { useTheme } = vi.hoisted(() => ({ useTheme: vi.fn() }));
vi.mock("../contexts/useTheme", () => ({ useTheme }));
```

Add to the existing `beforeEach`-equivalent setup (or a fresh one for this describe block, matching the file's existing style) a default mock return:

```ts
vi.mocked(useTheme).mockReturnValue({ theme: "system", effectiveTheme: "light", setTheme: vi.fn() });
```

Add tests:

```tsx
  it("account menu shows Appearance with System checked by default", async () => {
    const user = userEvent.setup();
    renderLayout();
    await user.click(screen.getByRole("button", { name: "Account menu" }));
    await user.click(screen.getByText("Appearance"));
    const systemOption = screen.getByRole("radio", { name: "System" });
    expect(systemOption).toBeChecked();
  });

  it("selecting Dark in the Appearance submenu calls setTheme", async () => {
    const setTheme = vi.fn();
    vi.mocked(useTheme).mockReturnValue({ theme: "system", effectiveTheme: "light", setTheme });
    const user = userEvent.setup();
    renderLayout();
    await user.click(screen.getByRole("button", { name: "Account menu" }));
    await user.click(screen.getByText("Appearance"));
    await user.click(screen.getByRole("radio", { name: "Dark" }));
    expect(setTheme).toHaveBeenCalledWith("dark");
  });

  it("account menu shows an inert Account row with no link", async () => {
    const user = userEvent.setup();
    renderLayout();
    await user.click(screen.getByRole("button", { name: "Account menu" }));
    expect(screen.queryByRole("link", { name: "Account" })).not.toBeInTheDocument();
    expect(screen.getByText("Account")).toBeInTheDocument();
  });
```

(If the current file's account-menu trigger doesn't yet have an accessible name of `"Account menu"`, check its actual current `aria-label` in `AdminLayout.tsx` — `summary.admin-account__trigger[aria-label="Account menu"]` per the file already read this session — and use that exact string; do not invent a different name.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/r8s/code/Salsa && npx vitest run src/layouts/AdminLayout.test.tsx`
Expected: FAIL — the Appearance submenu doesn't exist yet.

- [ ] **Step 3: Implement the Appearance submenu**

In `src/layouts/AdminLayout.tsx`, import `useTheme`:

```tsx
import { useTheme } from "../contexts/useTheme";
```

Inside the component, alongside the existing `useAuth()` call:

```tsx
  const { theme, setTheme } = useTheme();
```

Replace the current account-menu markup (`<details className="admin-account">...</details>`, currently just identity + "View site" + "Sign out") with a version carrying the identity block, an `Appearance` disclosure, an inert `Account` row, and `Sign out`, matching the design doc's exact copy:

```tsx
      <details className="admin-account">
        <summary className="admin-account__trigger" aria-label="Account menu">
          <span className="admin-account__avatar">{initial}</span>
        </summary>
        <div className="admin-account__menu">
          {user?.email && (
            <div className="admin-account__identity">
              <p className="admin-account__email">{user.email}</p>
            </div>
          )}
          <details className="admin-account__appearance">
            <summary>
              Appearance
              <ChevronRight size={14} />
            </summary>
            <fieldset className="admin-account__theme-options">
              <legend className="admin-visually-hidden">Appearance</legend>
              {(["system", "light", "dark"] as const).map((option) => (
                <label key={option} className="admin-account__theme-option">
                  <input
                    type="radio"
                    name="admin-theme"
                    value={option}
                    checked={theme === option}
                    onChange={() => setTheme(option)}
                    aria-label={option === "system" ? "System" : option === "light" ? "Light" : "Dark"}
                  />
                  {option === "system" ? "System" : option === "light" ? "Light" : "Dark"}
                </label>
              ))}
            </fieldset>
          </details>
          <span className="admin-account__inert-row" aria-disabled="true">
            Account
          </span>
          <Link to="/">View site</Link>
          <button type="button" onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      </details>
```

(`ChevronRight` is already imported in this file from `lucide-react` for the breadcrumb separator — reuse it, don't add a second icon import for the same glyph.)

- [ ] **Step 4: Add CSS for the new elements**

Append to `src/layouts/AdminLayout.css`:

```css
.admin-account__identity {
  padding: 8px 12px;
  border-bottom: 1px solid var(--admin-divider);
  margin-bottom: 4px;
}

.admin-account__appearance {
  position: relative;
}

.admin-account__appearance summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  cursor: pointer;
  color: var(--admin-text-primary);
  font-size: 0.9rem;
  list-style: none;
}

.admin-account__appearance summary::-webkit-details-marker {
  display: none;
}

.admin-account__appearance summary:hover {
  background: var(--admin-surface-secondary);
}

.admin-account__theme-options {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 4px 12px 8px 24px;
  border: none;
  margin: 0;
}

.admin-account__theme-option {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
  font-size: 0.85rem;
  color: var(--admin-text-primary);
  cursor: pointer;
}

.admin-account__inert-row {
  display: block;
  padding: 8px 12px;
  color: var(--admin-text-subtle);
  font-size: 0.9rem;
  cursor: not-allowed;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /home/r8s/code/Salsa && npx vitest run src/layouts/AdminLayout.test.tsx`
Expected: PASS, all tests (existing + 3 new) green.

Run: `cd /home/r8s/code/Salsa && npx tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd /home/r8s/code/Salsa
git add src/layouts/AdminLayout.tsx src/layouts/AdminLayout.css src/layouts/AdminLayout.test.tsx
git commit -m "Add Appearance submenu and inert Account row to the admin account menu"
```

---

### Task 6: Sidebar collapse

**Files:**
- Modify: `src/components/Admin/AdminSidebar.tsx`
- Modify: `src/components/Admin/AdminSidebar.css`
- Create: `src/components/Admin/AdminSidebar.test.tsx`

**Interfaces:**
- Produces: `AdminSidebar` gains an optional `collapsed?: boolean` and `onToggleCollapse?: () => void` prop pair (only meaningful for `variant="fixed"`; the drawer variant never collapses — there's no room-saving reason to on a full-width mobile sheet). Collapse state itself is owned by `AdminLayout` (parallel to the existing `drawerOpen` state), not by `AdminSidebar` — mirrors how `drawerOpen` already works today.

- [ ] **Step 1: Write the failing tests**

`src/components/Admin/AdminSidebar.test.tsx`:

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import AdminSidebar from "./AdminSidebar";

function renderSidebar(props: Partial<React.ComponentProps<typeof AdminSidebar>> = {}) {
  return render(
    <MemoryRouter>
      <AdminSidebar variant="fixed" {...props} />
    </MemoryRouter>
  );
}

describe("AdminSidebar collapse", () => {
  it("shows the Collapse control only for the fixed variant", () => {
    renderSidebar({ variant: "fixed", collapsed: false, onToggleCollapse: vi.fn() });
    expect(screen.getByRole("button", { name: /collapse/i })).toBeInTheDocument();
  });

  it("does not show a collapse control on the drawer variant", () => {
    render(
      <MemoryRouter>
        <AdminSidebar variant="drawer" />
      </MemoryRouter>
    );
    expect(screen.queryByRole("button", { name: /collapse/i })).not.toBeInTheDocument();
  });

  it("clicking the collapse control calls onToggleCollapse", async () => {
    const user = userEvent.setup();
    const onToggleCollapse = vi.fn();
    renderSidebar({ collapsed: false, onToggleCollapse });
    await user.click(screen.getByRole("button", { name: /collapse/i }));
    expect(onToggleCollapse).toHaveBeenCalledOnce();
  });

  it("when collapsed, the toggle's accessible name reflects the expand action", () => {
    renderSidebar({ collapsed: true, onToggleCollapse: vi.fn() });
    expect(screen.getByRole("button", { name: /expand/i })).toBeInTheDocument();
  });

  it("nav links carry a title attribute for collapsed-state tooltips", () => {
    renderSidebar({ collapsed: true, onToggleCollapse: vi.fn() });
    expect(screen.getByRole("link", { name: /dashboard/i })).toHaveAttribute("title", "Dashboard");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/r8s/code/Salsa && npx vitest run src/components/Admin/AdminSidebar.test.tsx`
Expected: FAIL — no collapse control exists yet.

- [ ] **Step 3: Implement the collapse control**

In `src/components/Admin/AdminSidebar.tsx`, extend the props interface and import icons:

```tsx
import { ChevronLeft, ChevronRight as ChevronRightIcon } from "lucide-react";
```

```tsx
interface AdminSidebarProps {
  variant: "fixed" | "drawer";
  onNavigate?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}
```

Update the component signature and add the `data-collapsed` attribute plus the footer control (only rendered for `variant === "fixed"`), and add `title={item.label}` is already present on every nav link/span (confirmed in the current file — no change needed there, it already exists on both the `NavLink` and the disabled `<span>`):

```tsx
export default function AdminSidebar({ variant, onNavigate, collapsed = false, onToggleCollapse }: AdminSidebarProps) {
  return (
    <nav aria-label="Admin" className="admin-sidebar" data-variant={variant} data-collapsed={collapsed}>
      <div className="admin-sidebar__brand">SalsaSegura</div>
      <div className="admin-sidebar__scroll">
        {/* ...unchanged NAV_ITEMS_WITH_GROUP_FLAG.map(...) block... */}
      </div>
      {variant === "fixed" && onToggleCollapse && (
        <button
          type="button"
          className="admin-sidebar__collapse-toggle"
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRightIcon size={16} /> : <ChevronLeft size={16} />}
          <span className="admin-nav__label">{collapsed ? "Expand" : "Collapse"}</span>
        </button>
      )}
    </nav>
  );
}
```

(Leave the existing `NAV_ITEMS`/`NAV_ITEMS_WITH_GROUP_FLAG`/`.map(...)` block exactly as it is — only the function signature, the `nav` element's attributes, and the new footer button are new.)

- [ ] **Step 4: Add CSS — collapsed state reuses the existing ≥768px rail rules**

In `src/components/Admin/AdminSidebar.css`, the existing `@media (min-width: 768px) { .admin-sidebar[data-variant="fixed"] .admin-nav__label, ... { display: none; } ... }` block (rail styling) and the `@media (min-width: 1024px) { ... display: inline; ... }` block (full-sidebar styling) currently form an automatic, viewport-only toggle. Add a new selector that applies the SAME rail styling at ≥1024px specifically when `data-collapsed="true"`, so the user-collapsed state looks identical to the automatic rail:

```css
/* ----------------------------------------
   ≥1024px, user-collapsed — same rail treatment the automatic
   768-1023px breakpoint already uses, available on user request.
   ---------------------------------------- */
@media (min-width: 1024px) {
  .admin-sidebar[data-variant="fixed"][data-collapsed="true"] .admin-nav__label,
  .admin-sidebar[data-variant="fixed"][data-collapsed="true"] .admin-nav__group,
  .admin-sidebar[data-variant="fixed"][data-collapsed="true"] .admin-nav__soon {
    display: none;
  }

  .admin-sidebar[data-variant="fixed"][data-collapsed="true"] .admin-sidebar__brand {
    justify-content: center;
    padding: 0;
    font-size: 0;
  }

  .admin-sidebar[data-variant="fixed"][data-collapsed="true"] .admin-sidebar__brand::before {
    content: "S";
    font-size: 1.2rem;
  }

  .admin-sidebar[data-variant="fixed"][data-collapsed="true"] .admin-nav__link {
    justify-content: center;
    padding: 10px;
  }
}
```

Add the collapse-toggle button's own styling (works at every breakpoint, but only ever rendered for the fixed variant):

```css
.admin-sidebar__collapse-toggle {
  display: none;
}

@media (min-width: 1024px) {
  .admin-sidebar__collapse-toggle {
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 12px 20px;
    border: none;
    border-top: 1px solid var(--admin-divider);
    background: transparent;
    color: var(--admin-nav-text);
    font-family: var(--font-ui);
    font-size: 0.85rem;
    cursor: pointer;
    transition: background-color 0.15s ease;
  }

  .admin-sidebar__collapse-toggle:hover {
    background: var(--admin-surface-secondary);
  }

  .admin-sidebar[data-collapsed="true"] .admin-sidebar__collapse-toggle {
    justify-content: center;
    padding: 12px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .admin-sidebar__collapse-toggle {
    transition: none;
  }
}
```

- [ ] **Step 5: Wire state into `AdminLayout.tsx`**

Add collapse state alongside the existing `drawerOpen` state, persisted the same way `ThemeContext` persists (a plain `useState` + `useEffect` pair — this is layout-local state, not context, since only `AdminLayout` and its one `AdminSidebar` child need it):

```tsx
const COLLAPSE_STORAGE_KEY = "admin-sidebar-collapsed";

function readStoredCollapsed(): boolean {
  return window.localStorage.getItem(COLLAPSE_STORAGE_KEY) === "true";
}
```

Inside the component:

```tsx
  const [sidebarCollapsed, setSidebarCollapsed] = useState(readStoredCollapsed);

  useEffect(() => {
    window.localStorage.setItem(COLLAPSE_STORAGE_KEY, String(sidebarCollapsed));
  }, [sidebarCollapsed]);
```

Pass to the fixed-variant `AdminSidebar` instance:

```tsx
      <AdminSidebar
        variant="fixed"
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((value) => !value)}
      />
```

(Leave the drawer-variant `<AdminSidebar variant="drawer" onNavigate={closeDrawer} />` call exactly as it is — no collapse props passed, matching the "drawer never collapses" decision.)

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd /home/r8s/code/Salsa && npx vitest run src/components/Admin/AdminSidebar.test.tsx src/layouts/AdminLayout.test.tsx`
Expected: all pass (5 new + existing).

Run: `cd /home/r8s/code/Salsa && npx tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
cd /home/r8s/code/Salsa
git add src/components/Admin/AdminSidebar.tsx src/components/Admin/AdminSidebar.css src/components/Admin/AdminSidebar.test.tsx src/layouts/AdminLayout.tsx
git commit -m "Add user-triggered sidebar collapse, persisted to localStorage"
```

---

### Task 7: Minimal toast component

**Files:**
- Create: `src/components/Admin/AdminToast.tsx`
- Create: `src/components/Admin/AdminToast.css`
- Create: `src/components/Admin/AdminToast.test.tsx`

**Interfaces:**
- Produces: `export default function AdminToast({ message, tone, onDismiss }: { message: string; tone?: "success" | "error" | "info"; onDismiss: () => void }): JSX.Element` — a single, controlled toast (no internal queue/stack manager — the design doc scopes this to "positive confirmation away from the triggering row," a single-message-at-a-time need; a multi-toast stack is not requested and would be YAGNI). Auto-dismisses after 4 seconds unless dismissed manually first; the parent owns the `message`/visibility state (mirrors how every existing dialog in this codebase is parent-controlled, e.g. `pendingAction` state in `AdminUsersPage.tsx`).

- [ ] **Step 1: Write the failing tests**

```tsx
import { describe, expect, it, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AdminToast from "./AdminToast";

describe("AdminToast", () => {
  it("renders the message with role=status", () => {
    render(<AdminToast message="Role changed to Moderator" onDismiss={vi.fn()} />);
    expect(screen.getByRole("status")).toHaveTextContent("Role changed to Moderator");
  });

  it("error tone renders with role=alert instead of role=status", () => {
    render(<AdminToast message="Something failed" tone="error" onDismiss={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent("Something failed");
  });

  it("clicking the dismiss button calls onDismiss", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(<AdminToast message="Done" onDismiss={onDismiss} />);
    await user.click(screen.getByRole("button", { name: /dismiss/i }));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("auto-dismisses after 4 seconds", () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<AdminToast message="Done" onDismiss={onDismiss} />);
    act(() => {
      vi.advanceTimersByTime(4000);
    });
    expect(onDismiss).toHaveBeenCalledOnce();
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/r8s/code/Salsa && npx vitest run src/components/Admin/AdminToast.test.tsx`
Expected: FAIL — the component doesn't exist yet.

- [ ] **Step 3: Implement `AdminToast.tsx`**

```tsx
import { useEffect } from "react";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";
import "./AdminToast.css";

const AUTO_DISMISS_MS = 4000;

const ICON = { success: CheckCircle2, error: XCircle, info: Info } as const;

export default function AdminToast({
  message,
  tone = "success",
  onDismiss,
}: {
  message: string;
  tone?: "success" | "error" | "info";
  onDismiss: () => void;
}) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => window.clearTimeout(timer);
  }, [onDismiss]);

  const Icon = ICON[tone];
  const role = tone === "error" ? "alert" : "status";

  return (
    <div className={`admin-toast admin-toast--${tone}`} role={role}>
      <Icon size={18} />
      <span className="admin-toast__message">{message}</span>
      <button type="button" className="admin-icon-btn" aria-label="Dismiss" onClick={onDismiss}>
        <X size={16} />
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Create `AdminToast.css`**

```css
.admin-toast {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 100;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-radius: var(--admin-radius);
  background: var(--admin-surface-elevated);
  border: 1px solid var(--admin-border);
  box-shadow: var(--admin-shadow-md);
  color: var(--admin-text-primary);
  font-size: 0.875rem;
  max-width: 360px;
  animation: admin-toast-in 0.15s ease;
}

.admin-toast__message {
  flex: 1;
}

.admin-toast--success svg:first-child {
  color: var(--admin-success);
}

.admin-toast--error svg:first-child {
  color: var(--admin-danger);
}

.admin-toast--info svg:first-child {
  color: var(--admin-information);
}

@keyframes admin-toast-in {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .admin-toast {
    animation: none;
  }
}

@media (max-width: 639px) {
  .admin-toast {
    left: 16px;
    right: 16px;
    bottom: 16px;
    max-width: none;
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /home/r8s/code/Salsa && npx vitest run src/components/Admin/AdminToast.test.tsx`
Expected: PASS, all 4 tests green.

Run: `cd /home/r8s/code/Salsa && npx tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd /home/r8s/code/Salsa
git add src/components/Admin/AdminToast.tsx src/components/Admin/AdminToast.css src/components/Admin/AdminToast.test.tsx
git commit -m "Add AdminToast: minimal, single-message, auto-dismissing toast"
```

(Not wired into any page yet — this task builds the component per the design doc's request; wiring it into a specific mutation's success path, e.g. replacing or supplementing `AdminUsersPage`'s existing silent-row-update pattern, is future page-level work outside this shell-only plan's scope.)

---

### Task 8: Mobile drawer gains the account block

**Files:**
- Modify: `src/components/Admin/AdminSidebar.tsx`
- Modify: `src/components/Admin/AdminSidebar.css`
- Modify: `src/components/Admin/AdminSidebar.test.tsx`

**Interfaces:**
- Consumes: `useAuth()` (for email/sign-out, already used by `AdminLayout.tsx`), `useTheme()` (Task 1). `AdminSidebar` gains these as direct hook calls for the drawer variant only — the fixed variant's topbar already renders the account disclosure separately, so `AdminSidebar` must only render this block when `variant === "drawer"`, never for `variant === "fixed"` (avoiding a duplicate account UI on desktop).

- [ ] **Step 1: Write the failing tests**

Add to `src/components/Admin/AdminSidebar.test.tsx`:

```tsx
const { useAuth } = vi.hoisted(() => ({ useAuth: vi.fn() }));
vi.mock("../../contexts/useAuth", () => ({ useAuth }));
const { useTheme } = vi.hoisted(() => ({ useTheme: vi.fn() }));
vi.mock("../../contexts/useTheme", () => ({ useTheme }));

describe("AdminSidebar drawer account block", () => {
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      user: { email: "admin@salsa.test" },
      signOut: vi.fn(),
    });
    vi.mocked(useTheme).mockReturnValue({ theme: "system", effectiveTheme: "light", setTheme: vi.fn() });
  });

  it("drawer variant renders Appearance and Sign Out", () => {
    render(
      <MemoryRouter>
        <AdminSidebar variant="drawer" />
      </MemoryRouter>
    );
    expect(screen.getByText("Appearance")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Sign out" })).toBeInTheDocument();
  });

  it("fixed variant does not render the account block", () => {
    render(
      <MemoryRouter>
        <AdminSidebar variant="fixed" collapsed={false} onToggleCollapse={vi.fn()} />
      </MemoryRouter>
    );
    expect(screen.queryByRole("button", { name: "Sign out" })).not.toBeInTheDocument();
  });
});
```

(Add the `beforeEach` import if the file doesn't already import it from vitest.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /home/r8s/code/Salsa && npx vitest run src/components/Admin/AdminSidebar.test.tsx`
Expected: FAIL — the drawer account block doesn't exist yet (the two new tests fail; the Task 6 tests continue passing).

- [ ] **Step 3: Implement**

In `src/components/Admin/AdminSidebar.tsx`, add imports:

```tsx
import { useAuth } from "../../contexts/useAuth";
import { useTheme } from "../../contexts/useTheme";
```

Inside the component, call both hooks unconditionally (both are cheap context reads, no reason to gate the hook call itself on `variant`):

```tsx
  const { user, signOut } = useAuth();
  const { theme, setTheme } = useTheme();

  const handleSignOut = async () => {
    await signOut();
  };
```

Add, at the end of `.admin-sidebar__scroll`'s children (after the nav items map, still inside the scrollable area so it scrolls with the list on short viewports), rendered only for the drawer variant:

```tsx
        {variant === "drawer" && (
          <div className="admin-sidebar__account">
            {user?.email && <p className="admin-sidebar__account-email">{user.email}</p>}
            <details className="admin-sidebar__appearance">
              <summary>Appearance</summary>
              <fieldset className="admin-account__theme-options">
                <legend className="admin-visually-hidden">Appearance</legend>
                {(["system", "light", "dark"] as const).map((option) => (
                  <label key={option} className="admin-account__theme-option">
                    <input
                      type="radio"
                      name="admin-sidebar-theme"
                      value={option}
                      checked={theme === option}
                      onChange={() => setTheme(option)}
                      aria-label={option === "system" ? "System" : option === "light" ? "Light" : "Dark"}
                    />
                    {option === "system" ? "System" : option === "light" ? "Light" : "Dark"}
                  </label>
                ))}
              </fieldset>
            </details>
            <a href="/">View site</a>
            <button type="button" onClick={handleSignOut}>
              Sign out
            </button>
          </div>
        )}
```

- [ ] **Step 4: Add CSS**

Append to `src/components/Admin/AdminSidebar.css`:

```css
.admin-sidebar__account {
  margin-top: auto;
  padding-top: 12px;
  border-top: 1px solid var(--admin-divider);
}

.admin-sidebar__account-email {
  padding: 4px 20px;
  color: var(--admin-text-subtle);
  font-size: 0.8rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.admin-sidebar__appearance summary {
  padding: 8px 20px;
  cursor: pointer;
  color: var(--admin-nav-text);
  font-size: 0.9rem;
  list-style: none;
}

.admin-sidebar__appearance summary::-webkit-details-marker {
  display: none;
}

.admin-sidebar__account a,
.admin-sidebar__account button {
  display: block;
  width: 100%;
  padding: 8px 20px;
  border: none;
  background: transparent;
  color: var(--admin-nav-text);
  font-family: var(--font-ui);
  font-size: 0.9rem;
  text-align: left;
  text-decoration: none;
  cursor: pointer;
}

.admin-sidebar__account a:hover,
.admin-sidebar__account button:hover {
  background: var(--admin-surface-secondary);
}
```

(`.admin-sidebar__scroll` already has `display: flex; flex-direction: column;` per its existing rule — confirm this in the current file before relying on `margin-top: auto` to push the account block down; if the existing rule doesn't already set `flex-direction: column`, adjust `.admin-sidebar__account`'s rule accordingly rather than assuming.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /home/r8s/code/Salsa && npx vitest run src/components/Admin/AdminSidebar.test.tsx`
Expected: PASS, all tests (Task 6's 5 + these 2 new) green.

Run: `cd /home/r8s/code/Salsa && npx tsc --noEmit -p .`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd /home/r8s/code/Salsa
git add src/components/Admin/AdminSidebar.tsx src/components/Admin/AdminSidebar.css src/components/Admin/AdminSidebar.test.tsx
git commit -m "Add account block (Appearance, sign out) to the mobile drawer sidebar"
```

---

### Task 9: Full-suite verification + accessibility contrast spot-check

**Files:** none (verification only).

- [ ] **Step 1: Full test suite**

Run: `cd /home/r8s/code/Salsa && npx vitest run`
Expected: every test file passes — the running total from before this plan (254 tests, 31 files) plus this plan's additions (Task 1: 6, Task 5: 3, Task 6: 5, Task 7: 4, Task 8: 2 = 20 new tests, 274 total across 34 files). Report the exact numbers.

- [ ] **Step 2: TypeScript**

Run: `cd /home/r8s/code/Salsa && npx tsc --noEmit -p .`
Expected: zero errors.

- [ ] **Step 3: Build**

Run: `cd /home/r8s/code/Salsa && npm run build`
Expected: clean build; confirm no new bundle-size warnings beyond the pre-existing `index-*.js` one.

- [ ] **Step 4: Lint**

Run: `cd /home/r8s/code/Salsa && npm run lint`
Expected: 0 warnings/errors.

- [ ] **Step 5: Manual contrast spot-check (no automated tool available in this repo)**

Run `npm run dev`, open `/admin` in both themes, and using the browser's built-in accessibility inspector (or a contrast-checker bookmarklet), verify these specific pairs meet WCAG AA (4.5:1 for normal text, 3:1 for large text/UI components) in BOTH light and dark:
- `--admin-text-primary` on `--admin-background`
- `--admin-text-muted` on `--admin-surface`
- `--admin-brand` (white text on it, i.e. primary button) on itself
- Each status-badge tint/ink pair (success, warning, danger, information) in both themes

If any pair fails, adjust that theme's specific token value (not the light theme's, unless light also fails) and re-check — this is a real acceptance gate per the design doc's §29, not optional polish.

- [ ] **Step 6: Manual smoke test**

With the dev server running: toggle theme via the account menu (System → Light → Dark → System) and confirm instant application with no flash on reload; toggle sidebar collapse at ≥1024px and confirm the icon-rail visual matches the existing automatic 768–1023px rail; open the mobile drawer at <768px and confirm Appearance/Sign Out are reachable there; confirm the collapse toggle is absent below 1024px and on the drawer variant.

- [ ] **Step 7: Final commit (if Step 5 required token adjustments)**

```bash
cd /home/r8s/code/Salsa
git add src/styles/admin.css
git commit -m "Adjust theme token values for WCAG AA contrast"
```

(Skip this step entirely if Step 5 found no contrast failures.)

## Self-Review Notes (fixed inline before handoff)

- **Spec coverage:** all 32 design-doc sections map to a task or are explicitly out of scope with a stated reason — §1-11 (navigation/sidebar/breadcrumb, already correct) → no task needed, confirmed in the design doc's own Audit; §12-17 (theme, persistence, tokens) → Tasks 1-4; §8/§11 (account menu) → Task 5; §5/§8 (collapse) → Task 6; §22-28 (design-system foundations, already correct) → no task needed; §25/§29 (toasts, accessibility) → Tasks 7 and 9; §35-36 (mobile) → Task 8; §31 (persistence) → Task 1/6's `localStorage` keys.
- **Placeholder scan:** no "TBD"/"add appropriate" language anywhere in this plan; every step has literal code.
- **Type consistency:** `Theme` type defined once (Task 1, `themeContextObject.ts`), imported everywhere else. `ThemeContextValue` shape (`theme`, `effectiveTheme`, `setTheme`) is identical across every mock in Tasks 5/8's tests and the real provider.
