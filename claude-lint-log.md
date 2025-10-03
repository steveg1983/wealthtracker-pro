
---

## 2025-10-02 - Insights Dashboard Type Cleanup (ChatGPT)

**Branch:** decimal-migration-restore

**Scope:** Remove remaining `as any` usage in the insights dashboard and customizable dashboard widget factory.

**Commands run:**
```bash
npx eslint src/components/DataInsights.tsx src/components/CustomizableDashboard.tsx
npm run lint
```

**Files changed (2 total):**
- `src/components/DataInsights.tsx` – added typed filter/sort helpers so select handlers no longer rely on `as any` casts.
- `src/components/CustomizableDashboard.tsx` – defined `AvailableWidgetType` alias and removed the widget creation cast.

**Result:**
- ✅ Eliminated 2 `@typescript-eslint/no-explicit-any` warnings in the insights dashboard filters.
- ✅ Removed 1 `@typescript-eslint/no-explicit-any` warning when adding new dashboard widgets.
- Global lint baseline: `0 errors / 1,742 warnings` (down from 1,761 prior to this pass).

**Verification:**
```bash
npx eslint src/components/DataInsights.tsx src/components/CustomizableDashboard.tsx
npm run lint
```
