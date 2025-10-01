# WealthTracker Testing Infrastructure Guide

## 🚨 CRITICAL: Real Tests, Not Mocks

**Core Principle**: "If it's not tested against real infrastructure, it's not tested."

This guide documents our transformation from mock-based testing to real infrastructure testing.

## Current State (BEFORE)
- 242 test files, 1,589 test cases - ALL USING MOCKS
- Zero confidence that the app actually works
- Tests passing but features broken in production
- Mocks hiding real bugs and integration issues

## Target State (AFTER)
- ALL tests run against real databases
- Real authentication with Clerk
- Real API calls to Stripe, Alpha Vantage
- 80%+ code coverage with REAL tests
- Complete confidence in production deployments

## Setup Instructions

### 1. Create Supabase Test Projects

Go to [Supabase Dashboard](https://supabase.com/dashboard) and create THREE separate projects:

1. **wealthtracker-test-unit** - For unit tests
2. **wealthtracker-test-integration** - For integration tests
3. **wealthtracker-test-e2e** - For end-to-end tests

For each project:
- Copy the project URL and anon key
- Run the same migrations as production
- Enable Row Level Security (RLS)

### 2. Create Clerk Test Application

Go to [Clerk Dashboard](https://dashboard.clerk.com) and:

1. Create a new application called "WealthTracker Test"
2. Configure authentication methods (email/password)
3. Create test users:
   - `test@wealthtracker.test` (regular user)
   - `admin@wealthtracker.test` (admin user)
4. Copy the publishable key and secret key

### 3. Configure Stripe Test Mode

Go to [Stripe Dashboard](https://dashboard.stripe.com/test/apikeys) and:

1. Switch to Test Mode
2. Copy the test publishable key
3. Copy the test secret key
4. Set up a test webhook endpoint
5. Copy the webhook signing secret

### 4. Get Alpha Vantage API Key

Go to [Alpha Vantage](https://www.alphavantage.co/support/#api-key) and:

1. Get a free API key (5 requests/minute)
2. This is sufficient for testing

### 5. Set Up Local Environment

```bash
# Copy the example environment file
cp .env.test.example .env.test.local

# Edit with your real test credentials
nano .env.test.local

# Start local test databases (optional - use real Supabase instead)
docker-compose -f docker-compose.test.yml up -d

# Install dependencies if needed
npm install --save-dev tsx dotenv

# Seed test databases with data
npm run test:seed
```

### 6. Add NPM Scripts

Add these to `package.json` (already present in the main branch; the important part is the `VITEST_SUPABASE_MODE` toggle so real suites wire themselves correctly):

```json
{
  "scripts": {
    "test:seed": "tsx scripts/seed-test-data.ts",
    "test:unit": "VITEST_SUPABASE_MODE=mock vitest run --exclude='**/integration/**'",
    "test:integration": "VITEST_SUPABASE_MODE=real vitest run src/test/integration",
    "test:real": "VITEST_SUPABASE_MODE=real vitest run -c vitest.config.integration.ts",
    "test:smoke": "VITEST_SUPABASE_MODE=mock vitest run src/test/decimal-integration.test.tsx src/store/slices/layoutSlice.test.ts",
    "test:e2e": "playwright test"
  }
}
```

## Test Categories

### Unit Tests (30%)
- Pure functions only
- Business logic
- Utility functions
- NO external dependencies
- Use `wealthtracker-test-unit` database

### Integration Tests (50%)
- Service layer tests
- API endpoint tests
- Database operations
- Real Supabase queries
- Use `wealthtracker-test-integration` database

### E2E Tests (20%)
- Full user journeys
- Browser automation
- Real authentication flow
- Complete transactions
- Use `wealthtracker-test-e2e` database

## Migration Path

### Phase 1: Environment Setup ✅
- [x] Create test databases
- [x] Configure test services
- [x] Set up environment files
- [x] Create seeding scripts

### Phase 2: Remove Mocks (NEXT)
```bash
# Delete all mock files
rm -rf src/test/mocks/

# Find and remove vi.mock() calls
grep -r "vi.mock" src/ --include="*.test.ts" --include="*.test.tsx"

# Update each file to use real services
```

### Phase 3: Update Test Setup (AUTOMATED)
`src/test/setup/vitest-setup.ts` now reads `VITEST_SUPABASE_MODE` at runtime. When the value is `real` the true `@supabase/supabase-js` client is used; otherwise we swap in the lightweight mock. No manual edits required—just export the env var when you need the real harness.

### Phase 4: Convert Tests

Example conversion:

```typescript
// BEFORE (with mocks)
it('should create account', async () => {
  const mockCreate = vi.fn().mockResolvedValue({ data: mockAccount });
  vi.mocked(supabase.from).mockReturnValue({ insert: mockCreate });
  // ... test with mock
});

// AFTER (real database)
it('should create account', async () => {
  // Create real account in test database
  const { data, error } = await supabase
    .from('accounts')
    .insert({ name: 'Test Account', type: 'checking' })
    .select()
    .single();
  
  expect(error).toBeNull();
  expect(data).toMatchObject({ name: 'Test Account' });
  
  // Clean up
  await supabase.from('accounts').delete().eq('id', data.id);
});
```

## Test Data Management

### TestDataFactory Pattern

```typescript
class TestDataFactory {
  private supabase: SupabaseClient;
  private createdIds = { accounts: [], transactions: [], users: [] };
  
  async createAccount(overrides = {}) {
    const account = await this.supabase.from('accounts').insert({
      name: 'Test Account',
      type: 'checking',
      balance: '1000.00',
      ...overrides
    }).select().single();
    
    this.createdIds.accounts.push(account.data.id);
    return account.data;
  }
  
  async cleanup() {
    // Clean up all created test data
    for (const [table, ids] of Object.entries(this.createdIds)) {
      if (ids.length > 0) {
        await this.supabase.from(table).delete().in('id', ids);
      }
    }
  }
}
```

### Clerk/Supabase ID mapping

Integration suites that call into services using `userIdService` (goals, transactions, etc.) should seed the Clerk ↔ database UUID mapping up front. Priming the cache keeps real-mode runs fast and avoids RLS noise:

```typescript
import { userIdService } from '@/services/userIdService';

beforeEach(async () => {
  await seedUserAndMapping();
  userIdService.clearCache();
  userIdService.setCurrentUser(TEST_CLERK_ID, TEST_DATABASE_ID);
});
```


## CI/CD Integration

### GitHub Actions Configuration

```yaml
name: Test Suite

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      postgres:
        image: supabase/postgres:15.1.0.117
        env:
          POSTGRES_PASSWORD: test_password
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '20'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run migrations
        run: npm run db:migrate:test
        
      - name: Seed test data
        run: npm run test:seed
        
      - name: Run tests
        run: npm run test:all
        env:
          VITE_TEST_SUPABASE_URL: ${{ secrets.TEST_SUPABASE_URL }}
          VITE_TEST_SUPABASE_ANON_KEY: ${{ secrets.TEST_SUPABASE_ANON_KEY }}
```

## Monitoring & Metrics

### Test Performance Targets
- Unit tests: < 1 minute
- Integration tests: < 3 minutes
- E2E tests: < 5 minutes
- Total suite: < 10 minutes

### Coverage Requirements
- Overall: 80%+
- Critical paths: 95%+
- Financial calculations: 100%
- Security functions: 100%

## Common Issues & Solutions

### Issue: Tests are slow
**Solution**: Use parallel execution and connection pooling
```typescript
// vitest.config.ts
export default {
  test: {
    pool: 'threads',
    poolOptions: {
      threads: {
        maxThreads: 4,
        minThreads: 1
      }
    }
  }
}
```

### Issue: Database conflicts
**Solution**: Use transaction isolation
```typescript
await supabase.rpc('begin_test_transaction');
// ... run test
await supabase.rpc('rollback_test_transaction');
```

### Issue: Flaky tests
**Solution**: Add proper waits and retries
```typescript
import { waitFor } from '@testing-library/react';

await waitFor(() => {
  expect(screen.getByText('Success')).toBeInTheDocument();
}, { timeout: 5000 });
```

## Success Metrics

### Before Transformation
- ❌ 0% real infrastructure testing
- ❌ False confidence from mocks
- ❌ Bugs discovered in production
- ❌ No integration test coverage

### After Transformation
- ✅ 100% real infrastructure testing
- ✅ Complete confidence in tests
- ✅ Bugs caught before deployment
- ✅ Full integration coverage

## Next Steps

1. **Immediate**: Set up test infrastructure (databases, services)
2. **Week 1**: Remove all mocks and vi.mock() calls
3. **Week 2-3**: Convert existing tests to real tests
4. **Week 4**: Add missing integration tests
5. **Ongoing**: Maintain real testing standards

## Resources

- [Supabase Testing Guide](https://supabase.com/docs/guides/database/testing)
- [Clerk Testing Documentation](https://clerk.com/docs/testing/overview)
- [Vitest Configuration](https://vitest.dev/config/)
- [Testing Best Practices](https://testingjavascript.com/)

---

**Remember**: Every mock is a lie. Every real test is truth. Choose truth.

*Last Updated: 2025-09-02*
