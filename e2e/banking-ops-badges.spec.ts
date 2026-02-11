import { expect, test, type Page } from '@playwright/test';

const DATA_MANAGEMENT_URL = '/settings/data?testMode=true&demo=true';
const JWKS_EVENT_PREFIX = 'banking.truelayer.jwks_circuit_';

type OpsStatsPayload = {
  success: true;
  filters: {
    eventType: string | null;
    eventTypePrefix: string | null;
    minSuppressed: number;
    limit: number;
    onlyAboveThreshold: boolean;
  };
  threshold: {
    enabled: true;
    suppressionThreshold: number;
    suppressionNotifyEvery: number;
  };
  count: number;
  summary: {
    totalSuppressed: number;
    maxSuppressedCount: number;
    mostRecentLastSentAt: string;
    mostRecentUpdatedAt: string;
    rowsAboveThreshold: number;
  };
  rows: Array<{
    dedupeKey: string;
    eventType: string;
    lastSentAt: string;
    suppressedCount: number;
    updatedAt: string;
    isAboveThreshold: boolean;
  }>;
};

const buildOpsStatsPayload = (query: URLSearchParams): OpsStatsPayload => {
  const eventType = query.get('eventType');
  const eventTypePrefix = query.get('eventTypePrefix');
  const onlyAboveThreshold = query.get('onlyAboveThreshold') === '1';
  const minSuppressed = Number.parseInt(query.get('minSuppressed') ?? '0', 10) || 0;
  const limit = Number.parseInt(query.get('limit') ?? '10', 10) || 10;

  const isJwks = eventTypePrefix === JWKS_EVENT_PREFIX;
  const rowsAboveThreshold = isJwks ? 1 : 3;

  return {
    success: true,
    filters: {
      eventType,
      eventTypePrefix,
      minSuppressed,
      limit,
      onlyAboveThreshold
    },
    threshold: {
      enabled: true,
      suppressionThreshold: 2,
      suppressionNotifyEvery: 1
    },
    count: rowsAboveThreshold,
    summary: {
      totalSuppressed: rowsAboveThreshold,
      maxSuppressedCount: rowsAboveThreshold,
      mostRecentLastSentAt: '2026-02-10T10:00:00.000Z',
      mostRecentUpdatedAt: '2026-02-10T10:05:00.000Z',
      rowsAboveThreshold
    },
    rows: [
      {
        dedupeKey: isJwks
          ? 'banking.truelayer.jwks_circuit_opened'
          : 'banking.dead_letter_detected',
        eventType: isJwks
          ? 'banking.truelayer.jwks_circuit_opened'
          : 'banking.dead_letter_detected',
        lastSentAt: '2026-02-10T10:00:00.000Z',
        suppressedCount: rowsAboveThreshold,
        updatedAt: '2026-02-10T10:05:00.000Z',
        isAboveThreshold: true
      }
    ]
  };
};

const setupBankingApiStubs = async (page: Page): Promise<{ authHeaders: string[] }> => {
  const authHeaders: string[] = [];
  const rememberAuthHeader = (pageRequest: { headers: () => Record<string, string> }) => {
    const value = pageRequest.headers().authorization;
    if (value) {
      authHeaders.push(value);
    }
  };

  await page.route('**/api/banking/ops-alert-stats**', async (route) => {
    rememberAuthHeader(route.request());
    const url = new URL(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(buildOpsStatsPayload(url.searchParams))
    });
  });

  await page.route('**/api/banking/connections', async (route) => {
    rememberAuthHeader(route.request());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '[]'
    });
  });

  await page.route('**/api/banking/health', async (route) => {
    rememberAuthHeader(route.request());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        env_check: {
          has_truelayer_client_id: true,
          has_truelayer_secret: true,
          has_redirect_uri: true
        }
      })
    });
  });

  await page.route(/\/api\/banking\/dead-letter-admin-audit(\?|$)/, async (route) => {
    rememberAuthHeader(route.request());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        count: 1,
        summary: {
          requestedTotal: 1,
          resetTotal: 1,
          pendingCount: 0,
          completedCount: 1,
          failedCount: 0
        },
        page: {
          hasMore: false,
          nextCursor: null
        },
        rows: [
          {
            id: 'audit_1',
            action: 'reset_dead_letter',
            status: 'completed',
            scope: 'single',
            reason: 'e2e verification',
            requestedCount: 1,
            resetCount: 1,
            failedCount: 0,
            connectionIds: ['conn_1'],
            failedConnectionIds: [],
            failureReason: null,
            metadata: null,
            createdAt: '2026-02-10T10:05:00.000Z',
            updatedAt: '2026-02-10T10:05:00.000Z',
            adminClerkId: 'user_test'
          }
        ]
      })
    });
  });

  return { authHeaders };
};

const waitForDataManagementPage = async (page: Page): Promise<void> => {
  await page.goto(DATA_MANAGEMENT_URL, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('text=Loading Wealth Tracker...', {
    state: 'detached',
    timeout: 45_000
  }).catch(() => undefined);
  await expect(page.locator('h1:has-text("Data Management")')).toBeVisible({ timeout: 45_000 });
};

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('isTestMode', 'true');
  });
});

test('critical incident badge opens Bank Connections with critical + failed-audit filters', async ({ page }) => {
  const { authHeaders } = await setupBankingApiStubs(page);

  await waitForDataManagementPage(page);

  const criticalBadge = page.locator('button[aria-label*="critical incident"]');
  await expect(criticalBadge).toBeVisible();
  await criticalBadge.click();

  await expect(page.locator('h2:has-text("Bank Connections")')).toBeVisible();
  await expect(page.getByText('Dead-Letter Reset Audit')).toBeVisible();
  await expect(page.getByLabel('Above Threshold Only')).toBeChecked();
  await expect(page.getByLabel('Event Prefix')).toHaveValue('');

  await expect.poll(() => new URL(page.url()).searchParams.get('bankingModal')).toBe('1');
  await expect.poll(() => new URL(page.url()).searchParams.get('bankingOpsOnlyAboveThreshold')).toBe('1');
  await expect.poll(() => new URL(page.url()).searchParams.get('bankingAuditOpen')).toBe('1');
  await expect.poll(() => new URL(page.url()).searchParams.get('bankingAuditStatus')).toBe('failed');
  await expect.poll(() => new URL(page.url()).searchParams.get('bankingOpsEventPrefix')).toBeNull();

  await expect.poll(() => authHeaders.length).toBeGreaterThan(0);
  expect(authHeaders).toContain('Bearer e2e-test-token');
});

test('JWKS incident badge opens Bank Connections with JWKS prefix filter', async ({ page }) => {
  const { authHeaders } = await setupBankingApiStubs(page);

  await waitForDataManagementPage(page);

  const jwksBadge = page.locator('button[aria-label*="JWKS incident"]');
  await expect(jwksBadge).toBeVisible();
  await jwksBadge.click();

  await expect(page.locator('h2:has-text("Bank Connections")')).toBeVisible();
  await expect(page.getByLabel('Event Prefix')).toHaveValue(JWKS_EVENT_PREFIX);
  await expect(page.getByLabel('Above Threshold Only')).toBeChecked();
  await expect(page.getByText('Dead-Letter Reset Audit')).toHaveCount(0);

  await expect.poll(() => new URL(page.url()).searchParams.get('bankingModal')).toBe('1');
  await expect.poll(() => new URL(page.url()).searchParams.get('bankingOpsOnlyAboveThreshold')).toBe('1');
  await expect.poll(() => new URL(page.url()).searchParams.get('bankingOpsEventPrefix')).toBe(JWKS_EVENT_PREFIX);
  await expect.poll(() => new URL(page.url()).searchParams.get('bankingAuditOpen')).toBeNull();
  await expect.poll(() => new URL(page.url()).searchParams.get('bankingAuditStatus')).toBeNull();

  await expect.poll(() => authHeaders.length).toBeGreaterThan(0);
  expect(authHeaders).toContain('Bearer e2e-test-token');
});
