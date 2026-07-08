# Ritmo Vivo — Design System Conventions

**Aesthetic**: High-contrast glassmorphism. Dark slate background (`--bg: #0b1326`), rose-red primary, gold secondary, warm-orange tertiary. Translucent glass cards with 12px blur. No light mode.

## Styling idiom

This design system uses **CSS custom properties** (`var(--*)`) as its sole styling language. There are no utility-class names to invent — reference the tokens directly in inline styles or component CSS. The compiled styles ship in `styles.css` via `_ds_bundle.css` — load `styles.css` to receive all tokens, fonts, and shared classes.

## Token vocabulary

**Backgrounds**
| Token | Value | Use |
|---|---|---|
| `--bg` | `#0b1326` | Page/section background |
| `--surface` | `#131b2e` | Raised surface, alternate sections |
| `--surface-high` | `#171f33` | Cards, panels |
| `--card` | `rgba(255,255,255,0.08)` | Glassmorphic card fill |

**Accents**
| Token | Color |
|---|---|
| `--red` | Rose Red `#e11d48` (primary CTA, highlights) |
| `--red-bright` | `#ff5874` (hover state) |
| `--red-dim` | `rgba(225,29,72,0.18)` (tinted backgrounds) |
| `--gold` | `#e9c349` (secondary, prices, labels) |
| `--gold-light` | `#ffe088` (hover) |
| `--gold-dim` | `rgba(233,195,73,0.15)` (fills) |
| `--tertiary` | Warm Orange `#ffb690` (accent, tertiary text) |

**Text**
| Token | Use |
|---|---|
| `--text` | `#dae2fd` — primary text |
| `--text-muted` | `#e5bdbe` — subtext, captions |
| `--text-dim` | `#ac8889` — placeholder, disabled |

**Typography**
| Token | Family | Use |
|---|---|---|
| `--font-display` | Epilogue 800 | Headings, large display |
| `--font-ui` | Epilogue 600–700 | Buttons, labels, UI text |
| `--font-body` | Be Vietnam Pro | Body copy, descriptions |
| `--font-logo` | Great Vibes | Brand name only |

**Spacing (4px scale)**
`--space-xs` 4px · `--space-sm` 8px · `--space-md` 16px · `--space-lg` 24px · `--space-xl` 40px · `--space-xxl` 80px

**Border-radius**
`--radius-sm` 4px · `--radius` 8px · `--radius-md` 12px · `--radius-lg` 16px · `--radius-xl` 24px · `--radius-full` 9999px

**Glassmorphism formula**
```css
background: var(--card);
backdrop-filter: blur(var(--glass-blur));
-webkit-backdrop-filter: blur(var(--glass-blur));
border: 1px solid var(--border);
border-radius: var(--radius-lg);
```
Hover: add `box-shadow: var(--glow-primary)` and shift `border-color` to `--red-dim`.

**Other**
`--border` · `--border-md` · `--border-lg` (translucent white, 10/16/24% opacity)
`--glow-primary`: `0 0 24px rgba(225,29,72,0.30)` — rose glow shadow

## Shared CSS classes

These classes are shipped in `_ds_bundle.css` and available without extra work:

| Class | What it does |
|---|---|
| `.btn-primary` | Rose gradient pill button with sliding hover fill |
| `.btn-secondary` | Gold outline pill button → gold-dim fill on hover |
| `.btn-ghost` | Uppercase text with scaleX underline reveal on hover |
| `.style-chip` | Warm-orange pill for tags (On1 / On2 / Cuban) |
| `.container` | Centered max-width 1300px wrapper |
| `.section-title` | 800-weight display heading with rose rule underline |
| `.style-card` | Glassmorphic info card (hover: lift + glow) |
| `.contact-card` | Same glass pattern for contact/info cards |
| `.fade-in` | `fadeIn` keyframe — opacity+Y entry animation |

## Example

```jsx
// A card section with Ritmo Vivo tokens
function EventCard({ title, time, type }) {
  return (
    <article style={{
      background: 'var(--card)',
      backdropFilter: 'blur(var(--glass-blur))',
      WebkitBackdropFilter: 'blur(var(--glass-blur))',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)',
      padding: 'var(--space-lg)',
      color: 'var(--text)',
      fontFamily: 'var(--font-body)',
    }}>
      <span className="style-chip">{type}</span>
      <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, marginTop: 'var(--space-sm)' }}>
        {title}
      </h3>
      <p style={{ color: 'var(--text-muted)', marginTop: 'var(--space-xs)' }}>{time}</p>
      <a href="#" className="btn-primary" style={{ marginTop: 'var(--space-md)', display: 'inline-block' }}>
        RSVP
      </a>
    </article>
  );
}
```
