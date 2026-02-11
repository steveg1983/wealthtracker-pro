import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { OpsAlertStatsResponse } from '../types/banking-api';
import { TRUELAYER_JWKS_CIRCUIT_EVENT_PREFIX } from '../constants/bankingOps';
import BankingCriticalIncidentBadge from './BankingCriticalIncidentBadge';

const { mockGetOpsAlertStats, mockSetAuthTokenProvider, mockGetToken } = vi.hoisted(() => ({
  mockGetOpsAlertStats: vi.fn(),
  mockSetAuthTokenProvider: vi.fn(),
  mockGetToken: vi.fn(async () => 'test-token')
}));

vi.mock('../services/bankConnectionService', () => ({
  bankConnectionService: {
    getOpsAlertStats: mockGetOpsAlertStats,
    setAuthTokenProvider: mockSetAuthTokenProvider
  }
}));

vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ getToken: mockGetToken })
}));

vi.mock('../loggers/scopedLogger', () => ({
  createScopedLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn()
  })
}));

const createResponse = (overrides?: Partial<OpsAlertStatsResponse>): OpsAlertStatsResponse => ({
  success: true,
  filters: {
    eventType: null,
    minSuppressed: 10,
    limit: 1,
    onlyAboveThreshold: true
  },
  threshold: {
    enabled: true,
    suppressionThreshold: 10,
    suppressionNotifyEvery: 10
  },
  count: 1,
  summary: {
    totalSuppressed: 24,
    maxSuppressedCount: 24,
    mostRecentLastSentAt: '2026-02-10T11:00:00.000Z',
    mostRecentUpdatedAt: '2026-02-10T11:05:00.000Z',
    rowsAboveThreshold: 3
  },
  rows: [
    {
      dedupeKey: 'banking.dead_letter_detected:abc',
      eventType: 'banking.dead_letter_detected',
      lastSentAt: '2026-02-10T11:00:00.000Z',
      suppressedCount: 24,
      updatedAt: '2026-02-10T11:05:00.000Z',
      isAboveThreshold: true
    }
  ],
  ...overrides
});

describe('BankingCriticalIncidentBadge', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a compact badge when above-threshold incidents exist', async () => {
    mockGetOpsAlertStats.mockResolvedValueOnce(createResponse());

    render(<BankingCriticalIncidentBadge />);

    expect(await screen.findByText('3 critical incidents')).toBeInTheDocument();
    expect(mockSetAuthTokenProvider).toHaveBeenCalledTimes(1);
    expect(mockGetOpsAlertStats).toHaveBeenCalledWith({
      onlyAboveThreshold: true,
      limit: 1
    });
  });

  it('hides the badge when there are no incidents above threshold', async () => {
    mockGetOpsAlertStats.mockResolvedValueOnce(
      createResponse({
        summary: {
          totalSuppressed: 0,
          maxSuppressedCount: 0,
          mostRecentLastSentAt: null,
          mostRecentUpdatedAt: null,
          rowsAboveThreshold: 0
        },
        rows: []
      })
    );

    render(<BankingCriticalIncidentBadge />);

    await waitFor(() => {
      expect(mockGetOpsAlertStats).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByText(/critical incident/i)).not.toBeInTheDocument();
  });

  it('hides the badge for non-admin users (403/forbidden)', async () => {
    mockGetOpsAlertStats.mockRejectedValueOnce(
      Object.assign(new Error('Admin access required'), {
        status: 403,
        code: 'forbidden'
      })
    );

    render(<BankingCriticalIncidentBadge />);

    await waitFor(() => {
      expect(mockGetOpsAlertStats).toHaveBeenCalledTimes(1);
    });
    expect(screen.queryByText(/critical incident/i)).not.toBeInTheDocument();
  });

  it('auto-refreshes every 30 seconds while visible', async () => {
    mockGetOpsAlertStats.mockResolvedValue(createResponse());
    const intervalCallbacks: Array<() => void> = [];
    const setIntervalSpy = vi
      .spyOn(window, 'setInterval')
      .mockImplementation(((callback: TimerHandler) => {
        if (typeof callback === 'function') {
          intervalCallbacks.push(callback);
        }
        return 1 as unknown as number;
      }) as typeof window.setInterval);
    const clearIntervalSpy = vi.spyOn(window, 'clearInterval').mockImplementation(() => {});

    try {
      render(<BankingCriticalIncidentBadge />);

      await screen.findByText('3 critical incidents');
      expect(setIntervalSpy).toHaveBeenCalledWith(expect.any(Function), 30000);
      expect(intervalCallbacks).not.toHaveLength(0);

      mockGetOpsAlertStats.mockClear();
      intervalCallbacks.forEach((callback) => {
        callback();
      });

      await waitFor(() => {
        expect(mockGetOpsAlertStats).toHaveBeenCalledWith({
          onlyAboveThreshold: true,
          limit: 1
        });
      });
    } finally {
      setIntervalSpy.mockRestore();
      clearIntervalSpy.mockRestore();
    }
  });

  it('invokes click handler when rendered as interactive badge', async () => {
    mockGetOpsAlertStats.mockResolvedValueOnce(createResponse());
    const onClick = vi.fn();

    render(<BankingCriticalIncidentBadge onClick={onClick} />);

    const button = await screen.findByRole('button', { name: '3 critical incidents' });
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('renders JWKS mode badge and scopes query to JWKS circuit events', async () => {
    mockGetOpsAlertStats.mockResolvedValueOnce(createResponse());

    render(<BankingCriticalIncidentBadge mode="truelayer_jwks" />);

    expect(await screen.findByText('3 JWKS incidents')).toBeInTheDocument();
    expect(mockGetOpsAlertStats).toHaveBeenCalledWith({
      onlyAboveThreshold: true,
      limit: 1,
      eventTypePrefix: TRUELAYER_JWKS_CIRCUIT_EVENT_PREFIX
    });
  });
});
