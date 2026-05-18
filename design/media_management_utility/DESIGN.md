---
name: Media Management Utility
colors:
  surface: '#0f1417'
  surface-dim: '#0f1417'
  surface-bright: '#353a3e'
  surface-container-lowest: '#0a0f12'
  surface-container-low: '#171c20'
  surface-container: '#1b2024'
  surface-container-high: '#252b2e'
  surface-container-highest: '#303539'
  on-surface: '#dee3e8'
  on-surface-variant: '#bdc8d0'
  inverse-surface: '#dee3e8'
  inverse-on-surface: '#2c3135'
  outline: '#87929a'
  outline-variant: '#3e484f'
  surface-tint: '#7bd0ff'
  primary: '#7bd0ff'
  on-primary: '#003549'
  primary-container: '#00a4dc'
  on-primary-container: '#00354a'
  inverse-primary: '#00668a'
  secondary: '#d1bcff'
  on-secondary: '#3c0090'
  secondary-container: '#562ca9'
  on-secondary-container: '#c4abff'
  tertiary: '#ffb869'
  on-tertiary: '#482900'
  tertiary-container: '#d78719'
  on-tertiary-container: '#4a2a00'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#c3e7ff'
  primary-fixed-dim: '#7bd0ff'
  on-primary-fixed: '#001e2c'
  on-primary-fixed-variant: '#004c69'
  secondary-fixed: '#eaddff'
  secondary-fixed-dim: '#d1bcff'
  on-secondary-fixed: '#24005b'
  on-secondary-fixed-variant: '#5429a6'
  tertiary-fixed: '#ffdcbb'
  tertiary-fixed-dim: '#ffb869'
  on-tertiary-fixed: '#2c1700'
  on-tertiary-fixed-variant: '#673d00'
  background: '#0f1417'
  on-background: '#dee3e8'
  surface-variant: '#303539'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-md:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  title-lg:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '500'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  code-sm:
    fontFamily: monospace
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  container-max: 1440px
  gutter: 16px
---

## Brand & Style
The design system is engineered for a high-performance media management environment. It prioritizes "Tool-like Precision" and "Cinematic Utility," ensuring that the interface remains unobtrusive while the user manages vast libraries of content. 

The aesthetic sits at the intersection of **Corporate Modern** and **Minimalism**. It utilizes a deep, nocturnal palette to reduce eye strain during long sessions and to make media artwork pop. The visual language is structured, dependable, and technical, evoking the feeling of a professional editing suite or a premium streaming dashboard. Success is measured by how quickly a user can parse complex metadata and take action.

## Colors
This design system employs a "Layered Charcoal" strategy. By using varying depths of black and dark gray, we create visual hierarchy without relying on heavy shadows. 

- **Primary Action**: A vibrant "Electric Blue" (#00A4DC) is used exclusively for primary interactions, progress bars, and active selection states.
- **Surface Strategy**: The UI moves from the darkest shade (#101010) for the global background to lighter grays (#282828) as elements "rise" toward the user.
- **Functional Accents**: Semantic colors (Green, Amber, Red) are desaturated slightly to maintain a professional look while remaining highly legible against dark backgrounds.
- **Typography**: Pure white is reserved for high-level headings. All secondary metadata and labels use a muted gray to reduce visual noise in data-heavy views.

## Typography
We use **Inter** for all UI elements to achieve a systematic, utilitarian feel. The type scale is optimized for high information density.

- **Headlines**: Use Semi-Bold weights with slight negative letter-spacing to appear compact and modern.
- **Body Text**: Optimized for legibility at 14px and 16px. 
- **Labels**: Small caps or bolded 12px labels are used for metadata like "CODEC," "RESOLUTION," or "LANGUAGE" to distinguish them from content titles.
- **Technical Data**: For file paths or subtitle timestamps, a monospaced font should be used to ensure character alignment.

## Layout & Spacing
The layout follows a **12-column fluid grid** with a fixed maximum width for content-heavy dashboard views.

- **Rhythm**: An 8px base unit governs all dimensions.
- **Grid Strategy**: Use a 16px gutter for standard lists. For media poster grids (Movie/TV shows), use a 24px gutter to give the artwork more breathing room.
- **Mobile Adaptation**: On mobile devices, margins shrink to 16px and the 12-column grid collapses into a single-column vertical stack for lists or a 2-column grid for media posters.
- **Density**: Use "Compact" (8px padding) for data tables and "Spacious" (24px padding) for hero sections and settings panels.

## Elevation & Depth
This design system avoids heavy drop shadows, which can feel muddy in dark interfaces. Instead, it uses **Tonal Layering** and **Low-Contrast Outlines**.

1.  **Level 0 (Base)**: `#101010` - The main canvas.
2.  **Level 1 (Surface)**: `#181818` - Navigation sidebars and footer bars.
3.  **Level 2 (Panel)**: `#202020` - Secondary containers or grouped content.
4.  **Level 3 (Card/Overlay)**: `#282828` - Floating cards, modals, and tooltips.

**Borders**: Every raised element should have a subtle `1px` solid border using a slightly lighter gray (e.g., `#333333`) at 50% opacity. This "Ghost Border" provides necessary definition between dark surfaces without adding visual weight.

## Shapes
The shape language is "Soft-Technical." Elements use a consistent rounding logic to feel modern but structured.

- **Primary Radius**: 8px (`rounded-md`) for buttons, input fields, and small cards.
- **Large Radius**: 12px-16px (`rounded-lg/xl`) for main media posters and modal containers.
- **Interactive States**: Buttons should maintain their radius even when hovered, though a subtle scale-up (102%) is permitted to indicate interactivity.

## Components

### Buttons
- **Primary**: Solid `#00A4DC` background with white text. 8px radius.
- **Secondary**: Ghost style with `#333333` border and white text.
- **Danger**: Subtle red border with red text, shifting to solid red on hover.

### Media Cards
- **Poster**: 2:3 aspect ratio with a 12px radius. 
- **Overlay**: On hover, a 40% black gradient overlay appears from the bottom to make white "Play" and "Edit" icons legible.

### Inputs & Search
- **Fields**: Background color `#202020` with a 1px border. Focus state changes border color to `#00A4DC`.
- **Search**: Large search bars in the header should be semi-transparent with a backdrop-blur of 10px.

### Status Chips
- Small, uppercase 10px bold text. 
- Backgrounds are tinted at 15% opacity of the status color (e.g., 15% Green) with 100% opacity text for maximum readability without being distracting.

### Lists & Tables
- **Row Styling**: Alternating zebra stripes are not used. Instead, use a 1px bottom border (`#202020`) and a subtle `#282828` background on hover.
- **Icons**: Use 20px minimalist line icons (Lucide/Heroicons) with a stroke weight of 1.5px. Secondary icons should be muted to `#666666`.