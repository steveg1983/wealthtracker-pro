# Test Database Setup Guide

## REAL Testing with REAL Database

Our tests now use a **REAL Supabase database**, not mocks. This means:
- Tests verify ACTUAL database operations
- Tests catch REAL SQL errors and constraints
- Tests ensure data integrity
- Tests validate the COMPLETE system

## Setup Instructions

### 1. Create a Test Supabase Project

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Create a NEW project called `wealthtracker-test` (NOT your production!)
3. Wait for the project to be ready

### 2. Configure Test Database

Copy your test project credentials to `.env.test`:

```bash
# Get these from your TEST Supabase project settings
VITE_SUPABASE_URL=https://YOUR_TEST_PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_TEST_ANON_KEY

# Optional: Test Clerk instance
VITE_CLERK_PUBLISHABLE_KEY=pk_test_YOUR_TEST_CLERK_KEY
```

### 3. Run Database Migrations on Test Database

Apply your schema to the test database:

```bash
# Connect to test database and run migrations
npx supabase db push --db-url "postgresql://postgres:YOUR_PASSWORD@db.YOUR_TEST_PROJECT.supabase.co:5432/postgres"
```

### 4. Run REAL Tests

```bash
# Load test environment variables
export $(cat .env.test | xargs)

# Run tests with REAL database
npm test
```

## How Our REAL Tests Work

### Traditional Mock Tests (BAD)
```typescript
// FAKE - Tests nothing real
vi.mock('../database');
const mockAddBudget = vi.fn();
mockAddBudget({ amount: 100 }); // Fake call
expect(mockAddBudget).toHaveBeenCalled(); // Tests the mock, not the system!
```

### Our REAL Database Tests (GOOD)
```typescript
// REAL - Tests actual database
const { data } = await testDb
  .from('budgets')
  .insert({ amount: 100 })
  .select();

// Verify REAL data in REAL database
const result = await testDb
  .from('budgets')
  .select('*')
  .eq('id', data[0].id);

expect(result.data[0].amount).toBe(100); // Tests REAL system!
```

## Test Utilities

### DatabaseTestHelpers
- `createTestUser()` - Creates REAL user in database
- `createTestAccount()` - Creates REAL account
- `createTestTransaction()` - Creates REAL transaction
- `createTestBudget()` - Creates REAL budget
- `cleanup()` - Removes all test data

### Transaction Testing
```typescript
await withTestTransaction(async (helpers) => {
  // All data created here is tracked
  const user = await helpers.createTestUser();
  const account = await helpers.createTestAccount(user.id);
  
  // Test with REAL data
  expect(account.balance).toBe(1000);
  
  // Automatically cleaned up after test
});
```

## Important Notes

1. **NEVER use production database for tests!** Always use a separate test database.

2. **Always clean up test data** - Use `helpers.cleanup()` in `afterEach()`

3. **Test data is REAL** - It actually exists in the database during tests

4. **Database constraints are REAL** - Tests will fail if you violate foreign keys, unique constraints, etc.

5. **Performance matters** - Real database tests are slower but catch real bugs

## Benefits of REAL Testing

1. **Catches Real Bugs**
   - SQL syntax errors
   - Foreign key violations
   - Unique constraint violations
   - Data type mismatches

2. **Tests Real Performance**
   - Slow queries are caught
   - N+1 problems are visible
   - Index usage is tested

3. **Validates Business Logic**
   - Database triggers work
   - Constraints are enforced
   - Transactions behave correctly

4. **No False Positives**
   - If test passes, the feature ACTUALLY works
   - No "works in test, breaks in production"

## Running Specific Test Types

```bash
# Run only REAL database tests
npm test -- *.real.test.tsx

# Run with database logging
DEBUG=supabase npm test

# Run with test coverage
npm test -- --coverage
```

## Troubleshooting

### "Test database not configured"
- Ensure `.env.test` has valid Supabase credentials
- Check credentials are from TEST project, not production

### "Foreign key violation"
- Test data has dependencies
- Create in correct order: users → accounts → transactions

### "Tests are slow"
- Real database tests ARE slower
- This is the price of REAL testing
- Better slow tests than broken production

## The Bottom Line

**We test the REAL system, not mocks.**

Every test that passes means the feature ACTUALLY works with a REAL database. No more "works on my machine" or "passes tests but fails in production".

This is what "Professional-grade, zero compromises" means.
