# CSS Organization Guide

## Overview

This project uses a **component-based CSS architecture** where each component has its own stylesheet. This approach improves maintainability, reduces conflicts, and makes it easier to understand which styles apply to which components.

## File Structure

```
src/
├── styles/
│   └── global.css           # Global styles, utilities, animations
├── styles.css                # Page-specific styles, imports global.css
├── components/
│   ├── Header.tsx
│   ├── Header.css           # Header component styles only
│   ├── Hero.tsx
│   ├── Hero.css             # Hero component styles only
│   ├── Lessons.tsx
│   ├── Lessons.css          # Lessons component styles only
│   ├── Instructor.tsx
│   ├── Instructor.css       # Instructor component styles only
│   ├── Footer.tsx
│   ├── Footer.css           # Footer component styles only
│   ├── Calendar.tsx
│   ├── Calendar.css         # Calendar component styles
│   ├── Contact.tsx
│   ├── Contact.css          # Contact component styles
│   ├── Events.tsx
│   ├── Events.css           # Events component styles
│   ├── WorkInProgress.tsx
│   └── WorkInProgress.css   # Work in progress component styles
```

## CSS Architecture

### 1. **global.css** - Global Styles

Contains styles that are shared across the entire application:

- CSS Reset
- Base HTML/body styles
- Layout utilities (`.container`, `.app-layout`)
- Shared components (`.section-title`)
- Animations and keyframes
- Dark mode global styles
- Global media queries

**Import in:** `src/styles.css`

### 2. **styles.css** - Page Styles

Contains page-specific styles:

- About page
- Contact page
- Calendar page
- 404 page
- Other page-level styles

**Import in:** `src/main.tsx`

### 3. **Component CSS Files**

Each component has its own CSS file that:

- Is co-located with the component (same directory)
- Contains only styles for that specific component
- Includes component-specific dark mode styles
- Includes component-specific responsive styles

**Import in:** Each component's `.tsx` file

## Import Pattern

### In Components:

```tsx
// Component file: src/components/Header.tsx
import { useState } from "react";
import "./Header.css"; // Component-specific styles

function Header() {
  // Component code
}
```

### In Main Entry:

```tsx
// src/main.tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css"; // This imports global.css and page styles
```

## Best Practices

### 1. **Component Styles**

- Keep styles specific to the component
- Use clear, semantic class names
- Include dark mode styles in the same file
- Include component-specific media queries

### 2. **Global Styles**

- Only add truly global styles (used by 3+ components)
- Keep animations and keyframes in global.css
- Utility classes go in global.css

### 3. **Naming Conventions**

- Component classes: `.component-name`, `.component-element`
- Example: `.header`, `.nav-links`, `.hero-content`
- Avoid generic names like `.button`, `.container` in component files

### 4. **Dark Mode**

- Dark mode styles are included in each CSS file
- Pattern: `.dark-mode .component-class { }`
- Example in Header.css:
  ```css
  .dark-mode header {
    background: #1a1a1a;
  }
  ```

### 5. **Responsive Design**

- Component-specific breakpoints in component CSS files
- Global breakpoints in global.css
- Use `@media (max-width: 768px)` consistently

## Migration Summary

### Before:

- All styles in `/style.css` (root)
- Hard to find component-specific styles
- Difficult to maintain
- Scattered media queries

### After:

- Component-based organization
- Each component has its own CSS file
- Global styles separated
- Easy to find and maintain
- Consolidated media queries per component

## Adding New Components

When creating a new component:

1. Create `ComponentName.tsx`
2. Create `ComponentName.css` in the same directory
3. Import CSS at the top of the component:
   ```tsx
   import "./ComponentName.css";
   ```
4. Write component-specific styles
5. Include dark mode styles in the same file
6. Add responsive styles in the same file

## Troubleshooting

### Styles not applying?

1. Check that CSS is imported in the component
2. Verify class names match between HTML and CSS
3. Check browser DevTools to see which styles are loaded
4. Ensure no CSS specificity conflicts

### Dark mode not working?

1. Check `.dark-mode` class is added to body
2. Verify dark mode styles exist in component CSS
3. Check that dark mode toggle in Footer.tsx is working

## Performance

- CSS is automatically code-split by Vite
- Only needed CSS is loaded per route
- Production builds are optimized and minified
- No duplicate styles across files
