# Component Development Guidelines

This document covers component patterns for the Thunder Subtitle dark-themed web UI.

## All Components are Client Components

Every interaction in this app requires client-side state (auth, search, form input), so all page and UI components use `'use client'`.

```typescript
'use client';

import { useState } from 'react';

export function SearchBox({ onSearch }: { onSearch: (name: string) => void }) {
  const [value, setValue] = useState('');
  // ...
}
```

Exception: `page.tsx` (root redirect) and `layout.tsx` may be Server Components when they only compose Client Components without state.

## AppShell Layout Pattern

The app uses a fixed sidebar + topbar layout pattern:

```typescript
// AppShell wraps all authenticated pages
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';

  if (isLoginPage) return <>{children}</>; // No chrome on login

  return (
    <>
      <Sidebar />
      <div className="ml-64 flex min-h-screen flex-1 flex-col overflow-y-auto">
        <TopBar />
        <main className="flex-1 p-8">{children}</main>
        <footer>...</footer>
      </div>
    </>
  );
}
```

Key layout rules:
- Sidebar is fixed (`fixed left-0 top-0 w-64`)
- Main content has `ml-64` to offset sidebar width
- Outer container: `flex h-screen overflow-hidden`
- Main content: `flex min-h-screen flex-1 flex-col overflow-y-auto`

## Component Patterns

### Page with Auth Guard

```typescript
// app/search/page.tsx
'use client';

import { withAuth } from '@/lib/auth';

function SearchPage() {
  const { isAuthenticated } = useAuth();
  // Page logic...
}

export default withAuth(SearchPage);
```

### Sidebar Navigation

```typescript
// Sidebar uses lucide-react icons and i18n
import { Search, Monitor, CheckSquare, Settings, LogOut } from 'lucide-react';
import { useTranslations } from '@/lib/i18n';
import { useAuth } from '@/lib/auth';

const navItems = [
  { id: 'search', path: '/search', icon: SearchIcon },
  { id: 'scanner', path: '/scanner', icon: ScannerIcon },
  { id: 'verification', path: '/verification', icon: VerificationIcon },
  { id: 'settings', path: '/settings', icon: SettingsIcon },
] as const;
```

Active state detection: `pathname === item.path || pathname.startsWith(item.path + '/')`.

### TopBar (Language Toggle)

```typescript
// TopBar provides language switching
const { language, setLanguage } = useLanguage();
const handleToggleLanguage = useCallback(() => {
  setLanguage(language === 'en' ? 'zh' : 'en');
}, [language, setLanguage]);
```

## Dark Theme Styling

All components use design token classes, never hardcoded colors:

```typescript
// Good: Use design tokens
<button className="bg-primary text-on-primary hover:bg-primary-container">
  Action
</button>

// Bad: Hardcoded colors
<button className="bg-blue-500 text-white hover:bg-blue-600">
  Action
</button>
```

See [css-layout.md](./css-layout.md) for the full token reference.

## Semantic HTML

```typescript
// Use <button> for clickable actions
<button type="button" onClick={logout} className="...">
  <LogOut size={20} />
  <span>{t('logout')}</span>
</button>

// Use <Link> for navigation
<Link href="/search" className="...">Search</Link>
```

## Touch Optimization

All interactive elements disable tap highlight:

```typescript
<button style={{ WebkitTapHighlightColor: 'transparent' }}>
  ...
</button>
```

## Loading States

When checking auth, always show a spinner during `isLoading`:

```typescript
if (isLoading) {
  return (
    <div className="flex h-screen w-full items-center justify-center bg-surface">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}
```

## Shared Components

### ConfirmDialog

Generic confirmation dialog used across multiple pages. Consolidates overlay backdrop, centered card, title, message, confirm/cancel buttons into one reusable component.

```typescript
import { ConfirmDialog } from '@/components/ConfirmDialog';

<ConfirmDialog
  open={confirmDelete}
  onClose={() => setConfirmDelete(false)}
  title="删除全部字幕"
  message="确定要删除全部字幕文件吗？此操作不可撤销。"
  confirmLabel="全部删除"
  cancelLabel={t("cancel")}
  loadingLabel={t("loading")}
  variant="danger"  // "danger" = red confirm button, "default" = blue
  isLoading={isDeleting}
  onConfirm={handleDelete}
>
  {/* Optional children for extra content (inputs, warnings, etc.) */}
</ConfirmDialog>
```

Key rules:
- `variant="danger"` for destructive actions (red button), `variant="default"` otherwise
- All text props accept translated strings via `t()`
- Backdrop click closes the dialog, card click does not propagate
- Use `WebkitTapHighlightColor: "transparent"` on all buttons

### StatusBadge / DryStateBadge

Unified badge components for scan result statuses and dry_run states. Eliminates duplicated color-mapping logic.

```typescript
import { StatusBadge, DryStateBadge, getStatusColor } from '@/components/StatusBadge';

// As component
<StatusBadge status="downloaded" label={t("status_downloaded")} />
<DryStateBadge dryState="need_review" label={t("dry_need_review")} />

// As utility function (for inline styling)
<span className={getStatusColor(finding.status)}>{label}</span>
```

**Rule**: Never write inline status/dry_state color mapping. Always use `StatusBadge`, `DryStateBadge`, or the utility functions.

## Component Size Limits

| Component Type | Max Lines | Action if Exceeded |
|---------------|-----------|-------------------|
| Page component | ~800 | Extract sub-components to `components/` |
| Single function/handler | ~50 | Extract to utility function or custom hook |
| Dialog/modal content | ~50 | Extract to dedicated dialog component |

**Why**: The verification page grew to 1098 lines before refactoring, causing:
- Hard-to-spot closure bugs (`setState(null)` then using stale value in callback)
- Duplicated dialog patterns (5 inline modals)
- Difficult maintenance

## Best Practices

1. **Use design tokens** — Always use `bg-surface`, `text-primary`, etc., never raw hex
2. **Client Components** — All interactive components use `'use client'`
3. **`withAuth()` for pages** — Wrap authenticated pages with the HOC
4. **`useTranslations()` for text** — Never hardcode UI strings
5. **lucide-react for icons** — Import from `lucide-react`
6. **Touch-friendly** — Disable tap highlight, ensure 44px minimum targets
7. **Type props** — Always define TypeScript interfaces for component props
8. **Extract before 800 lines** — Pages exceeding ~800 lines must be split into sub-components
9. **No duplicate color maps** — Use `StatusBadge`/`DryStateBadge` instead of inline status color logic
10. **Use `ConfirmDialog` for modals** — Never create ad-hoc modal dialogs with overlay backdrop