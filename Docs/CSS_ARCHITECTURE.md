# CSS Architecture Overview

## Component-Based CSS Organization ✅

```
┌─────────────────────────────────────────────────────────────┐
│                       Entry Point                            │
│                      src/main.tsx                            │
│                           │                                  │
│                           ├─> imports: src/styles.css        │
└───────────────────────────┼──────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    src/styles.css                            │
│                  (Page-Level Styles)                         │
│                           │                                  │
│                           ├─> imports: styles/global.css     │
└───────────────────────────┼──────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                 src/styles/global.css                        │
│                   (Global Styles)                            │
│                                                              │
│  • CSS Reset & Base Styles                                  │
│  • Layout Utilities (.container, .app-layout)               │
│  • Shared Components (.section-title)                       │
│  • Global Animations (fadeIn, bounce, dance)                │
│  • Dark Mode Global Styles                                  │
│  • Global Responsive Styles                                 │
└──────────────────────────────────────────────────────────────┘


┌─────────────────────────────────────────────────────────────┐
│              Component-Specific Styles                       │
└─────────────────────────────────────────────────────────────┘

┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  Header.tsx      │  │  Hero.tsx        │  │  Lessons.tsx     │
│      ↓           │  │      ↓           │  │      ↓           │
│  Header.css      │  │  Hero.css        │  │  Lessons.css     │
│                  │  │                  │  │                  │
│  • nav styles    │  │  • hero section  │  │  • lessons-grid  │
│  • logo          │  │  • hero-content  │  │  • lesson-card   │
│  • nav-links     │  │  • cta-button    │  │  • lesson-icon   │
│  • hamburger     │  │  • animations    │  │  • dark mode     │
│  • mobile menu   │  │  • mobile        │  │  • mobile        │
└──────────────────┘  └──────────────────┘  └──────────────────┘

┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ Instructor.tsx   │  │  Footer.tsx      │  │  Calendar.tsx    │
│      ↓           │  │      ↓           │  │      ↓           │
│ Instructor.css   │  │  Footer.css      │  │  Calendar.css    │
│                  │  │                  │  │                  │
│  • instructor-   │  │  • footer        │  │  • calendar-     │
│    content       │  │  • footer-links  │  │    container     │
│  • avatar        │  │  • dark-mode-    │  │  • calendar      │
│  • credentials   │  │    toggle        │  │    legend        │
│  • dark mode     │  │  • dark mode     │  │  • event colors  │
│  • mobile        │  │  • mobile        │  │  • mobile        │
└──────────────────┘  └──────────────────┘  └──────────────────┘

┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  Contact.tsx     │  │  Events.tsx      │  │WorkInProgress.tsx│
│      ↓           │  │      ↓           │  │      ↓           │
│  Contact.css     │  │  Events.css      │  │WorkInProgress.css│
│                  │  │                  │  │                  │
│  • contact-form  │  │  • events-grid   │  │  • wip-container │
│  • form-group    │  │  • event-card    │  │  • content       │
│  • contact-card  │  │  • event-date    │  │  • contact-info  │
│  • mobile        │  │  • event-details │  │  • mobile        │
└──────────────────┘  └──────────────────┘  └──────────────────┘
```

## Benefits of This Architecture

### ✅ **Maintainability**

- Easy to find component styles
- No need to search through large files
- Clear ownership of styles

### ✅ **Modularity**

- Components are self-contained
- Can be moved/deleted easily
- Reusable across projects

### ✅ **Performance**

- Code splitting by component
- Smaller initial bundle size
- Lazy loading support

### ✅ **Developer Experience**

- Co-located styles with components
- Faster development
- Less cognitive load

### ✅ **Scalability**

- Easy to add new components
- No style conflicts
- Consistent patterns

## File Sizes (Approximate)

| File                 | Lines | Purpose                              |
| -------------------- | ----- | ------------------------------------ |
| `global.css`         | ~320  | Global styles, animations, utilities |
| `Header.css`         | ~110  | Header & navigation                  |
| `Hero.css`           | ~110  | Hero section                         |
| `Lessons.css`        | ~75   | Lessons section                      |
| `Instructor.css`     | ~130  | Instructor section                   |
| `Footer.css`         | ~75   | Footer                               |
| `Calendar.css`       | ~60   | Calendar component                   |
| `Contact.css`        | ~148  | Contact forms                        |
| `Events.css`         | ~163  | Events listing                       |
| `WorkInProgress.css` | ~70   | WIP page                             |

**Total:** ~1,261 lines organized across 10 files
**Before:** ~587 lines in 1 monolithic file + scattered styles

## Import Chain

```
main.tsx
  └─> styles.css
       └─> styles/global.css (animations, base styles)

Header.tsx
  └─> Header.css (header-specific)

Hero.tsx
  └─> Hero.css (hero-specific)

Lessons.tsx
  └─> Lessons.css (lessons-specific)

... and so on for each component
```

## Key Principles

1. **Co-location**: Styles live next to components
2. **Single Responsibility**: Each CSS file serves one purpose
3. **No Duplication**: Shared styles in global.css only
4. **Clear Boundaries**: Easy to know where to add styles
5. **Consistent Patterns**: Same structure for all components
