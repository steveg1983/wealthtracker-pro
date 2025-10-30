# WealthTracker Frontend Production Plan
*Apple/Google Quality Standards for Commercial Deployment*

## Executive Summary
This document outlines the comprehensive plan to bring WealthTracker's frontend to Apple/Google quality standards for commercial deployment. Current state: **40-45% production ready**. Target: **100% commercial grade**.

## 🎯 Core Principles
- **NO MOCKS**: All tests use real infrastructure (Supabase, Clerk, APIs)
- **PRODUCTION FIRST**: Every change must improve real-world performance
- **MEASURABLE**: All improvements tracked with metrics
- **USER-CENTRIC**: Focus on actual user experience, not synthetic benchmarks

## 📊 Current State Assessment

### Critical Metrics
| Metric | Current | Target | Gap |
|--------|---------|--------|-----|
| Bundle Size (initial) | 4.4MB | <500KB | 8.8x |
| Load Time (3G) | 8-12s | <2s | 6x |
| Lighthouse Score | 45/100 | >90/100 | 45 points |
| Test Coverage | 35% | >80% | 45% |
| Type Safety | 3,901 "as any" | 0 | 3,901 violations |
| Real Tests | ~10% | 100% | 90% |
| Memory Usage | 150MB+ | <50MB | 3x |

## 🚨 Phase 1: Critical Performance (Week 1-2)
*Must fix before any production deployment*

### 1.1 Bundle Size Emergency (32 hours)

#### Current Problem
```javascript
// Current: Everything loads synchronously
- Plotly.js: 1.2MB
- XLSX/jsPDF: 1.1MB
- AG-Grid: 526KB
- Total: 14.89MB uncompressed JS
```

#### Implementation Plan

**Day 1-2: Lazy Load Heavy Libraries**
```typescript
// Before: Synchronous import killing performance
import Plot from 'react-plotly.js';

// After: Load only when needed
const PlotlyChart = lazy(() =>
  import('react-plotly.js').then(module => ({
    default: module.default
  }))
);

// Usage with loading state
{showChart && (
  <LazyErrorBoundary componentName="Chart">
    <Suspense fallback={<ChartSkeleton />}>
      <PlotlyChart data={data} layout={layout} />
    </Suspense>
  </LazyErrorBoundary>
)}
```

**Day 3-4: Dynamic Import Export Features**
```typescript
// services/exportService.ts
class ExportService {
  private xlsxModule?: typeof import('xlsx');
  private jsPDFModule?: typeof import('jspdf');

  async exportToExcel(data: Transaction[]) {
    // Load XLSX only when user clicks export
    if (!this.xlsxModule) {
      const loadingToast = toast.loading('Preparing export...');
      this.xlsxModule = await import('xlsx');
      toast.dismiss(loadingToast);
    }

    // Now use the module
    const workbook = this.xlsxModule.utils.book_new();
    // ... export logic
  }

  async exportToPDF(data: Transaction[]) {
    // Load jsPDF only when needed
    if (!this.jsPDFModule) {
      const loadingToast = toast.loading('Preparing PDF...');
      const { jsPDF } = await import('jspdf');
      await import('jspdf-autotable');
      this.jsPDFModule = { jsPDF };
      toast.dismiss(loadingToast);
    }

    // Generate PDF
    const doc = new this.jsPDFModule.jsPDF();
    // ... PDF generation
  }
}
```

**Day 5-6: Context Service Injection**
```typescript
// Before: Context imports all services (BAD)
// AppContext.tsx
import { accountService } from '../services/accountService';
import { transactionService } from '../services/transactionService';
// ... 10 more imports creating 5.9MB bundle

// After: Dependency injection pattern
interface AppContextValue {
  getService: <T>(name: ServiceName) => Promise<T>;
}

const serviceLoaders = {
  account: () => import('../services/accountService'),
  transaction: () => import('../services/transactionService'),
  budget: () => import('../services/budgetService'),
};

const AppContext: React.FC = ({ children }) => {
  const serviceCache = useRef<Map<string, any>>(new Map());

  const getService = async <T,>(name: ServiceName): Promise<T> => {
    if (!serviceCache.current.has(name)) {
      const module = await serviceLoaders[name]();
      serviceCache.current.set(name, module.default);
    }
    return serviceCache.current.get(name);
  };

  return (
    <AppContext.Provider value={{ getService }}>
      {children}
    </AppContext.Provider>
  );
};
```

**Day 7: Aggressive Code Splitting**
```typescript
// routes/index.tsx
const routes = [
  {
    path: '/dashboard',
    // Preload dashboard as it's commonly visited
    component: lazy(() => {
      const module = import('../pages/Dashboard');
      // Prefetch next likely routes
      import('../pages/Transactions');
      import('../pages/Accounts');
      return module;
    }),
  },
  {
    path: '/transactions',
    component: lazy(() => import('../pages/Transactions')),
  },
  {
    path: '/analytics',
    // Heavy page - load with loading state
    component: lazy(() => import('../pages/Analytics')),
  },
];
```

#### Success Metrics
- [ ] Initial bundle <500KB
- [ ] Route chunks <200KB each
- [ ] Load time <3s on 3G
- [ ] Lighthouse score >70

### 1.2 Virtual Scrolling Implementation (16 hours)

#### Current Problem
- Rendering 1000+ transactions causes 2-3 second freezes
- Memory usage spikes to 300MB+
- Scroll jank on mobile

#### Implementation Plan

**Day 8-9: Universal Virtual List Component**
```typescript
// components/VirtualList.tsx
import { VariableSizeList } from 'react-window';
import AutoSizer from 'react-virtualized-auto-sizer';

interface VirtualListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => React.ReactNode;
  getItemSize?: (index: number) => number;
  overscan?: number;
}

export function VirtualList<T>({
  items,
  renderItem,
  getItemSize = () => 80,
  overscan = 5
}: VirtualListProps<T>) {
  const itemData = useMemo(() => ({
    items,
    renderItem
  }), [items, renderItem]);

  return (
    <AutoSizer>
      {({ height, width }) => (
        <VariableSizeList
          height={height}
          width={width}
          itemCount={items.length}
          itemSize={getItemSize}
          itemData={itemData}
          overscanCount={overscan}
        >
          {Row}
        </VariableSizeList>
      )}
    </AutoSizer>
  );
}

// Usage in TransactionList
<VirtualList
  items={transactions}
  renderItem={(transaction) => (
    <TransactionRow
      key={transaction.id}
      transaction={transaction}
      onEdit={handleEdit}
    />
  )}
  getItemSize={(index) =>
    transactions[index].hasAttachment ? 100 : 80
  }
/>
```

#### Success Metrics
- [ ] Smooth scrolling with 10,000+ items
- [ ] Memory usage <100MB with large lists
- [ ] 60 FPS scrolling on mobile

### 1.3 Loading State Excellence (8 hours)

#### Implementation Plan

**Day 10: Skeleton System**
```typescript
// components/skeletons/SkeletonSystem.tsx
export const TransactionSkeleton = ({ count = 5 }) => (
  <div className="space-y-2">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="flex items-center p-4 bg-white rounded-lg animate-pulse">
        <div className="w-10 h-10 bg-gray-200 rounded-full" />
        <div className="ml-4 flex-1">
          <div className="h-4 bg-gray-200 rounded w-3/4" />
          <div className="h-3 bg-gray-200 rounded w-1/2 mt-2" />
        </div>
        <div className="h-5 bg-gray-200 rounded w-20" />
      </div>
    ))}
  </div>
);

// Progressive loading with skeleton
const TransactionPage = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => {
    loadTransactions(page).then(data => {
      setTransactions(prev => [...prev, ...data]);
      setLoading(false);
    });
  }, [page]);

  return (
    <div>
      {transactions.map(t => <TransactionRow key={t.id} {...t} />)}
      {loading && <TransactionSkeleton count={10} />}
      <InfiniteScrollTrigger onVisible={() => setPage(p => p + 1)} />
    </div>
  );
};
```

## 🧪 Phase 2: Real Testing Infrastructure (Week 2-3)
*NO MOCKS - Real infrastructure only*

### 2.1 Real Integration Tests (24 hours)

#### Principle: Test Against Real Services
```typescript
// ❌ NEVER DO THIS - No mocked services
vi.mock('@supabase/supabase-js');
vi.mock('@clerk/clerk-react');

// ✅ ALWAYS DO THIS - Real services
import { createClient } from '@supabase/supabase-js';
import { createTestUser, cleanupTestUser } from './test-utils';
```

#### Implementation Plan

**Day 11-12: Real Database Test Framework**
```typescript
// test/setup/realTestEnvironment.ts
import { createClient } from '@supabase/supabase-js';
import { v4 as uuid } from 'uuid';

export class RealTestEnvironment {
  private supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.VITE_SUPABASE_SERVICE_ROLE_KEY!
  );

  private testUserId: string;
  private testData: Map<string, any[]> = new Map();

  async setup() {
    // Create real test user in database
    this.testUserId = uuid();
    const { data: user, error } = await this.supabase
      .from('users')
      .insert({
        id: this.testUserId,
        email: `test-${this.testUserId}@test.com`,
        first_name: 'Test',
        last_name: 'User',
      })
      .select()
      .single();

    if (error) throw error;
    return user;
  }

  async createAccount(data: Partial<Account>) {
    const { data: account } = await this.supabase
      .from('accounts')
      .insert({
        user_id: this.testUserId,
        name: 'Test Account',
        type: 'checking',
        balance: 1000,
        ...data
      })
      .select()
      .single();

    this.trackForCleanup('accounts', account);
    return account;
  }

  async createTransaction(accountId: string, data: Partial<Transaction>) {
    const { data: transaction } = await this.supabase
      .from('transactions')
      .insert({
        user_id: this.testUserId,
        account_id: accountId,
        amount: 50,
        type: 'expense',
        date: new Date().toISOString(),
        ...data
      })
      .select()
      .single();

    this.trackForCleanup('transactions', transaction);
    return transaction;
  }

  private trackForCleanup(table: string, item: any) {
    if (!this.testData.has(table)) {
      this.testData.set(table, []);
    }
    this.testData.get(table)!.push(item);
  }

  async cleanup() {
    // Clean up in reverse order of dependencies
    const cleanupOrder = ['transactions', 'budgets', 'goals', 'accounts', 'users'];

    for (const table of cleanupOrder) {
      if (this.testData.has(table)) {
        const items = this.testData.get(table)!;
        for (const item of items) {
          await this.supabase
            .from(table)
            .delete()
            .eq('id', item.id);
        }
      }
    }

    // Final user cleanup
    await this.supabase
      .from('users')
      .delete()
      .eq('id', this.testUserId);
  }
}
```

**Day 13-14: Real Transaction Flow Tests**
```typescript
// test/integration/TransactionFlow.real.test.tsx
import { RealTestEnvironment } from '../setup/realTestEnvironment';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

describe('Transaction Flow - Real Database', () => {
  let env: RealTestEnvironment;
  let testAccount: Account;

  beforeEach(async () => {
    env = new RealTestEnvironment();
    await env.setup();
    testAccount = await env.createAccount({
      name: 'Test Checking',
      balance: 1000
    });
  });

  afterEach(async () => {
    await env.cleanup();
  });

  it('should create real transaction and update account balance', async () => {
    // Render with real providers
    const { container } = render(
      <RealSupabaseProvider>
        <AddTransactionModal
          isOpen={true}
          accountId={testAccount.id}
        />
      </RealSupabaseProvider>
    );

    // Fill form with real data
    fireEvent.change(screen.getByLabelText('Description'), {
      target: { value: 'Coffee Shop' }
    });

    fireEvent.change(screen.getByLabelText('Amount'), {
      target: { value: '4.50' }
    });

    fireEvent.click(screen.getByText('Save Transaction'));

    // Wait for real database update
    await waitFor(async () => {
      const { data: updatedAccount } = await env.supabase
        .from('accounts')
        .select('balance')
        .eq('id', testAccount.id)
        .single();

      expect(updatedAccount.balance).toBe('995.50'); // Uses Decimal precision
    }, { timeout: 5000 });

    // Verify transaction created
    const { data: transactions } = await env.supabase
      .from('transactions')
      .select('*')
      .eq('account_id', testAccount.id);

    expect(transactions).toHaveLength(1);
    expect(transactions[0].description).toBe('Coffee Shop');
    expect(transactions[0].amount).toBe('4.50');
  });

  it('should handle concurrent transactions correctly', async () => {
    // Create multiple transactions simultaneously
    const promises = Array.from({ length: 10 }, (_, i) =>
      env.createTransaction(testAccount.id, {
        amount: 10,
        description: `Transaction ${i}`
      })
    );

    await Promise.all(promises);

    // Verify all transactions exist and balance is correct
    const { data: finalAccount } = await env.supabase
      .from('accounts')
      .select('balance')
      .eq('id', testAccount.id)
      .single();

    expect(finalAccount.balance).toBe('900.00'); // 1000 - (10 * 10)
  });
});
```

### 2.2 Real E2E Tests with Playwright (16 hours)

**Day 15-16: Real User Flow Tests**
```typescript
// e2e/userJourney.spec.ts
import { test, expect } from '@playwright/test';
import { RealTestEnvironment } from '../test/setup/realTestEnvironment';

test.describe('Real User Journey', () => {
  let env: RealTestEnvironment;
  let testUser: any;

  test.beforeEach(async () => {
    env = new RealTestEnvironment();
    testUser = await env.setup();

    // Create initial data
    const account = await env.createAccount({
      name: 'Checking',
      balance: 5000
    });

    // Create some transactions
    for (let i = 0; i < 20; i++) {
      await env.createTransaction(account.id, {
        amount: Math.random() * 100,
        description: `Transaction ${i}`,
        date: new Date(Date.now() - i * 86400000).toISOString()
      });
    }
  });

  test.afterEach(async () => {
    await env.cleanup();
  });

  test('Complete financial review workflow', async ({ page }) => {
    // Login with real test user
    await page.goto('/login');
    await page.fill('[name="email"]', testUser.email);
    await page.fill('[name="password"]', 'TestPassword123!');
    await page.click('button[type="submit"]');

    // Wait for real data to load
    await page.waitForSelector('[data-testid="net-worth-card"]');

    // Verify real balance displays
    const balanceText = await page.textContent('[data-testid="total-balance"]');
    expect(balanceText).toContain('$5,000.00');

    // Navigate to transactions
    await page.click('a[href="/transactions"]');

    // Wait for virtual list to render
    await page.waitForSelector('[data-testid="transaction-list"]');

    // Verify transactions loaded
    const transactionRows = await page.$$('[data-testid="transaction-row"]');
    expect(transactionRows.length).toBeGreaterThan(0);

    // Test real-time search
    await page.fill('[data-testid="search-input"]', 'Transaction 5');
    await page.waitForTimeout(300); // Debounce delay

    const filteredRows = await page.$$('[data-testid="transaction-row"]');
    expect(filteredRows.length).toBe(1);

    // Test export with real data
    await page.click('[data-testid="export-button"]');
    await page.click('[data-testid="export-csv"]');

    // Wait for download
    const download = await page.waitForEvent('download');
    expect(download.suggestedFilename()).toContain('transactions');

    // Verify CSV contains real data
    const content = await download.path();
    // Parse and verify CSV content...
  });

  test('Performance under load', async ({ page }) => {
    // Create 1000 transactions for performance testing
    const account = await env.createAccount({ balance: 100000 });

    const batchSize = 100;
    for (let batch = 0; batch < 10; batch++) {
      const promises = Array.from({ length: batchSize }, (_, i) =>
        env.createTransaction(account.id, {
          amount: Math.random() * 500,
          description: `Bulk Transaction ${batch * batchSize + i}`
        })
      );
      await Promise.all(promises);
    }

    await page.goto('/transactions');

    // Measure performance metrics
    const metrics = await page.evaluate(() => {
      return {
        memory: (performance as any).memory?.usedJSHeapSize,
        loadTime: performance.timing.loadEventEnd - performance.timing.navigationStart,
      };
    });

    expect(metrics.loadTime).toBeLessThan(3000); // <3 seconds
    expect(metrics.memory).toBeLessThan(100 * 1024 * 1024); // <100MB

    // Test scrolling performance
    await page.evaluate(() => {
      const element = document.querySelector('[data-testid="transaction-list"]');
      element?.scrollTo(0, 10000);
    });

    // No jank - should maintain 60fps
    const fps = await page.evaluate(() => {
      return new Promise(resolve => {
        let frames = 0;
        const startTime = performance.now();

        function count() {
          frames++;
          if (performance.now() - startTime < 1000) {
            requestAnimationFrame(count);
          } else {
            resolve(frames);
          }
        }

        requestAnimationFrame(count);
      });
    });

    expect(fps).toBeGreaterThan(50); // Smooth scrolling
  });
});
```

### 2.3 Performance Testing (8 hours)

**Day 17: Real Performance Benchmarks**
```typescript
// test/performance/bundleSize.test.ts
import { test, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Bundle Size Limits', () => {
  const distPath = path.join(process.cwd(), 'dist/assets');

  test('initial bundle should be under 500KB', () => {
    const indexFile = fs.readdirSync(distPath)
      .find(f => f.startsWith('index-') && f.endsWith('.js'));

    const stats = fs.statSync(path.join(distPath, indexFile));
    const sizeInKB = stats.size / 1024;

    expect(sizeInKB).toBeLessThan(500);
  });

  test('no chunk should exceed 300KB', () => {
    const files = fs.readdirSync(distPath)
      .filter(f => f.endsWith('.js'));

    for (const file of files) {
      const stats = fs.statSync(path.join(distPath, file));
      const sizeInKB = stats.size / 1024;

      expect(sizeInKB).toBeLessThan(300);
    }
  });

  test('total JS should be under 2MB', () => {
    const files = fs.readdirSync(distPath)
      .filter(f => f.endsWith('.js'));

    const totalSize = files.reduce((sum, file) => {
      const stats = fs.statSync(path.join(distPath, file));
      return sum + stats.size;
    }, 0);

    const sizeInMB = totalSize / (1024 * 1024);
    expect(sizeInMB).toBeLessThan(2);
  });
});

// test/performance/lighthouse.test.ts
import lighthouse from 'lighthouse';
import chromeLauncher from 'chrome-launcher';

describe('Lighthouse Performance', () => {
  let chrome;

  beforeAll(async () => {
    chrome = await chromeLauncher.launch({ chromeFlags: ['--headless'] });
  });

  afterAll(async () => {
    await chrome.kill();
  });

  test('should score above 90 on Lighthouse', async () => {
    const options = {
      port: chrome.port,
      output: 'json',
      onlyCategories: ['performance'],
    };

    const runnerResult = await lighthouse('http://localhost:3000', options);
    const score = runnerResult.lhr.categories.performance.score * 100;

    expect(score).toBeGreaterThan(90);
  });

  test('Core Web Vitals should pass', async () => {
    const runnerResult = await lighthouse('http://localhost:3000');
    const metrics = runnerResult.lhr.audits;

    expect(metrics['largest-contentful-paint'].numericValue).toBeLessThan(2500);
    expect(metrics['first-input-delay'].numericValue).toBeLessThan(100);
    expect(metrics['cumulative-layout-shift'].numericValue).toBeLessThan(0.1);
  });
});
```

## 📈 Phase 3: Production Monitoring (Week 3)

### 3.1 Real User Monitoring (8 hours)

**Day 18: Implement RUM**
```typescript
// services/rumService.ts
import * as Sentry from '@sentry/react';

class RealUserMonitoring {
  private metrics: Map<string, number[]> = new Map();

  initialize() {
    // Track Core Web Vitals
    this.trackWebVitals();

    // Track custom metrics
    this.trackCustomMetrics();

    // Send to monitoring service
    this.setupReporting();
  }

  private trackWebVitals() {
    // LCP - Largest Contentful Paint
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        this.recordMetric('lcp', entry.startTime);

        // Alert if LCP is poor
        if (entry.startTime > 4000) {
          Sentry.captureMessage('Poor LCP detected', {
            level: 'warning',
            extra: { lcp: entry.startTime }
          });
        }
      }
    }).observe({ type: 'largest-contentful-paint', buffered: true });

    // FID - First Input Delay
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as PerformanceEventTiming[]) {
        const delay = entry.processingStart - entry.startTime;
        this.recordMetric('fid', delay);

        if (delay > 300) {
          Sentry.captureMessage('Poor FID detected', {
            level: 'warning',
            extra: { fid: delay, target: entry.target }
          });
        }
      }
    }).observe({ type: 'first-input', buffered: true });
  }

  private trackCustomMetrics() {
    // Time to first transaction
    this.measureTime('first-transaction-load', async () => {
      const start = performance.now();
      await transactionService.loadTransactions({ limit: 50 });
      return performance.now() - start;
    });

    // Bundle cache hit rate
    if ('caches' in window) {
      this.trackCacheHitRate();
    }
  }

  private async trackCacheHitRate() {
    const cache = await caches.open('app-v1');
    let hits = 0;
    let misses = 0;

    // Intercept fetch to track cache usage
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const request = new Request(...args);
      const cached = await cache.match(request);

      if (cached) {
        hits++;
        this.recordMetric('cache-hit-rate', hits / (hits + misses));
        return cached;
      }

      misses++;
      const response = await originalFetch(...args);

      // Cache successful responses
      if (response.ok && request.method === 'GET') {
        cache.put(request, response.clone());
      }

      return response;
    };
  }

  private recordMetric(name: string, value: number) {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, []);
    }

    this.metrics.get(name)!.push(value);

    // Send to Sentry
    Sentry.addBreadcrumb({
      category: 'performance',
      message: `${name}: ${value}`,
      level: 'info',
    });
  }

  private setupReporting() {
    // Send metrics every 30 seconds
    setInterval(() => {
      const report = {};

      for (const [name, values] of this.metrics.entries()) {
        report[name] = {
          avg: values.reduce((a, b) => a + b, 0) / values.length,
          min: Math.min(...values),
          max: Math.max(...values),
          p95: this.percentile(values, 0.95),
        };
      }

      // Send to analytics
      if (Object.keys(report).length > 0) {
        Sentry.captureMessage('Performance Report', {
          level: 'info',
          extra: report
        });

        // Clear old metrics
        this.metrics.clear();
      }
    }, 30000);
  }

  private percentile(values: number[], p: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.floor(sorted.length * p);
    return sorted[index] || 0;
  }
}
```

## 📊 Success Metrics & Timeline

### Week 1-2 Deliverables
- [ ] Bundle size <500KB initial (from 4.4MB)
- [ ] Load time <3s on 3G (from 12s)
- [ ] Virtual scrolling for all lists
- [ ] Loading skeletons everywhere
- [ ] Service injection pattern implemented

### Week 2-3 Deliverables
- [ ] 20+ real integration tests
- [ ] 10+ real E2E tests
- [ ] Performance test suite
- [ ] Bundle size monitoring
- [ ] Test coverage >60%

### Week 3-4 Deliverables
- [ ] Real user monitoring live
- [ ] Sentry fully configured
- [ ] Performance dashboards
- [ ] Alerting configured
- [ ] Documentation complete

### Final Production Metrics
| Metric | Target | Measurement |
|--------|--------|-------------|
| Lighthouse | >90 | CI automated test |
| Bundle Size | <500KB | Build time check |
| Load Time | <2s | RUM P95 |
| Test Coverage | >80% | Vitest coverage |
| Type Safety | 0 "any" | ESLint rule |
| Real Tests | 100% | No vi.mock allowed |
| Memory | <50MB | RUM monitoring |

## 🚀 CI/CD Integration

```yaml
# .github/workflows/frontend-quality.yml
name: Frontend Quality Gates

on: [push, pull_request]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Bundle Size Check
        run: |
          npm run build
          npm run test:bundle-size

      - name: Type Safety Check
        run: |
          npm run typecheck:strict
          # Fail if any "as any" found
          ! grep -r "as any" src/

      - name: Real Integration Tests
        env:
          VITE_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
          VITE_SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_KEY }}
        run: npm run test:integration

      - name: E2E Tests
        run: npm run test:e2e

      - name: Lighthouse CI
        uses: treosh/lighthouse-ci-action@v9
        with:
          urls: |
            http://localhost:3000
            http://localhost:3000/transactions
          uploadArtifacts: true
          temporaryPublicStorage: true

      - name: Coverage Report
        run: npm run test:coverage

      - name: Require 80% Coverage
        uses: VeryGoodOpenSource/very_good_coverage@v2
        with:
          min_coverage: 80
```

## 🎯 Definition of Done

A feature is NOT complete until:

1. **Performance**
   - [ ] Lazy loaded if >50KB
   - [ ] Loading skeleton implemented
   - [ ] Virtual scrolling if list >100 items
   - [ ] Lighthouse score >90

2. **Testing**
   - [ ] Real integration tests (no mocks)
   - [ ] E2E test for critical path
   - [ ] Performance test for load time
   - [ ] >80% code coverage

3. **Quality**
   - [ ] Zero "as any" casts
   - [ ] Proper error boundaries
   - [ ] Accessibility tested
   - [ ] Mobile tested on real device

4. **Monitoring**
   - [ ] Errors reported to Sentry
   - [ ] Performance metrics tracked
   - [ ] User actions logged
   - [ ] Analytics events fired

## 🏁 Launch Readiness Checklist

### Absolute Requirements
- [ ] Bundle size <500KB initial
- [ ] Load time <2s on 4G
- [ ] Lighthouse >90
- [ ] Zero "as any" casts
- [ ] Sentry configured
- [ ] 80% test coverage
- [ ] All tests use real infrastructure
- [ ] E2E tests passing
- [ ] Performance monitoring active
- [ ] Error boundaries everywhere
- [ ] Accessibility WCAG 2.1 AA
- [ ] Security headers configured
- [ ] CSP policy active
- [ ] HTTPS only
- [ ] Service worker caching

### Nice to Have
- [ ] PWA installable
- [ ] Offline mode
- [ ] Push notifications
- [ ] Biometric authentication
- [ ] Dark mode
- [ ] Internationalization

---

*This plan is for Apple/Google-quality production deployment. No shortcuts, no mocks, no compromises.*