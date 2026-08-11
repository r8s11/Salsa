# SalsaSegura Admin Dashboard - UX Rationale & Specification

## 1. Overall UX Rationale
The SalsaSegura Admin Dashboard is designed as a **high-utility operational environment**. Unlike the consumer-facing site, which is atmospheric and evocative ("Electric Noir"), the Admin interface prioritizes **clarity, speed, and precision**. 

### Strategic Pillars:
*   **Information Density vs. Whitespace:** We use a "Balanced Density" approach. Data is presented clearly with enough padding to prevent eye fatigue during long sessions, but compact enough to minimize scrolling.
*   **Contextual Awareness:** The combination of a persistent sidebar and a standardized page header ensures the admin always knows where they are and what the primary "goal" of the current view is.
*   **Action-Oriented Hierarchy:** High-priority management tasks (Events, Users) are visually distinct from system-level settings to reduce cognitive load.

---

## 2. Desktop Shell Specification
*   **Layout:** Classic "L-Shell" configuration.
*   **Sidebar Width:** 260px (Expanded) / 72px (Collapsed).
*   **Header Height:** 64px.
*   **Main Content Area:** Fluid width with a max-container of 1440px to ensure line lengths remain readable on ultra-wide monitors.
*   **Background:** Neutral off-white/light-gray (`#F8FAFC`) to let content cards and primary red actions pop.

---

## 3. Responsive Behavior
### Tablet (768px - 1024px)
*   **Sidebar:** Automatically collapses to icon-only rail to maximize workspace. 
*   **Navigation:** Hovering over the rail reveals tooltips; tapping an icon navigates.
*   **Header:** Consolidates secondary actions into an overflow menu (...) if width is constrained.

### Mobile (< 768px)
*   **Sidebar:** Transitions to a hidden "Burger" menu (Drawer).
*   **Header:** Title remains centered. Admin avatar moves into the drawer.
*   **Page Header:** Title and Primary CTA stack vertically to maintain tap targets.
*   **Content:** Tables transition to "Card Stack" views for better legibility on small screens.

---

## 4. Sidebar Specification
### Branding
*   **Logo:** A simplified, non-italic version of the brand mark for a more "SaaS" feel.
*   **Placement:** Top-left, fixed.

### Navigation Hierarchy (Grouping)
We will use **logical groupings with subtle labels**. This improves scannability by categorizing the mental model of the platform.

1.  **OVERVIEW** (High Priority)
    *   Dashboard (Route: `/admin`)
2.  **MANAGEMENT** (High Priority)
    *   Events (`/admin/events`)
    *   Users (`/admin/users`)
3.  **REVIEW** (Secondary - with notification badges)
    *   Event Submissions (`/admin/submissions`) [Badge: Count]
    *   Organizer Requests (`/admin/organizer-requests`) [Badge: Count]
4.  **PLATFORM** (Internal)
    *   Venues (`/admin/venues`)
    *   Tags (`/admin/tags`)
5.  **SYSTEM** (Utilities)
    *   Settings (`/admin/settings`)

### Visual States
*   **Default:** Charcoal text (`#475569`) on transparent background.
*   **Hover:** Slight background tint (`rgba(225, 29, 72, 0.04)`) + Darker text.
*   **Active:** Bold text + Border-left (4px) in **SalsaSegura Red** + Soft red background tint.
*   **Collapsed:** Icon only, centered.

---

## 5. Header & Page-Header Pattern
### Top Header (Global)
*   **Left:** Breadcrumbs (e.g., *Management / Events*).
*   **Center:** Empty (reserved for global search in Phase 2).
*   **Right:** Search Icon, Notification Bell (with attention dot), User Avatar + Dropdown.

### Page-Header Pattern (Standardized)
*   **Top Row:** 
    *   Left: Page Title (H1, Epilogue Bold).
    *   Right: Primary Action Button (SalsaRed) + Optional Secondary Actions (Ghost buttons).
*   **Bottom Row:**
    *   Short Description (Body Small, muted text) to provide context for the current view.

---

## 6. Core Visual & Design System
*   **Typography:** 
    *   Headings: **Epilogue** (Weights 600, 800).
    *   Body/UI: **Be Vietnam Pro** (Weights 400, 500).
*   **Color Palette:**
    *   Primary: `#E11D48` (Salsa Red) - used for Brand, Primary CTAs, Active Nav.
    *   Surface: `#FFFFFF` (White) - for cards and content.
    *   Border: `#E2E8F0` (Light Slate).
    *   Destructive: `#DC2626` (Bright Red) - for delete/ban actions.
*   **Shapes:** 8px (Base Radius) for cards and inputs to match the brand's "Round Eight" theme.

---

## 7. Interaction & States
*   **Loading:** Skeleton loaders for tables/cards to maintain layout stability.
*   **Empty:** Custom illustrations + "Quick Start" CTA to guide the admin.
*   **Error/Success:** Inline Banners (Top of content area) and Toast Notifications (Bottom-right).
*   **Safe Administration:** Destructive actions (Delete) always require a confirmation Dialog with a red "Confirm" button.

---

## 8. Admin Shell Wireframe (Text-Based)

```text
_______________________________________________________________________________
| [LOGO]         |  Management / Events                        [S] [!] [AVATARv] | <- GLOBAL HEADER
|________________|_____________________________________________________________|
|                |                                                             |
| OVERVIEW       |  Events                                     [+ CREATE EVENT]| <- PAGE HEADER
|   Dashboard    |  Manage events appearing on the calendar                    |
|                |_____________________________________________________________|
| MANAGEMENT     |                                                             |
| > Events       |  [ CONTENT AREA ]                                           |
|   Users        |                                                             |
|                |  (Tables, Grids, or Forms go here)                          |
| REVIEW         |                                                             |
|   Submissions  |                                                             |
|   Requests     |                                                             |
|                |                                                             |
| PLATFORM       |                                                             |
|   Venues       |                                                             |
|   Tags         |                                                             |
|                |                                                             |
| SYSTEM         |                                                             |
|   Settings     |                                                             |
|                |                                                             |
| [Collapse <]   |                                                             |
|________________|_____________________________________________________________|
```

---

## 9. Accessibility Considerations
*   **Contrast:** All text on the Red CTA buttons will be White to meet WCAG AA standards.
*   **Keyboard Nav:** Every sidebar link and header action will have a clear focus ring (`#E11D48` 2px offset).
*   **ARIA:** Navigation groups will use `<nav>` and `aria-label` for screen readers.
