# CSS & Layout — Dark Theme Design System

This document covers the dark theme design tokens and layout patterns used in Thunder Subtitle Web.

## Design Tokens

All tokens are defined in `globals.css` using `@theme` (TailwindCSS v4):

### Color Palette

| Token | Hex | Usage |
|-------|-----|-------|
| `--color-surface` | `#0f1417` | Page background |
| `--color-surface-dim` | `#0f1417` | Dimmed surface |
| `--color-surface-bright` | `#353a3e` | Bright surface |
| `--color-surface-container-lowest` | `#0a0f12` | Deepest container |
| `--color-surface-container-low` | `#171c20` | Low container (sidebar bg) |
| `--color-surface-container` | `#1b2024` | Default container |
| `--color-surface-container-high` | `#252b2e` | High container (hover bg) |
| `--color-surface-container-highest` | `#303539` | Highest container |
| `--color-on-surface` | `#dee3e8` | Primary text |
| `--color-on-surface-variant` | `#bdc8d0` | Secondary text |
| `--color-primary` | `#7bd0ff` | Electric Blue — links, active states |
| `--color-on-primary` | `#003549` | Text on primary |
| `--color-primary-container` | `#00A4DC` | Primary container |
| `--color-on-primary-container` | `#00354A` | Text on primary container |
| `--color-secondary` | `#d1bcff` | Purple accent |
| `--color-secondary-container` | `#562ca9` | Purple container |
| `--color-tertiary` | `#ffb869` | Amber accent |
| `--color-tertiary-container` | `#d78719` | Amber container |
| `--color-error` | `#ffb4ab` | Error text |
| `--color-error-container` | `#93000a` | Error bg |
| `--color-outline` | `#87929a` | Borders (visible) |
| `--color-outline-variant` | `#3e484f` | Borders (subtle) |
| `--color-inverse-surface` | `#dee3e8` | Inverted surface |
| `--color-inverse-on-surface` | `#2c3135` | Text on inverted |
| `--color-background` | `#0f1417` | Root background |
| `--color-on-background` | `#dee3e8` | Text on background |

### Typography

```css
--font-sans: "Inter", ui-sans-serif, system-ui, sans-serif;
--font-mono: "SF Mono", ui-monospace, "Cascadia Code", "Fira Code", monospace;
```

### Border Radius

```css
--radius-sm: 0.25rem;  /* 4px */
--radius-md: 0.75rem;  /* 12px */
--radius-lg: 1rem;     /* 16px */
--radius-xl: 1.5rem;   /* 24px */
--radius-full: 9999px;  /* Pill */
```

## Using Design Tokens

In TailwindCSS v4, tokens defined in `@theme` become utility classes:

```typescript
// Background & Surface
<div className="bg-surface">                     // Main background #0f1417
<div className="bg-surface-container-low">        // Sidebar background #171c20
<div className="bg-surface-container-high">       // Hover background #252b2e

// Text
<span className="text-on-surface">               // Primary text #dee3e8
<span className="text-on-surface-variant">        // Secondary text #bdc8d0
<span className="text-primary">                    // Accent text #7bd0ff

// Borders
<div className="border border-outline-variant/30">  // Subtle divider
<div className="border border-outline">              // Visible border

// Primary actions
<button className="bg-primary text-on-primary">    // Blue button
<button className="hover:bg-surface-container-high"> // Hover state
```

## Layout Patterns

### App Shell (Sidebar + TopBar + Content)

```typescript
// Sidebar: fixed left, full height
<aside className="fixed left-0 top-0 z-50 flex h-full w-64 flex-col
  border-r border-outline-variant/30 bg-surface-container-low px-4 py-6">

// Main content: offset by sidebar width
<div className="ml-64 flex min-h-screen flex-1 flex-col overflow-y-auto">

// TopBar: sticky header
<header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between
  border-b border-outline-variant/30 bg-surface px-8">
```

### Full-Page Centered Content

```typescript
<div className="flex h-screen w-full items-center justify-center bg-surface">
  <Spinner />
</div>
```

### Card / Container Pattern

```typescript
<div className="rounded-lg border border-outline-variant/30 bg-surface-container p-6">
  {/* Card content */}
</div>
```

## Custom Scrollbar

```css
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: var(--color-surface-container-low); }
::-webkit-scrollbar-thumb { background: var(--color-outline-variant); border-radius: 9999px; }
::-webkit-scrollbar-thumb:hover { background: var(--color-outline); }
```

## Utility Classes

```css
.ghost-border { border: 1px solid rgba(135, 146, 154, 0.2); }
.focus-ring { /* focus-visible ring */ }
```

## Responsive Design

The app uses `ml-64` for the sidebar offset on all screens. For mobile adaptations, consider collapsing the sidebar with a toggle.

## Animation Patterns

```typescript
// Spinner
<div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />

// Active press feedback
<button className="active:scale-95 transition-all duration-100">
```

## Tap Highlight

All interactive elements disable mobile tap highlight globally:

```css
* { -webkit-tap-highlight-color: transparent; }
```

Or per-element:

```typescript
<button style={{ WebkitTapHighlightColor: 'transparent' }}>
```

## Best Practices

1. **Always use design tokens** — never hardcode hex colors
2. **Use border-opacity for subtlety** — `border-outline-variant/30` for dividers
3. **Test dark contrast** — ensure text-on-surface-variant is readable
4. **Use `bg-surface-container-high`** for hover states, not raw colors
5. **Use `ghost-border`** class for very subtle borders
6. **Use `focus-ring`** class for keyboard focus visibility