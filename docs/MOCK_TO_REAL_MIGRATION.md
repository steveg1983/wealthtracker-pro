# Mock to Real Test Migration Guide

## Quick Reference: Before vs After

### ❌ BEFORE: Mock-based Test
```typescript
import { vi } from 'vitest';

// Mock everything
vi.mock('@supabase/supabase-js');
vi.mock('@clerk/clerk-react');

it('should create account', async () => {
  // Mock returns fake data
  const mockInsert = vi.fn().mockResolvedValue({ 
    data: { id: 'fake-id', name: 'Test Account' } 
  });
  
  vi.mocked(supabase.from).mockReturnValue({
    insert: mockInsert
  });
  
  // Test with mock
  const result = await accountService.createAccount(mockData);
  
  // Assert mock was called
  expect(mockInsert).toHaveBeenCalledWith(mockData);
  expect(result.name).toBe('Test Account');
});
```

### ✅ AFTER: Real Database Test
```typescript
import { createClient } from '@supabase/supabase-js';

// Use real database
const testSupabase = createClient(
  process.env.VITE_SUPABASE_URL!,
  process.env.VITE_SUPABASE_ANON_KEY!
);

it('should create account', async () => {
  // Create REAL account in database
  const result = await accountService.createAccount({
    user_id: 'test-user-123',
    name: 'Real Test Account',
    type: 'checking',
    balance: '1000.00'
  });
  
  // Verify it ACTUALLY exists
  const { data } = await testSupabase
    .from('accounts')
    .select('*')
    .eq('id', result.id)
    .single();
  
  expect(data).toBeDefined();
  expect(data.name).toBe('Real Test Account');
  
  // Clean up real data
  await testSupabase.from('accounts').delete().eq('id', result.id);
});
```

## Step-by-Step Migration Process

### 1. Remove Mock Imports
```diff
- import '../mocks/supabase';
- import '../mocks/clerk';
- vi.mock('@supabase/supabase-js');
- vi.mock('@clerk/clerk-react');
+ import { createClient } from '@supabase/supabase-js';
+ const testSupabase = createClient(url, key);
```

### 2. Replace Mock Setup with Real Setup
```diff
- beforeEach(() => {
-   vi.clearAllMocks();
- });
+ const createdIds = [];
+ 
+ afterEach(async () => {
+   // Clean up real data
+   if (createdIds.length > 0) {
+     await testSupabase.from('table').delete().in('id', createdIds);
+   }
+ });
```

### 3. Convert Mock Assertions to Real Verifications
```diff
- expect(mockFunction).toHaveBeenCalledWith(data);
- expect(mockFunction).toHaveBeenCalledTimes(1);
+ const { data: verify } = await testSupabase
+   .from('table')
+   .select('*')
+   .eq('id', result.id);
+ expect(verify).toBeDefined();
```

## Common Patterns

### Testing Error Handling (Real Constraints)
```typescript
it('should handle database constraints', async () => {
  // Try to violate a real constraint
  const result = await accountService.createAccount({
    type: 'invalid_type', // Real DB will reject this
    // ...
  });
  
  expect(result).toBeNull(); // Service handles real error
});
```

### Testing Transactions (Real Isolation)
```typescript
it('should handle concurrent operations', async () => {
  // Create multiple records concurrently
  const promises = Array(5).fill(0).map((_, i) => 
    accountService.createAccount({
      name: `Account ${i}`,
      // ...
    })
  );
  
  const results = await Promise.all(promises);
  
  // All should succeed with real database handling concurrency
  expect(results.every(r => r !== null)).toBe(true);
});
```

### Testing Relationships (Real Foreign Keys)
```typescript
it('should cascade delete transactions', async () => {
  // Create account with transactions
  const account = await accountService.createAccount(data);
  const transaction = await transactionService.create({
    account_id: account.id,
    // ...
  });
  
  // Delete account
  await accountService.deleteAccount(account.id);
  
  // Verify transaction is also deleted (real cascade)
  const { data } = await testSupabase
    .from('transactions')
    .select('*')
    .eq('id', transaction.id);
  
  expect(data).toBeNull();
});
```

## Test Data Management

### Use Test Data Factory
```typescript
class TestDataFactory {
  private createdIds = { accounts: [], transactions: [] };
  
  async createAccount(overrides = {}) {
    const account = await accountService.createAccount({
      name: 'Test Account ' + Date.now(),
      type: 'checking',
      balance: '1000.00',
      ...overrides
    });
    
    this.createdIds.accounts.push(account.id);
    return account;
  }
  
  async cleanup() {
    for (const [table, ids] of Object.entries(this.createdIds)) {
      if (ids.length > 0) {
        await testSupabase.from(table).delete().in('id', ids);
      }
    }
  }
}

// Usage
const factory = new TestDataFactory();

afterEach(() => factory.cleanup());

it('test something', async () => {
  const account = await factory.createAccount({ name: 'Custom' });
  // Test with real account
});
```

## Files to Migrate

### Priority 1: Service Tests
- [ ] `/src/services/__tests__/accountService.test.ts`
- [ ] `/src/services/__tests__/transactionService.test.ts`
- [ ] `/src/services/__tests__/budgetService.test.ts`
- [ ] `/src/services/__tests__/categoryService.test.ts`

### Priority 2: Integration Tests
- [ ] `/src/test/integration/realtime-analytics.test.tsx`
- [ ] `/src/store/__tests__/reduxMigration.test.tsx`

### Priority 3: Component Tests (that use services)
- [ ] Components that directly call services
- [ ] Components that rely on AppContext

## Checklist for Each Test File

- [ ] Remove all `vi.mock()` calls
- [ ] Remove mock file imports
- [ ] Add real database client setup
- [ ] Add cleanup in `afterEach()`
- [ ] Replace mock assertions with real database queries
- [ ] Test with real constraints and relationships
- [ ] Verify test still passes with real data
- [ ] Ensure no test data leaks between tests

## Running Real Tests

```bash
# With your existing Supabase instance
npm run test:real

# With Docker test databases
npm run test:docker:up
npm run test:seed
npm run test:all
npm run test:docker:down
```

## Troubleshooting

### Tests are slow
- Use parallel test execution
- Minimize database round trips
- Use transaction rollback for faster cleanup

### Tests are flaky
- Add proper cleanup in afterEach
- Use unique identifiers (timestamps)
- Handle async operations properly

### Database conflicts
- Use unique test user IDs
- Clean up all created data
- Consider test isolation strategies

## Benefits of Real Testing

1. **Catches Real Bugs**: Database constraints, race conditions, data types
2. **Tests Real Performance**: Actual query times, connection pooling
3. **Validates Schema**: Foreign keys, indexes, constraints actually work
4. **No False Positives**: If test passes, feature actually works
5. **Better Confidence**: Deploy knowing it works with real infrastructure

---

**Remember the principle**: "If it's not tested against real infrastructure, it's not tested."