# Phase 4: Performance Optimization - Bundle Deep Dive Analysis

**Date**: 2025-09-30
**Status**: Analysis Complete - Ready for Phase 4 Execution
**Current Bundle**: 580KB gzipped initial load
**Target**: <200KB gzipped initial load
**Gap**: 2.9x over target (380KB to eliminate)
**Priority**: 🚨 CRITICAL - User experience requirement

---

## Executive Summary

**Current State**: Initial page load requires ~580KB gzipped (index 133KB + vendor-shared 197KB + other vendors loaded on mount).

**Target State**: <200KB gzipped for fast first paint on mobile/slow networks.

**Gap Analysis**: Need to eliminate 380KB (65%) from initial load through code splitting, lazy loading, and tree-shaking.

**Effort**: 40-60 hours systematic optimization

**Approach**: Route-level code splitting, defer heavy vendors, tree-shake unused code

---

## Current Bundle Composition (Post Phase 0 Optimizations)

### Top 10 Chunks (by gzipped size):

| Rank | File | Uncompressed | Gzipped | % of Total | Status |
|------|------|--------------|---------|------------|--------|
| 1 | `vendor-plotly` | 1.2MB | **427KB** | 42% | ⚠️ Lazy loaded |
| 2 | `vendor-export` | 1.1MB | **354KB** | 35% | ⚠️ Lazy loaded |
| 3 | `vendor-shared` | 583KB | **197KB** | 19% | 🔴 **INITIAL LOAD** |
| 4 | `vendor-grid` | 526KB | **143KB** | 14% | ⚠️ Analytics only |
| 5 | `index` | 558KB | **133KB** | 13% | 🔴 **INITIAL LOAD** |
| 6 | `vendor-charting` | 451KB | **123KB** | 12% | ⚠️ Dashboard/Analytics |
| 7 | `FinancialPlanning` | 371KB | **64KB** | 6% | ✅ Route chunk |
| 8 | `vendor-react-core` | 137KB | **45KB** | 4% | 🔴 **INITIAL LOAD** |
| 9 | `Transactions` | 138KB | **26KB** | 3% | ✅ Route chunk |
| 10 | `vendor-supabase` | 91KB | **24KB** | 2% | 🔴 **INITIAL LOAD** |

**Initial Load Estimate**: 133KB (index) + 197KB (vendor-shared) + 45KB (react-core) + 24KB (supabase) = **~400KB gzipped**

**Target**: <200KB gzipped
**Gap**: 200KB to eliminate (50% reduction needed)

---

## Analysis by Vendor Chunk

### 🔴 vendor-shared (583KB / 197KB gz) - **PRIMARY TARGET**

**Contents**: Catch-all for libraries not in specific vendor chunks
- DOMPurify (security)
- react-dropzone (file uploads)
- crypto-js (encryption)
- SWR (data fetching)
- lodash-es utilities
- Various small dependencies

**Optimization Opportunities**:
1. **Move dropzone to upload-specific chunk** (est. -30KB gz)
   - Only used in import/document upload flows
   - Create `vendor-upload` chunk

2. **Defer crypto-js** (est. -20KB gz)
   - Only needed for encrypted storage operations
   - Lazy load when encryption needed

3. **Audit lodash-es usage** (est. -10KB gz)
   - Check if tree-shaking is working
   - Replace with native equivalents where possible

4. **Move SWR to data-heavy routes** (est. -15KB gz)
   - Used for caching, not needed on initial mount

**Potential Savings**: 75KB gzipped

---

### ⚠️ vendor-plotly (1.2MB / 427KB gz) - **ALREADY LAZY**

**Current Status**: ✅ Lazy loaded via `src/lib/plotlyLight.ts`
**Loaded By**: Analytics page, ChartWizard component

**Registered Traces** (14 total):
- bar, box, candlestick, funnel, gauge, heatmap
- pie, sankey, scatter, scatterpolar, sunburst
- treemap, violin, waterfall

**Optimization Opportunities**:
1. **Audit actual ChartWizard usage** (est. -50-100KB gz)
   - Check which traces are actually used in production
   - Remove unused traces (funnel, gauge, candlestick, waterfall?)

2. **Consider Recharts migration** (est. -400KB gz if full migration)
   - Recharts is already in vendor-charting (123KB gz)
   - May not need Plotly at all

3. **Defer D3 dependencies** (already done ✅)

**Potential Savings**: 50-100KB gzipped (or 427KB if migrate to Recharts)

---

### ⚠️ vendor-export (1.1MB / 354KB gz) - **ALREADY LAZY**

**Current Status**: ✅ Lazy loaded
**Loaded By**: Export flows only

**Contents**: xlsx, jspdf, jspdf-autotable, html2canvas, canvg, pako, fflate, etc.

**Optimization Opportunities**:
1. **Already optimal** - Lazy loaded on demand ✅
2. **Consider server-side export** (future enhancement)
   - Move export generation to serverless function
   - Reduces client bundle entirely

**Potential Savings**: None immediately (already lazy)

---

### ⚠️ vendor-grid (526KB / 143KB gz) - **ANALYTICS ONLY**

**Current Status**: ✅ Used only on Analytics page
**Contents**: ag-grid-community, ag-grid-react

**Optimization Opportunities**:
1. **Verify lazy loading** (may already be route-chunked)
2. **Consider lighter alternative** for simple tables
   - ag-grid is powerful but heavy
   - Use native tables for simple data

**Potential Savings**: 0-143KB if replaced (but ag-grid provides value)

---

### ⚠️ vendor-charting (451KB / 123KB gz) - **DASHBOARD/ANALYTICS**

**Current Status**: Used by Dashboard and Analytics pages
**Contents**: Recharts (Chart.js removed in Phase 1)

**Optimization Opportunities**:
1. **Defer until dashboard/analytics route loads** (est. -123KB gz)
   - Not needed for login/settings pages
   - Lazy load on dashboard mount

2. **Tree-shake unused Recharts components**
   - Audit which chart types are used
   - Remove unused chart components

**Potential Savings**: 60-80KB gzipped (if deferred from initial load)

---

### 🔴 index (558KB / 133KB gz) - **INITIAL LOAD - APP SHELL**

**Contents**: Application shell, routing, core components

**Optimization Opportunities**:
1. **Route-level code splitting** (est. -40-60KB gz)
   - Move page imports to lazy()
   - Split by route: Dashboard, Transactions, Analytics, etc.

2. **Defer non-critical contexts** (est. -20KB gz)
   - Load some contexts only when needed
   - Keep Auth/Theme/Core, defer others

3. **Tree-shake unused exports** (est. -10-20KB gz)
   - Audit what's actually used
   - Remove dead code

**Potential Savings**: 70-100KB gzipped

---

### 🔴 vendor-react-core (137KB / 45KB gz) - **INITIAL LOAD - FOUNDATION**

**Current Status**: ✅ Excellent size for React + ReactDOM
**Contents**: react, react-dom, scheduler

**Optimization**: Already optimal ✅
- This is baseline React cost
- Cannot reduce without removing React
- 45KB is world-class for React core

**Potential Savings**: 0KB (already excellent)

---

## Route-Level Analysis

### Current Route Chunks:
```
✅ FinancialPlanning - 371KB / 64KB gz (route chunk)
✅ Transactions - 138KB / 26KB gz (route chunk)
✅ Budget - 83KB / 14KB gz (route chunk)
✅ Investments - 88KB / 20KB gz (route chunk)
✅ EnhancedInvestments - 81KB / 16KB gz (route chunk)
```

### Missing Route Chunks (Opportunities):
```
❌ Dashboard routes - May be in index chunk
❌ Analytics routes - Heavy (ag-grid, charting)
❌ Settings routes - Could be split
❌ Reports routes - Could be split
```

**Opportunity**: Ensure ALL routes are code-split (est. -50-80KB gz from index)

---

## Specific Optimization Strategies

### Strategy 1: Defer vendor-shared Components (High Impact)

**Target**: Reduce vendor-shared from 197KB → ~120KB gzipped

**Actions**:
1. **Create vendor-upload chunk** (DOMPurify, react-dropzone, file-selector)
   - Only load on import/document upload pages
   - Estimated savings: 30KB gzipped

2. **Defer crypto-js** (lazy load when encryption needed)
   - Only load when accessing encrypted storage
   - Estimated savings: 20KB gzipped

3. **Optimize lodash-es** (audit tree-shaking)
   - Verify only used functions are imported
   - Replace with native where possible (Array.filter, etc.)
   - Estimated savings: 10KB gzipped

4. **Move SWR to data routes** (defer caching lib)
   - Not needed on initial mount
   - Estimated savings: 15KB gzipped

**Total Strategy 1 Savings**: 75KB gzipped

---

### Strategy 2: Aggressive Route Code Splitting (High Impact)

**Target**: Reduce index from 133KB → ~80KB gzipped

**Actions**:
1. **Convert all page imports to React.lazy()**
   ```typescript
   // Instead of:
   import Dashboard from './pages/Dashboard';

   // Use:
   const Dashboard = lazy(() => import('./pages/Dashboard'));
   ```

2. **Split context providers by route**
   - Core contexts: Auth, Theme, Preferences (keep in index)
   - Feature contexts: Realtime, Offline, Household (lazy load)

3. **Defer heavy component libraries**
   - Move chart components to route chunks
   - Defer grid components until needed

**Total Strategy 2 Savings**: 40-60KB gzipped

---

### Strategy 3: Optimize vendor-charting (Medium Impact)

**Target**: Defer Recharts until dashboard/analytics load

**Actions**:
1. **Lazy load on route mount**
   ```typescript
   // In Dashboard.tsx
   const Charts = lazy(() => import('../components/charts'));
   ```

2. **Tree-shake unused Recharts components**
   - Audit which charts are actually used
   - Only import needed components

**Total Strategy 3 Savings**: 60-80KB gzipped

---

### Strategy 4: Plotly Registry Optimization (Low Impact - Already Lazy)

**Current**: 14 traces registered in plotlyLight.ts

**Audit Which Traces Are Actually Used**:
```bash
# Search for Plotly usage in components
rg "type:.*scatter|type:.*bar|type:.*pie" src/
```

**Potential Removals** (if not used):
- candlestick (financial charts - check if used)
- funnel (conversion funnels - check if used)
- gauge (rarely used)
- violin (statistical - check if used)
- waterfall (financial - check if used)
- scatterpolar (polar plots - check if used)

**Each trace removed**: ~5-10KB gzipped

**Total Strategy 4 Savings**: 30-60KB gzipped (if 6 traces removed)

---

## Tree-Shaking Opportunities

### 1. Icon Libraries
**Current**: vendor-icons (69KB / 14KB gz)
**Opportunity**: Using icon facade already ✅
**Status**: Optimized

### 2. Date-fns
**Current**: In vendor-core (44KB / 16KB gz)
**Check**: Are all imported functions used?
**Action**: Audit imports, tree-shake unused

### 3. Lodash-es
**Current**: In vendor-shared
**Check**: Tree-shaking working?
**Action**: Verify imports are specific (`import { get }` not `import _`)

---

## Recommended Phase 4 Execution Order

### Week 1: Vendor-Shared Optimization (15-20 hours)
**Goal**: Reduce vendor-shared from 197KB → 120KB gzipped

1. Create vendor-upload chunk (4-6 hours)
2. Defer crypto-js (2-3 hours)
3. Optimize lodash-es (4-6 hours)
4. Move SWR to data routes (3-4 hours)
5. Test and verify (2-3 hours)

**Target**: -75KB gzipped

### Week 2: Route Code Splitting (15-20 hours)
**Goal**: Reduce index from 133KB → 80KB gzipped

1. Convert page imports to lazy() (6-8 hours)
2. Split context providers (4-6 hours)
3. Defer heavy components (3-4 hours)
4. Test route transitions (2-3 hours)

**Target**: -50KB gzipped

### Week 3: Vendor-Charting Deferral (10-15 hours)
**Goal**: Remove Recharts from initial load

1. Lazy load on dashboard mount (4-6 hours)
2. Tree-shake unused components (3-5 hours)
3. Test all charts still work (3-4 hours)

**Target**: -70KB gzipped

### Week 4: Final Optimizations (10-15 hours)
**Goal**: Reach <200KB target

1. Plotly trace audit (3-4 hours)
2. Date-fns tree-shaking (2-3 hours)
3. Final measurements (2-3 hours)
4. Lighthouse verification (3-5 hours)

**Target**: Hit <200KB gzipped ✅

---

## Detailed Vendor Analysis

### vendor-shared Breakdown (583KB / 197KB gz)

**Major Contributors** (estimated):
- DOMPurify: ~25-30KB gz (security - KEEP)
- react-dropzone + file-selector: ~30KB gz (DEFER to upload routes)
- crypto-js: ~20KB gz (DEFER to encryption operations)
- SWR: ~15KB gz (DEFER to data-heavy routes)
- lodash-es: ~15KB gz (AUDIT tree-shaking)
- dompurify: ~20KB gz (KEEP - security critical)
- Other utilities: ~70KB gz (AUDIT individually)

**Optimization Plan**:
1. **Immediate deferrals** (upload + crypto): -50KB gz
2. **Lodash audit**: -10KB gz
3. **SWR defer**: -15KB gz
4. **Total**: -75KB gz → **122KB gz** ✅

---

### vendor-plotly (1.2MB / 427KB gz) - Lazy Loaded ✅

**Status**: Already lazy loaded, only loads on Analytics page
**Contents**: 14 Plotly traces registered

**Usage Audit Needed**:
```bash
# Find which traces are actually used
rg "type.*:.*['\"]scatter" src/
rg "type.*:.*['\"]bar" src/
rg "type.*:.*['\"]pie" src/
# ... etc for all 14 traces
```

**Likely Unused** (candidates for removal):
- candlestick (unless stock charts)
- funnel (unless conversion tracking)
- gauge (unless using gauge widgets)
- violin (unless statistical analysis)
- waterfall (unless using waterfall charts)
- scatterpolar (unless polar plots)

**Each trace**: ~30-60KB uncompressed, ~5-10KB gzipped

**Optimization**: Remove 6 unused traces = -30-60KB gzipped

---

### vendor-export (1.1MB / 354KB gz) - Lazy Loaded ✅

**Status**: Already optimized ✅
**Loaded**: Only when user triggers export

**Contents**: xlsx, jspdf, jspdf-autotable, html2canvas, canvg, compression libs

**No immediate optimizations** - Already lazy loaded properly.

**Future Enhancement**: Server-side export generation (eliminates chunk entirely)

---

### vendor-grid (526KB / 143KB gz) - Analytics Only

**Status**: Used on Analytics page only
**Contents**: ag-grid-community, ag-grid-react

**Optimization Opportunities**:
1. **Verify route chunking** - Should only load with Analytics route
2. **Consider alternatives** for simple tables
   - ag-grid is powerful but heavy
   - Simple data tables could use native HTML tables
   - Complex analytics keeps ag-grid

**Decision**: Keep ag-grid for Analytics (provides value), ensure route-chunked

---

### vendor-charting (451KB / 123KB gz) - Dashboard/Analytics

**Status**: Used on Dashboard and Analytics
**Contents**: Recharts

**Optimization Strategy**:
1. **Defer until dashboard route loads** (est. -123KB from initial)
   - Not needed for login/settings
   - Lazy load on dashboard mount

2. **Tree-shake unused Recharts components**
   - Audit: LineChart, BarChart, PieChart, AreaChart usage
   - Remove: Unused chart types
   - Estimated savings: -20-30KB

**Total Savings**: 90-110KB gzipped (if deferred)

---

## Route-Level Code Splitting Strategy

### Current Routing (Check if lazy):
```typescript
// Need to verify in App.tsx or routing config
- Dashboard routes (/, /dashboard, /dashboard-v2)
- Transaction routes (/transactions, /account-transactions)
- Analytics routes (/analytics, /advanced-analytics)
- Financial Planning (/financial-planning)
- Settings routes (/settings/*)
- Reports routes (/reports, /custom-reports)
```

### Recommended Lazy Loading:
```typescript
// Core (keep in index): Login, Auth, Error pages
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Transactions = lazy(() => import('./pages/Transactions'));
const Analytics = lazy(() => import('./pages/Analytics'));
const FinancialPlanning = lazy(() => import('./pages/FinancialPlanning'));
const Settings = lazy(() => import('./pages/Settings'));
const Reports = lazy(() => import('./pages/Reports'));
const Investments = lazy(() => import('./pages/Investments'));
```

### Context Deferral:
```typescript
// Keep in index:
- AuthContext (required)
- ThemeContext (visual consistency)
- PreferencesContext (core settings)

// Defer to routes:
- RealtimeContext (analytics/dashboard only)
- OfflineContext (when offline detected)
- HouseholdContext (settings only)
- SubscriptionContext (settings/billing only)
```

**Estimated Savings**: 40-60KB gzipped from index

---

## Tree-Shaking Audit

### Lodash-es Check:
```bash
# Should see specific imports, not full library
rg "import .* from 'lodash-es'" src/

# If seeing: import _ from 'lodash-es' - FIX IT
# Should be: import { get, set } from 'lodash-es'
```

### Date-fns Check:
```bash
# Should see specific function imports
rg "import .* from 'date-fns'" src/

# Verify using: import { format, parse } from 'date-fns'
# Not: import * as dateFns from 'date-fns'
```

### Recharts Check:
```bash
# Should import specific components
rg "import .* from 'recharts'" src/

# Good: import { LineChart, BarChart } from 'recharts'
# Bad: import * as Recharts from 'recharts'
```

---

## Bundle Budget Enforcement

### Recommended Budgets:
```json
{
  "index": {
    "max": "90KB",
    "maxGz": "30KB"
  },
  "vendor-shared": {
    "max": "400KB",
    "maxGz": "130KB"
  },
  "vendor-react-core": {
    "max": "150KB",
    "maxGz": "50KB"
  },
  "route-chunks": {
    "max": "200KB",
    "maxGz": "60KB"
  },
  "vendor-lazy": {
    "max": "unlimited",
    "note": "Lazy chunks can be larger as they don't block initial load"
  }
}
```

### CI Integration:
```bash
# Add to package.json scripts
"bundle:check": "node scripts/bundle-size-check.js --budget",
"bundle:ci": "npm run build && npm run bundle:check"

# Fail CI if budgets exceeded
```

---

## Performance Targets

### Current Performance:
- **Initial load**: ~580KB gzipped
- **Time to Interactive**: Unknown (need Lighthouse)
- **First Contentful Paint**: Unknown
- **Largest Contentful Paint**: Unknown

### Target Performance (Apple/Google/Microsoft standard):
- **Initial load**: <200KB gzipped ✅ PRIMARY TARGET
- **Time to Interactive**: <3s on 3G
- **First Contentful Paint**: <1.5s
- **Largest Contentful Paint**: <2.5s
- **Lighthouse Score**: >90 on mobile

### Measurement Strategy:
```bash
# Local Lighthouse
npm run lighthouse

# CI Lighthouse
# Add @lhci/cli to run on every PR
npm run lighthouse:ci
```

---

## Quick Wins (Can Do Immediately)

### Quick Win 1: Create vendor-upload Chunk (2-3 hours)
```typescript
// In vite.config.ts manualChunkGroups
{
  name: 'vendor-upload',
  test: id => /node_modules[/](react-dropzone|file-selector|attr-accept)/.test(id)
}
```
**Savings**: 30KB gzipped

### Quick Win 2: Lazy Load Recharts (4-6 hours)
```typescript
// In Dashboard components
const Charts = lazy(() => import('../components/charts'));
```
**Savings**: 60-80KB gzipped from initial load

### Quick Win 3: Audit Plotly Traces (2-3 hours)
```bash
# Find which traces are used
rg "type.*:.*scatter|bar|pie" src/components/analytics/
```
**Savings**: 30-60KB gzipped if 6 traces removed

**Total Quick Wins**: 120-170KB gzipped in 8-12 hours

---

## Success Criteria

### Phase 4 Exit Requirements:
- [ ] Initial bundle <200KB gzipped
- [ ] vendor-shared <130KB gzipped
- [ ] index <90KB gzipped
- [ ] All routes lazy loaded
- [ ] All lazy vendors deferred properly
- [ ] Bundle budgets enforced in CI
- [ ] Lighthouse score >90 on mobile
- [ ] Core Web Vitals: all green
- [ ] Performance regression tests in CI

### Verification:
```bash
# Check bundle sizes
npm run build && npm run bundle:report

# Should see:
# index-*.js.gz < 90KB ✅
# vendor-shared-*.js.gz < 130KB ✅
# Total initial load < 200KB ✅

# Lighthouse
npm run lighthouse
# Mobile score should be >90
```

---

## Risk Assessment

### Low Risk Optimizations:
- ✅ Vendor chunk splitting (already done)
- ✅ Lazy loading exports (already done)
- ✅ Create vendor-upload chunk
- ✅ Defer crypto-js

### Medium Risk:
- 🟡 Route code splitting (may affect loading UX)
- 🟡 Context deferral (may cause flicker)
- 🟡 Tree-shaking audit (may break features)

### High Risk:
- 🔴 Recharts migration from Plotly (major work)
- 🔴 Remove ag-grid (may lose functionality)

---

## Execution Plan Summary

**Week 1**: vendor-shared optimization (75KB savings)
**Week 2**: Route code splitting (50KB savings)
**Week 3**: vendor-charting deferral (70KB savings)
**Week 4**: Final polish + verification

**Total Effort**: 40-60 hours
**Total Savings**: 195KB gzipped
**Result**: 580KB → 385KB (still above target by 185KB)

**Phase 4B** (Optional - if needed):
- Recharts → CSS-only charts for simple cases
- Server-side rendering for heavy pages
- Further vendor optimizations

---

## Notes for Execution

1. **Measure before/after each change** - Use bundle:report
2. **Test route transitions** - Ensure lazy loading smooth
3. **Monitor Lighthouse** - Track real-world impact
4. **Document decisions** - Why kept/removed each chunk
5. **Add regression tests** - Prevent bundle bloat returning

---

**Phase 4 Status: ANALYSIS COMPLETE - READY FOR EXECUTION**
**Estimated Duration**: 2.5-4 weeks (single engineer)
**Critical Priority**: User experience requirement

_Analysis completed: 2025-09-30 | Current: 580KB gz | Target: <200KB gz | Gap: 380KB (65%)_