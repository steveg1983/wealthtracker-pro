# Decimal.js Migration Plan

## Overview
This document outlines the migration from JavaScript's native `number` type to `decimal.js` for all financial calculations in WealthTracker.

## Why Decimal.js?
- **Precision**: Eliminates floating-point arithmetic errors (e.g., 0.1 + 0.2 = 0.30000000000000004)
- **Financial Accuracy**: Critical for a financial application
- **Rounding Control**: Consistent rounding modes for different scenarios
- **Large Numbers**: Better handling of large financial values

## Migration Strategy

### Phase 1: Foundation (COMPLETED)
- ✅ Install decimal.js and TypeScript types
- ✅ Create decimal utility functions (`src/utils/decimal.ts`)
- ✅ Create decimal type definitions (`src/types/decimal-types.ts`)
- ✅ Create converter functions (`src/utils/decimal-converters.ts`)
- ✅ Create decimal-aware currency utilities (`src/utils/currency-decimal.ts`)

### Phase 2: Core Calculations (TODO)
1. **Update AppContext** to use Decimal internally
   - Maintain backward compatibility with existing components
   - Use converters at the boundaries

2. **Update calculation functions**:
   - Account balance calculations
   - Transaction totals
   - Budget calculations
   - Investment returns
   - Goal progress

### Phase 3: Component Updates (TODO)
Update components gradually, starting with:
1. **Critical calculation components**:
   - Dashboard (totals, net worth)
   - Accounts (balances)
   - Transactions (amounts)
   - Budget (calculations)
   - Analytics (aggregations)

2. **Display components**:
   - Update to accept both number and Decimal
   - Use formatCurrency from currency-decimal.ts

### Phase 4: Data Layer (TODO)
1. **Import/Export**:
   - CSV import/export
   - QIF/OFX parsers
   - Backup/restore

2. **API/Database**:
   - Continue storing as DECIMAL in database
   - Convert at API boundaries

### Phase 5: Testing & Cleanup (TODO)
1. **Test all calculations**
2. **Remove old number-based utilities**
3. **Update all type imports**

## Implementation Guidelines

### 1. Use Decimal for all calculations
```typescript
// ❌ Old way
const total = amount1 + amount2;

// ✅ New way
const total = toDecimal(amount1).plus(amount2);
```

### 2. Convert at boundaries
```typescript
// When reading from API/database
const account = toDecimalAccount(apiAccount);

// When saving to API/database
const apiAccount = fromDecimalAccount(account);
```

### 3. Format for display
```typescript
// Use the decimal-aware formatter
import { formatCurrency } from '@/utils/currency-decimal';
const display = formatCurrency(decimalAmount, 'GBP');
```

### 4. Maintain backward compatibility
Components should accept both number and Decimal during migration:
```typescript
interface Props {
  amount: number | Decimal;
}
```

## Testing Checklist
- [ ] All calculations produce correct results
- [ ] No floating-point errors
- [ ] Currency conversions are accurate
- [ ] Import/export maintains precision
- [ ] Performance is acceptable
- [ ] All tests pass

## Rollback Plan
If issues arise:
1. The converter functions allow easy rollback
2. Original number-based utilities are preserved
3. Database schema remains unchanged

## Next Steps
1. Start with Phase 2: Update AppContext
2. Test thoroughly at each phase
3. Monitor for any performance impacts
4. Document any issues or edge cases