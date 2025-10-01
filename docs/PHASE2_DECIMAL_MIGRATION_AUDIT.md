# Phase 2: Financial Safety - Decimal Migration Audit

**Date**: 2025-09-29
**Status**: Audit Complete - Ready for Phase 2 Execution
**Scope**: 158 files using floating-point arithmetic for financial calculations
**Priority**: 🚨 CRITICAL - Legal/compliance requirement

---

## Executive Summary

**Finding**: 162 parseFloat() usages, 358 toFixed() usages, plus Math.round() across 158 files represent a **critical compliance violation** for financial software.

**Impact**:
- Legal liability for calculation errors
- Cannot pass SOC 2, PCI-DSS audits
- Real money losses due to rounding errors
- Compliance violation for financial software

**Effort**: 80-100 hours systematic migration
**Approach**: Replace all floating-point with Decimal.js

---

## Risk Categorization (158 Files)

### 🔴 CRITICAL RISK (Priority 1 - Must Fix First) - 28 files

**Core Financial Utilities:**
1. `src/utils/currency.ts` - **parseFloat line 70** - formatCurrency/parseCurrency
2. `src/types/money.ts` - **toFixed line 8** - Money type implementation
3. `src/utils/formatters.ts` - Multiple toFixed() calls

**Transaction Processing:**
4. `src/components/AddTransactionModal.tsx` - User input → parseFloat
5. `src/components/EditTransactionModal.tsx` - Transaction editing
6. `src/components/TransactionModal.tsx` - Transaction creation
7. `src/pages/AccountTransactions.tsx` - Quick add form
8. `src/components/QuickTransactionForm.tsx` - Fast entry

**Budget/Goal Management:**
9. `src/components/BudgetModal.tsx` - Budget amounts
10. `src/components/GoalModal.tsx` - Goal target/current amounts
11. `src/services/budgetCalculationService.ts` - Budget math
12. `src/services/budgetRecommendationService.ts` - Recommendations

**Import/Export (Data Integrity):**
13. `src/utils/csvImport.ts` - CSV amount parsing
14. `src/services/enhancedCsvImportService.ts` - Enhanced import
15. `src/services/qifImportService.ts` - QIF file parsing
16. `src/services/ofxImportService.ts` - OFX file parsing
17. `src/utils/mnyParser.ts` - MNY format
18. `src/utils/qifParser.ts` - QIF parsing logic

**Account Operations:**
19. `src/components/BalanceAdjustmentModal.tsx` - Balance changes
20. `src/components/AccountReconciliationModal.tsx` - Reconciliation
21. `src/services/api/accountService.ts` - Account CRUD

**Investment Calculations:**
22. `src/components/AddInvestmentModal.tsx` - Investment entry
23. `src/components/PortfolioManager.tsx` - Portfolio math
24. `src/services/api/investmentService.ts` - Investment processing

**Transfer Operations:**
25. `src/components/EnhancedTransferModal.tsx` - Transfer amounts + fees

**Split Transactions:**
26. `src/components/SplitTransaction.tsx` - Split math
27. `src/components/SplitTransactionModal.tsx` - Split editing
28. `src/pages/Reconciliation.tsx` - Multiple parseFloat calls

**Estimated Effort**: 40-50 hours

---

### 🟠 HIGH RISK (Priority 2) - 35 files

**Debt Management:**
- `src/components/DebtManagement.tsx` - Interest calculations
- `src/components/DebtPayoffPlanner.tsx` - Payoff planning
- `src/services/debtCalculationService.ts` - Debt math

**Retirement Planning:**
- `src/components/RetirementPlanner.tsx`
- `src/components/retirement/SIPPCalculator.tsx`
- `src/components/retirement/RMDCalculator.tsx`
- `src/services/ukRetirementService.ts`
- `src/services/usRetirementService.ts`

**Mortgage Calculations:**
- `src/components/MortgageCalculatorNew.tsx` - Multiple parseFloat
- `src/services/ukMortgageService.ts`
- `src/services/usMortgageService.ts`

**Bill/Recurring Transactions:**
- `src/components/BillManagement.tsx`
- `src/components/RecurringTransactions.tsx`
- `src/components/RecurringTransactionModal.tsx`

**Financial Planning:**
- `src/components/InsurancePlanner.tsx` - Premium calculations
- `src/components/widgets/FinancialPlanningWidget.tsx`
- `src/services/financialSummaryService.ts`

**Envelope Budgeting:**
- `src/components/EnvelopeBudgeting.tsx` - Transfer amounts
- `src/components/ZeroBasedBudgeting.tsx` - Budget allocation

**Portfolio/Investment:**
- `src/components/PortfolioRebalancer.tsx` - Rebalancing math
- `src/components/PortfolioAnalysis.tsx`
- `src/components/RealTimePortfolio.tsx`
- `src/services/portfolioRebalanceService.ts`
- `src/services/investmentEnhancementService.ts`

**Dividend Tracking:**
- `src/components/DividendTracker.tsx` - Dividend amounts + tax

**Estimated Effort**: 25-30 hours

---

### 🟡 MEDIUM RISK (Priority 3) - 45 files

**Search/Filtering:**
- `src/components/TransactionSearch.tsx` - Amount filters
- `src/components/AdvancedSearch.tsx` - Numeric comparisons
- `src/services/searchService.ts` - Search parsing

**Analytics/Reports (Display):**
- `src/pages/Analytics.tsx` - Chart data calculations
- `src/components/AdvancedAnalytics.tsx`
- `src/services/advancedAnalyticsService.ts`
- `src/services/analyticsEngine.ts`
- `src/services/anomalyDetectionService.ts`
- `src/services/dataIntelligenceService.ts`

**Export/Reporting:**
- `src/services/exportService.ts` - Report generation
- `src/components/ExcelExport.tsx`
- `src/utils/pdfExport.ts`
- `src/utils/csvExport.ts`
- `src/components/EnhancedExportManager.tsx`
- `src/components/reports/FinancialReportGenerator.tsx`
- `src/components/reports/BudgetComparison.tsx`

**Dashboard Widgets (Display):**
- `src/components/widgets/NetWorthWidget.tsx`
- `src/components/widgets/BudgetSummaryWidget.tsx`
- `src/components/widgets/DebtTrackerWidget.tsx`
- `src/components/widgets/CashFlowWidget.tsx`
- `src/components/dashboard/widgets/*` (8 files)

**Tax Calculations:**
- `src/components/TaxCalculator.tsx`
- `src/components/retirement/StateTaxCalculator.tsx`
- `src/services/taxDataService.ts`
- `src/services/stateTaxService.ts`

**Duplicate Detection:**
- `src/services/duplicateDetectionService.ts` - Amount comparison

**Estimated Effort**: 15-20 hours

---

### 🟢 LOW RISK (Priority 4 - Can Defer) - 50 files

**Test Files (Not Production):**
- `src/services/__tests__/*.test.ts` - parseFloat in test assertions
- `src/test/integration/*.test.tsx` - Test data
- Can fix during test refactoring

**Performance Monitoring (Not Financial):**
- `src/utils/performance-monitor.ts` - Byte formatting
- `src/hooks/usePerformanceMonitoring.ts` - Metrics display
- `src/components/PerformanceDashboard.tsx`

**UI/Accessibility (Not Financial):**
- `src/utils/accessibility-testing.ts` - Font size parsing
- `src/components/security/SanitizedInput.tsx` - Input validation

**Demo/Test Data:**
- `src/utils/demoData.ts` - Test data generation
- `src/data/generateTransactions.ts` - Mock transactions

**Estimated Effort**: 5-10 hours (can defer to Phase 5)

---

## Migration Strategy

### Phase 2.1: Core Utilities (Week 1 - 15-20 hours)
**Goal**: Fix the foundation so everything else can use it

1. **Update Money type** (`src/types/money.ts`)
   - Remove toFixed(), use Decimal.js internally
   - Keep string-based interface

2. **Update currency utilities** (`src/utils/currency.ts`)
   - Replace parseFloat with Decimal parsing
   - Update formatCurrency to accept Decimal
   - Add parseCurrencyDecimal() helper

3. **Update formatters** (`src/utils/formatters.ts`)
   - All toFixed() → Decimal.toFixed()
   - Maintain existing API

4. **Create migration helpers**:
   ```typescript
   // src/utils/decimal-helpers.ts
   export function parseDecimal(value: string | number): Decimal
   export function toMoneyString(decimal: Decimal): string
   export function formatDecimalCurrency(decimal: Decimal, currency: string): string
   ```

### Phase 2.2: Transaction Layer (Week 2 - 20-25 hours)
**Goal**: Ensure all transaction amounts are Decimal-safe

1. Transaction modals (5 files, 8-10 hours)
2. Split transactions (2 files, 4-6 hours)
3. Import services (4 files, 8-10 hours)

### Phase 2.3: Budget/Goal Layer (Week 3 - 15-20 hours)
**Goal**: Budget and goal calculations compliance

1. Budget modals & calculations (4 files, 6-8 hours)
2. Goal modals & tracking (3 files, 4-6 hours)
3. Envelope/zero-based budgeting (2 files, 5-6 hours)

### Phase 2.4: Investment/Portfolio (Week 4 - 15-20 hours)
**Goal**: Investment math precision

1. Investment entry/editing (3 files, 6-8 hours)
2. Portfolio calculations (4 files, 6-8 hours)
3. Dividend tracking (1 file, 3-4 hours)

### Phase 2.5: Analytics/Reports (Week 5 - 10-15 hours)
**Goal**: Display precision (lower priority)

1. Dashboard widgets (12 files, 6-8 hours)
2. Reports/export (6 files, 4-7 hours)

### Phase 2.6: Validation & Testing (Week 6 - 5-10 hours)
**Goal**: Verify no floating-point remains

1. Run audit: `rg "parseFloat|toFixed" src/` should return 0
2. Add tests for Decimal precision
3. Update documentation

---

## Helper Utilities Needed

### 1. Decimal Parsing Helpers
```typescript
// src/utils/decimal-helpers.ts

import Decimal from 'decimal.js';

// Safe parsing from user input
export function parseDecimalSafe(value: string | number | null | undefined): Decimal {
  if (value === null || value === undefined || value === '') {
    return new Decimal(0);
  }
  try {
    return new Decimal(value);
  } catch {
    return new Decimal(0);
  }
}

// Parse currency string (with symbols)
export function parseCurrencyToDecimal(value: string): Decimal {
  const cleaned = value.replace(/[£$€¥₹,]/g, '').trim();
  return parseDecimalSafe(cleaned);
}

// Format Decimal to money string
export function toMoneyString(decimal: Decimal, decimals: number = 2): string {
  return decimal.toFixed(decimals);
}
```

### 2. Currency Formatting
```typescript
// Update src/utils/formatters.ts

import Decimal from 'decimal.js';

export function formatCurrencyDecimal(
  amount: Decimal | number | string,
  currency: string = 'GBP'
): string {
  const decimal = amount instanceof Decimal
    ? amount
    : new Decimal(amount);

  const symbol = getCurrencySymbol(currency);
  const formatted = decimal.toFixed(2);
  // Rest of formatting logic...
}
```

### 3. Redux Serialization
```typescript
// Money values in Redux must be strings
export function serializeDecimal(decimal: Decimal): string {
  return decimal.toString();
}

export function deserializeDecimal(value: string): Decimal {
  return new Decimal(value);
}
```

---

## Testing Requirements

### Unit Tests (Per File Category):
1. **Core utilities** - Test Decimal helpers
2. **Transaction layer** - Test amount precision
3. **Budget/Goal** - Test calculation accuracy
4. **Investment** - Test portfolio math
5. **Currency conversion** - Test multi-currency precision

### Integration Tests:
1. End-to-end transaction flow (input → storage → display)
2. Budget calculation with real Decimal math
3. Portfolio rebalancing precision
4. Report generation accuracy

### Regression Tests:
1. Compare old vs new calculations on sample data
2. Verify no precision loss
3. Ensure display formatting unchanged

---

## Migration Checklist

**Before Starting:**
- [ ] Create `src/utils/decimal-helpers.ts`
- [ ] Update `src/types/money.ts`
- [ ] Update `src/utils/currency.ts`
- [ ] Update `src/utils/formatters.ts`
- [ ] Add unit tests for helpers

**For Each File:**
- [ ] Read existing code
- [ ] Identify all parseFloat/toFixed/Math.round
- [ ] Replace with Decimal operations
- [ ] Update function signatures if needed
- [ ] Add/update tests
- [ ] Verify in isolation
- [ ] Check dependent files

**After Each Category:**
- [ ] Run full test suite
- [ ] Verify build passes
- [ ] Test feature manually
- [ ] Update progress in CLAUDE.md

**Phase 2 Complete When:**
- [ ] Zero parseFloat/toFixed in financial code
- [ ] All tests passing
- [ ] Manual testing verified
- [ ] Documentation updated
- [ ] Audit trail implemented

---

## Dependency Map

**Foundation Files** (fix first):
```
money.ts
  ↓
currency.ts, formatters.ts
  ↓
decimal-helpers.ts
  ↓
All other files
```

**Transaction Flow**:
```
User Input (Modal)
  → parseFloat (VIOLATES)
  → Transaction object
  → Service layer
  → Supabase storage
  → Display (toFixed)
```

**Should Be**:
```
User Input (Modal)
  → Decimal.parse()
  → Transaction object (Decimal)
  → Service layer (Decimal)
  → Supabase storage (string)
  → Display (Decimal.toFixed())
```

---

## Common Patterns & Fixes

### Pattern 1: User Input Parsing
```typescript
// ❌ BEFORE
const amount = parseFloat(inputValue);

// ✅ AFTER
import { parseDecimalSafe } from '../utils/decimal-helpers';
const amount = parseDecimalSafe(inputValue);
```

### Pattern 2: Formatting for Display
```typescript
// ❌ BEFORE
amount.toFixed(2)

// ✅ AFTER
amount.toFixed(2) // Decimal has toFixed() method
```

### Pattern 3: Math Operations
```typescript
// ❌ BEFORE
const total = amounts.reduce((sum, a) => sum + parseFloat(a), 0);

// ✅ AFTER
const total = amounts.reduce(
  (sum, a) => sum.plus(new Decimal(a)),
  new Decimal(0)
);
```

### Pattern 4: Comparisons
```typescript
// ❌ BEFORE
if (Math.abs(amount1 - amount2) < 0.01)

// ✅ AFTER
if (new Decimal(amount1).minus(amount2).abs().lessThan(0.01))
```

---

## File-by-File Breakdown

### Critical Files Detail:

**src/utils/currency.ts (Line 70)**
```typescript
// CURRENT VIOLATION:
const parsed = parseFloat(cleanValue);

// FIX NEEDED:
import Decimal from 'decimal.js';
const parsed = new Decimal(cleanValue);

// Update return type: number → Decimal
// Update all callers
```

**src/types/money.ts (Line 8)**
```typescript
// CURRENT VIOLATION:
return (n.toFixed(2) as unknown) as Money;

// FIX NEEDED:
// Change Money type to wrap Decimal, not string
export type Money = Decimal & { readonly __brand: 'Money' };
export function toMoney(value: number | string | Decimal): Money {
  return new Decimal(value).toDecimalPlaces(2) as Money;
}
```

**src/components/AddTransactionModal.tsx (Line 71)**
```typescript
// CURRENT VIOLATION:
const amount = parseFloat(validatedData.amount);

// FIX NEEDED:
const amount = new Decimal(validatedData.amount);
// Update validation schema to output string
// Update transaction type to use Decimal
```

---

## Effort Estimates by Category

| Category | Files | parseFloat | toFixed | Effort (hrs) |
|----------|-------|------------|---------|--------------|
| **Core Utils** | 3 | 5 | 50+ | 8-10 |
| **Transactions** | 8 | 25 | 30 | 12-15 |
| **Budget/Goals** | 6 | 15 | 20 | 10-12 |
| **Investments** | 5 | 20 | 25 | 10-12 |
| **Import/Export** | 6 | 30 | 15 | 12-15 |
| **Debt/Mortgage** | 8 | 25 | 30 | 12-15 |
| **Analytics/Reports** | 35 | 30 | 100 | 10-15 |
| **Tests/Other** | 87 | 12 | 88 | 5-10 |
| **TOTAL** | **158** | **162** | **358** | **80-100** |

---

## Success Criteria

**Phase 2 Exit Requirements:**
- [ ] Zero parseFloat() in src/ (except tests/performance utils)
- [ ] Zero toFixed() on raw numbers (only on Decimal)
- [ ] Zero Math.round() on financial amounts
- [ ] All financial types use Decimal
- [ ] Currency utilities Decimal-based
- [ ] All tests passing
- [ ] Manual testing complete
- [ ] Documentation updated
- [ ] Audit trail implemented

**Verification Commands:**
```bash
# Should return 0 in financial code
rg "parseFloat" src/components src/services src/utils --type ts --type tsx

# Should only see Decimal.toFixed()
rg "toFixed" src/ --type ts --type tsx

# Verify Decimal usage
rg "new Decimal|Decimal\.js" src/
```

---

## Recommendations for Execution

1. **Don't rush** - This is compliance-critical
2. **One category at a time** - Test after each
3. **Start with utilities** - Foundation first
4. **Add helpers early** - Make migration easier
5. **Test extensively** - Financial errors are unacceptable
6. **Document changes** - Why Decimal, not just what
7. **Keep audit trail** - Log all financial operations

---

**Phase 2 Status: READY TO EXECUTE**
**Estimated Duration**: 5-6 weeks (single engineer)
**Critical Priority**: Legal compliance requirement

_Audit completed: 2025-09-29 | Next: Phase 1 completion, then execute Phase 2_