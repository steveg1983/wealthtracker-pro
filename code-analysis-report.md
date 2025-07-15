# Code Analysis Report - WealthTracker Web

## Executive Summary
This report identifies code duplications, potential errors, performance issues, and refactoring opportunities across the WealthTracker web application codebase.

## 1. Code Duplications

### 1.1 Category Dropdown Logic (HIGH PRIORITY)
**Location**: `/src/pages/Reconciliation.tsx`
- Lines 549-598 and 781-819 contain identical category dropdown rendering logic
- This same pattern appears to be replicated across multiple components

**Impact**: 
- Maintenance burden - changes need to be made in multiple places
- Increased bundle size
- Risk of inconsistencies

**Recommendation**: Extract into a reusable `CategorySelect` component

### 1.2 Currency Formatting
**Files affected**: 33+ files use `formatCurrency` or `useCurrency`
- Inconsistent usage between direct `formatCurrency` calls and the `useCurrency` hook
- Some files implement their own currency formatting logic

**Recommendation**: Standardize on using the `useCurrency` hook throughout the application

## 2. Potential Errors

### 2.1 Undefined Function Error (CRITICAL)
**Location**: `/src/pages/Reconciliation.tsx` line 283
```typescript
setCurrentTransactionIndex(0);
```
- `setCurrentTransactionIndex` is called but never defined in the component
- This will cause a runtime error when `handleBackToAccounts` is called

**Fix**: Remove this line or define the missing state variable

### 2.2 Missing Dependencies in useEffect Hooks
Multiple components may have missing dependencies in their useEffect hooks, which could lead to stale closures or unexpected behavior.

## 3. Performance Issues

### 3.1 Expensive Operations in Render
**Multiple files** perform expensive operations during render:
- Array operations: `.filter().map()` chains without memoization
- Date parsing: `new Date()` called repeatedly
- Sorting: `.sort()` operations on every render
- Reduce operations: `.reduce()` for calculations

**Examples**:
- `/src/pages/Analytics.tsx`: Multiple `.reduce()` and `.sort()` operations
- `/src/pages/Reconciliation.tsx`: Complex category filtering on every render
- `/src/pages/Transactions.tsx`: Sorting transactions without memoization

### 3.2 Missing React.memo and useMemo
**Observation**: Only 9 files use performance optimization hooks
- Many components that render lists don't use `React.memo`
- Computed values are recalculated on every render
- No memoization of expensive category tree traversals

### 3.3 Memory Leaks
**Found in**:
- `/src/hooks/useStockPrices.ts`: `setInterval` without proper cleanup in some edge cases
- `/src/contexts/PreferencesContext.tsx`: Event listeners that might not be cleaned up properly

## 4. Code Organization Issues

### 4.1 Component Size
Several components exceed 500 lines and handle multiple responsibilities:
- `/src/pages/Reconciliation.tsx` (905 lines)
- `/src/components/IncomeExpenditureReport.tsx` (600+ lines)
- `/src/pages/Dashboard.tsx` (likely large based on imports)

### 4.2 Inline Styles and Classes
Many components use inline style objects and concatenated className strings, making them harder to maintain and potentially causing performance issues.

## 5. Specific Refactoring Opportunities

### 5.1 Extract Category Select Component
Create a reusable `CategorySelect` component that encapsulates the complex category hierarchy logic:

```typescript
interface CategorySelectProps {
  value: string;
  onChange: (value: string) => void;
  categories: Category[];
  disabled?: boolean;
  showMultiple?: boolean;
  className?: string;
}

export const CategorySelect: React.FC<CategorySelectProps> = React.memo(({ 
  value, 
  onChange, 
  categories,
  disabled = false,
  showMultiple = false,
  className = ""
}) => {
  // Memoize the category tree structure
  const categoryTree = useMemo(() => {
    // Build optimized tree structure
  }, [categories]);
  
  // Render logic here
});
```

### 5.2 Optimize Reconciliation Component
1. Split into smaller components:
   - `AccountSummaryList`
   - `TransactionReconciliationList`
   - `SplitTransactionModal` (already exists but could be improved)

2. Add memoization:
   ```typescript
   const unclearedTransactions = useMemo(() => 
     selectedAccount 
       ? transactions.filter(t => t.accountId === selectedAccount && !t.cleared)
       : [],
     [selectedAccount, transactions]
   );
   ```

### 5.3 Create Custom Hooks
Extract complex logic into custom hooks:
- `useCategoryTree` - for category hierarchy operations
- `useTransactionFilters` - for filtering and sorting logic
- `usePagination` - for pagination logic

### 5.4 Performance Optimizations

1. **Memoize expensive calculations**:
   ```typescript
   const totalAmount = useMemo(() => 
     transactions.reduce((sum, t) => sum + t.amount, 0),
     [transactions]
   );
   ```

2. **Use React.memo for list items**:
   ```typescript
   const TransactionItem = React.memo(({ transaction, onEdit, onReconcile }) => {
     // Component logic
   }, (prevProps, nextProps) => {
     // Custom comparison if needed
   });
   ```

3. **Virtualize long lists**:
   Consider using `react-window` or `react-virtualized` for transaction lists

### 5.5 Fix Event Listener Cleanup
Ensure all event listeners are properly cleaned up:
```typescript
useEffect(() => {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  const handleChange = () => updateActualTheme();
  
  // Use the correct API
  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  } else {
    // Fallback for older browsers
    mediaQuery.addListener(handleChange);
    return () => mediaQuery.removeListener(handleChange);
  }
}, [theme]);
```

## 6. Testing Recommendations

1. Add unit tests for the extracted components
2. Add performance benchmarks for list rendering
3. Test error boundaries around components with potential errors
4. Add integration tests for the reconciliation flow

## 7. Priority Actions

1. **CRITICAL**: Fix `setCurrentTransactionIndex` error in Reconciliation.tsx
2. **HIGH**: Extract CategorySelect component to eliminate duplication
3. **HIGH**: Add memoization to expensive calculations in Analytics and Dashboard
4. **MEDIUM**: Split large components into smaller, focused components
5. **MEDIUM**: Standardize currency formatting approach
6. **LOW**: Add React.memo to frequently re-rendered components

## Conclusion

The codebase shows signs of rapid development with opportunities for optimization and refactoring. The main concerns are:
- Code duplication that increases maintenance burden
- Performance issues from unmemoized expensive operations
- A critical runtime error that needs immediate attention
- Large components that would benefit from decomposition

Implementing these recommendations will improve performance, maintainability, and user experience.