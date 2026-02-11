import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import BankingOpsAlertStatsCard from './BankingOpsAlertStatsCard';
import type { DeadLetterAdminAuditResponse, OpsAlertStatsResponse } from '../types/banking-api';

const {
  mockGetOpsAlertStats,
  mockTriggerOpsAlertTest,
  mockResetAllDeadLettered,
  mockResetDeadLetterConnections,
  mockGetDeadLetterRows,
  mockGetDeadLetterAudit,
  mockExportDeadLetterAuditCsv
} = vi.hoisted(() => ({
  mockGetOpsAlertStats: vi.fn(),
  mockTriggerOpsAlertTest: vi.fn(),
  mockResetAllDeadLettered: vi.fn(),
  mockResetDeadLetterConnections: vi.fn(),
  mockGetDeadLetterRows: vi.fn(),
  mockGetDeadLetterAudit: vi.fn(),
  mockExportDeadLetterAuditCsv: vi.fn()
}));

vi.mock('../services/bankConnectionService', () => ({
  bankConnectionService: {
    getOpsAlertStats: mockGetOpsAlertStats,
    triggerOpsAlertTest: mockTriggerOpsAlertTest,
    resetAllDeadLettered: mockResetAllDeadLettered,
    resetDeadLetterConnections: mockResetDeadLetterConnections,
    getDeadLetterRows: mockGetDeadLetterRows,
    getDeadLetterAudit: mockGetDeadLetterAudit,
    exportDeadLetterAuditCsv: mockExportDeadLetterAuditCsv
  }
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
    minSuppressed: 1,
    limit: 10,
    onlyAboveThreshold: false
  },
  threshold: {
    enabled: true,
    suppressionThreshold: 10,
    suppressionNotifyEvery: 10
  },
  count: 1,
  summary: {
    totalSuppressed: 12,
    maxSuppressedCount: 12,
    mostRecentLastSentAt: '2026-02-10T11:00:00.000Z',
    mostRecentUpdatedAt: '2026-02-10T11:05:00.000Z',
    rowsAboveThreshold: 1
  },
  rows: [
    {
      dedupeKey: 'banking.dead_letter_detected:abc',
      eventType: 'banking.dead_letter_detected',
      lastSentAt: '2026-02-10T11:00:00.000Z',
      suppressedCount: 12,
      updatedAt: '2026-02-10T11:05:00.000Z',
      isAboveThreshold: true
    }
  ],
  ...overrides
});

const createAuditResponse = (
  overrides?: Partial<DeadLetterAdminAuditResponse>
): DeadLetterAdminAuditResponse => ({
  success: true,
  filters: {
    status: null,
    scope: null,
    action: 'reset_dead_letter',
    adminClerkId: null,
    since: null,
    until: null,
    cursor: null,
    limit: 25
  },
  count: 1,
  summary: {
    requestedTotal: 11,
    resetTotal: 11,
    pendingCount: 0,
    completedCount: 1,
    failedCount: 0
  },
  page: {
    limit: 25,
    hasMore: false,
    nextCursor: null
  },
  rows: [
    {
      id: 'audit_1',
      adminUserId: 'user_admin_1',
      adminClerkId: 'clerk_admin_1',
      action: 'reset_dead_letter',
      scope: 'bulk',
      reason: 'Support replay',
      requestedCount: 11,
      resetCount: 11,
      maxRetryAttempts: 6,
      connectionIds: ['conn_1', 'conn_2'],
      metadata: { source: 'explicit_selection' },
      status: 'completed',
      error: null,
      createdAt: '2026-02-10T11:00:00.000Z',
      completedAt: '2026-02-10T11:01:00.000Z'
    }
  ],
  ...overrides
});

describe('BankingOpsAlertStatsCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState(window.history.state, '', '/');
    mockGetDeadLetterRows.mockResolvedValue({
      success: true,
      maxRetryAttempts: 6,
      count: 0,
      rows: []
    });
    mockGetDeadLetterAudit.mockResolvedValue(createAuditResponse());
    mockExportDeadLetterAuditCsv.mockResolvedValue('"id","createdAt"\n"audit_1","2026-02-10T11:00:00.000Z"');
  });

  it('loads and displays suppression stats', async () => {
    mockGetOpsAlertStats.mockResolvedValueOnce(createResponse());

    render(<BankingOpsAlertStatsCard />);

    expect(await screen.findByText('Ops Alert Suppression (Admin)')).toBeInTheDocument();
    expect(await screen.findByText('Total Suppressed')).toBeInTheDocument();
    expect(await screen.findByText('banking.dead_letter_detected')).toBeInTheDocument();
    expect(await screen.findByText('Above threshold')).toBeInTheDocument();
    expect(await screen.findByText(/Threshold enabled at 10/)).toBeInTheDocument();
    expect(mockGetOpsAlertStats).toHaveBeenCalledWith({
      eventType: undefined,
      minSuppressed: 1,
      limit: 10,
      onlyAboveThreshold: false
    });
  });

  it('hides card when admin endpoint returns forbidden', async () => {
    mockGetOpsAlertStats.mockRejectedValueOnce(
      Object.assign(new Error('Admin access required'), {
        status: 403,
        code: 'forbidden'
      })
    );

    render(<BankingOpsAlertStatsCard />);

    await waitFor(() => {
      expect(screen.queryByText('Ops Alert Suppression (Admin)')).not.toBeInTheDocument();
    });
  });

  it('applies filters and reloads with parsed values', async () => {
    mockGetOpsAlertStats.mockResolvedValue(createResponse());

    render(<BankingOpsAlertStatsCard />);
    await screen.findByText('Ops Alert Suppression (Admin)');

    fireEvent.change(screen.getByLabelText('Event Type'), {
      target: { value: 'banking.dead_letter_detected' }
    });
    fireEvent.change(screen.getByLabelText('Min Suppressed'), {
      target: { value: '3' }
    });
    fireEvent.change(screen.getByLabelText('Rows'), {
      target: { value: '25' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(() => {
      expect(mockGetOpsAlertStats).toHaveBeenCalledWith({
        eventType: 'banking.dead_letter_detected',
        minSuppressed: 3,
        limit: 25,
        onlyAboveThreshold: false
      });
    });
  });

  it('applies JWKS circuit preset and queries by event prefix', async () => {
    mockGetOpsAlertStats.mockResolvedValue(createResponse());

    render(<BankingOpsAlertStatsCard />);
    await screen.findByText('Ops Alert Suppression (Admin)');
    mockGetOpsAlertStats.mockClear();

    fireEvent.click(screen.getByRole('button', { name: 'JWKS Circuit View' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(() => {
      expect(mockGetOpsAlertStats).toHaveBeenCalledWith({
        eventType: undefined,
        eventTypePrefix: 'banking.truelayer.jwks_circuit_',
        minSuppressed: 0,
        limit: 10,
        onlyAboveThreshold: false
      });
    });
  });

  it('requests only above-threshold rows when toggle is enabled', async () => {
    mockGetOpsAlertStats.mockResolvedValue(createResponse());

    render(<BankingOpsAlertStatsCard />);
    await screen.findByText('Ops Alert Suppression (Admin)');

    fireEvent.click(screen.getByLabelText('Above Threshold Only'));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(() => {
      expect(mockGetOpsAlertStats).toHaveBeenCalledWith({
        eventType: undefined,
        minSuppressed: 1,
        limit: 10,
        onlyAboveThreshold: true
      });
    });
  });

  it('loads with above-threshold filter when initialized from a critical incident deep link', async () => {
    mockGetOpsAlertStats.mockResolvedValue(createResponse());

    render(<BankingOpsAlertStatsCard initialOnlyAboveThreshold />);
    await screen.findByText('Ops Alert Suppression (Admin)');

    await waitFor(() => {
      expect(mockGetOpsAlertStats).toHaveBeenCalledWith({
        eventType: undefined,
        minSuppressed: 1,
        limit: 10,
        onlyAboveThreshold: true
      });
    });

    expect(screen.getByLabelText('Above Threshold Only')).toBeChecked();
    expect(screen.getByText('Auto-refreshing every 30 seconds while this filter is enabled.')).toBeInTheDocument();
  });

  it('loads with eventTypePrefix when initialized from a JWKS deep link', async () => {
    mockGetOpsAlertStats.mockResolvedValue(createResponse());

    render(<BankingOpsAlertStatsCard initialEventTypePrefix="banking.truelayer.jwks_circuit_" />);
    await screen.findByText('Ops Alert Suppression (Admin)');

    await waitFor(() => {
      expect(mockGetOpsAlertStats).toHaveBeenCalledWith({
        eventType: undefined,
        eventTypePrefix: 'banking.truelayer.jwks_circuit_',
        minSuppressed: 1,
        limit: 10,
        onlyAboveThreshold: false
      });
    });
  });

  it('auto-refreshes while above-threshold-only filter is enabled', async () => {
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
      render(<BankingOpsAlertStatsCard />);
      await screen.findByText('Ops Alert Suppression (Admin)');
      expect(screen.queryByText('Auto-refreshing every 30 seconds while this filter is enabled.')).not.toBeInTheDocument();

      fireEvent.click(screen.getByLabelText('Above Threshold Only'));
      fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

      await waitFor(() => {
        expect(mockGetOpsAlertStats).toHaveBeenCalledWith({
          eventType: undefined,
          minSuppressed: 1,
          limit: 10,
          onlyAboveThreshold: true
        });
      });
      expect(screen.getByText('Auto-refreshing every 30 seconds while this filter is enabled.')).toBeInTheDocument();
      expect(intervalCallbacks).not.toHaveLength(0);

      mockGetOpsAlertStats.mockClear();
      intervalCallbacks.forEach((callback) => {
        callback();
      });

      await waitFor(() => {
        expect(mockGetOpsAlertStats).toHaveBeenCalledWith({
          eventType: undefined,
          minSuppressed: 1,
          limit: 10,
          onlyAboveThreshold: true
        });
      });
    } finally {
      setIntervalSpy.mockRestore();
      clearIntervalSpy.mockRestore();
    }
  });

  it('sends a test alert and refreshes stats from the header action', async () => {
    mockGetOpsAlertStats.mockResolvedValue(createResponse());
    mockTriggerOpsAlertTest.mockResolvedValue({
      success: true,
      eventType: 'banking.ops_alert_test',
      delivered: true
    });

    render(<BankingOpsAlertStatsCard />);
    await screen.findByText('Ops Alert Suppression (Admin)');
    mockGetOpsAlertStats.mockClear();

    fireEvent.click(screen.getByRole('button', { name: 'Send Test Alert' }));

    await waitFor(() => {
      expect(mockTriggerOpsAlertTest).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(mockGetOpsAlertStats).toHaveBeenCalledWith({
        eventType: undefined,
        minSuppressed: 1,
        limit: 10,
        onlyAboveThreshold: false
      });
    });
    expect(screen.getByText('Test alert sent and stats refreshed.')).toBeInTheDocument();
  });

  it('shows test alert action errors inline', async () => {
    mockGetOpsAlertStats.mockResolvedValue(createResponse());
    mockTriggerOpsAlertTest.mockRejectedValueOnce(new Error('Ops alert webhook call failed'));

    render(<BankingOpsAlertStatsCard />);
    await screen.findByText('Ops Alert Suppression (Admin)');

    fireEvent.click(screen.getByRole('button', { name: 'Send Test Alert' }));

    expect(await screen.findByText('Ops alert webhook call failed')).toBeInTheDocument();
  });

  it('requires confirmation token and reason before dead-letter reset', async () => {
    mockGetOpsAlertStats.mockResolvedValue(createResponse());

    render(<BankingOpsAlertStatsCard />);
    await screen.findByText('Ops Alert Suppression (Admin)');

    fireEvent.click(screen.getByRole('button', { name: 'Reset Dead-Letter' }));
    const confirmButton = screen.getByRole('button', { name: 'Confirm Reset' });
    expect(confirmButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Reason (required)'), {
      target: { value: 'Investigating stuck queue after incident #25' }
    });
    fireEvent.change(screen.getByLabelText('Confirm Token'), {
      target: { value: 'RESET_ALL_DEAD_LETTERED' }
    });

    expect(confirmButton).not.toBeDisabled();
  });

  it('loads dead-letter preview rows when reset panel opens', async () => {
    mockGetOpsAlertStats.mockResolvedValue(createResponse());
    mockGetDeadLetterRows.mockResolvedValueOnce({
      success: true,
      maxRetryAttempts: 6,
      count: 1,
      rows: [
        {
          connectionId: 'conn_1',
          userId: 'user_1',
          provider: 'truelayer',
          status: 'connected',
          institutionName: 'Barclays',
          queueAttempts: 7,
          queueLastError: 'dead_letter:transactions:500',
          queueNextRetryAt: null,
          updatedAt: '2026-02-10T00:00:00.000Z'
        }
      ]
    });

    render(<BankingOpsAlertStatsCard />);
    await screen.findByText('Ops Alert Suppression (Admin)');

    fireEvent.click(screen.getByRole('button', { name: 'Reset Dead-Letter' }));

    await waitFor(() => {
      expect(mockGetDeadLetterRows).toHaveBeenCalledWith(25);
    });
    expect(await screen.findByText(/Barclays \(conn_1\)/)).toBeInTheDocument();
  });

  it('resets selected dead-letter rows without reset-all confirmation token', async () => {
    mockGetOpsAlertStats.mockResolvedValue(createResponse());
    mockGetDeadLetterRows.mockResolvedValueOnce({
      success: true,
      maxRetryAttempts: 6,
      count: 2,
      rows: [
        {
          connectionId: 'conn_1',
          userId: 'user_1',
          provider: 'truelayer',
          status: 'connected',
          institutionName: 'Barclays',
          queueAttempts: 7,
          queueLastError: 'dead_letter:transactions:500',
          queueNextRetryAt: null,
          updatedAt: '2026-02-10T00:00:00.000Z'
        },
        {
          connectionId: 'conn_2',
          userId: 'user_2',
          provider: 'truelayer',
          status: 'connected',
          institutionName: 'Monzo',
          queueAttempts: 9,
          queueLastError: 'dead_letter:accounts:500',
          queueNextRetryAt: null,
          updatedAt: '2026-02-10T00:01:00.000Z'
        }
      ]
    });
    mockResetDeadLetterConnections.mockResolvedValue({
      success: true,
      maxRetryAttempts: 6,
      requested: 1,
      resetConnectionIds: ['conn_1'],
      auditId: 'audit_selected',
      auditStatus: 'completed'
    });

    render(<BankingOpsAlertStatsCard />);
    await screen.findByText('Ops Alert Suppression (Admin)');
    mockGetOpsAlertStats.mockClear();

    fireEvent.click(screen.getByRole('button', { name: 'Reset Dead-Letter' }));
    await screen.findByText(/Barclays \(conn_1\)/);

    fireEvent.change(screen.getByLabelText('Reason (required)'), {
      target: { value: 'Replay only impacted Barclays dead-letter row' }
    });
    fireEvent.click(screen.getByLabelText('Select conn_1'));
    fireEvent.click(screen.getByRole('button', { name: 'Reset Selected' }));

    await waitFor(() => {
      expect(mockResetDeadLetterConnections).toHaveBeenCalledWith(
        ['conn_1'],
        'Replay only impacted Barclays dead-letter row',
        undefined
      );
    });
    await waitFor(() => {
      expect(mockGetOpsAlertStats).toHaveBeenCalledWith({
        eventType: undefined,
        minSuppressed: 1,
        limit: 10,
        onlyAboveThreshold: false
      });
    });
    expect(screen.getByText('Reset 1 selected dead-letter connection(s). Audit audit_selected is completed.')).toBeInTheDocument();
  });

  it('requires second confirmation token when resetting more than 10 selected rows', async () => {
    mockGetOpsAlertStats.mockResolvedValue(createResponse());
    mockGetDeadLetterRows.mockResolvedValueOnce({
      success: true,
      maxRetryAttempts: 6,
      count: 11,
      rows: Array.from({ length: 11 }, (_value, index) => ({
        connectionId: `conn_${index + 1}`,
        userId: `user_${index + 1}`,
        provider: 'truelayer',
        status: 'connected',
        institutionName: `Bank ${index + 1}`,
        queueAttempts: 7 + index,
        queueLastError: 'dead_letter:transactions:500',
        queueNextRetryAt: null,
        updatedAt: '2026-02-10T00:00:00.000Z'
      }))
    });

    render(<BankingOpsAlertStatsCard />);
    await screen.findByText('Ops Alert Suppression (Admin)');

    fireEvent.click(screen.getByRole('button', { name: 'Reset Dead-Letter' }));
    await screen.findByText(/Bank 1 \(conn_1\)/);

    fireEvent.change(screen.getByLabelText('Reason (required)'), {
      target: { value: 'Replay full dead-letter cohort after fix validation' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Select All' }));

    const resetSelectedButton = screen.getByRole('button', { name: 'Reset Selected' });
    expect(resetSelectedButton).toBeDisabled();

    fireEvent.change(screen.getByLabelText('Bulk Confirm Token'), {
      target: { value: 'RESET_SELECTED_BULK' }
    });

    expect(resetSelectedButton).not.toBeDisabled();
  });

  it('passes bulk confirmation token when resetting more than 10 selected rows', async () => {
    mockGetOpsAlertStats.mockResolvedValue(createResponse());
    mockGetDeadLetterRows.mockResolvedValueOnce({
      success: true,
      maxRetryAttempts: 6,
      count: 11,
      rows: Array.from({ length: 11 }, (_value, index) => ({
        connectionId: `conn_${index + 1}`,
        userId: `user_${index + 1}`,
        provider: 'truelayer',
        status: 'connected',
        institutionName: `Bank ${index + 1}`,
        queueAttempts: 7 + index,
        queueLastError: 'dead_letter:transactions:500',
        queueNextRetryAt: null,
        updatedAt: '2026-02-10T00:00:00.000Z'
      }))
    });
    mockResetDeadLetterConnections.mockResolvedValue({
      success: true,
      maxRetryAttempts: 6,
      requested: 11,
      resetConnectionIds: Array.from({ length: 11 }, (_value, index) => `conn_${index + 1}`),
      auditId: 'audit_bulk',
      auditStatus: 'completed'
    });

    render(<BankingOpsAlertStatsCard />);
    await screen.findByText('Ops Alert Suppression (Admin)');

    fireEvent.click(screen.getByRole('button', { name: 'Reset Dead-Letter' }));
    await screen.findByText(/Bank 1 \(conn_1\)/);

    fireEvent.change(screen.getByLabelText('Reason (required)'), {
      target: { value: 'Bulk replay for full incident cohort' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Select All' }));
    fireEvent.change(screen.getByLabelText('Bulk Confirm Token'), {
      target: { value: 'RESET_SELECTED_BULK' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Reset Selected' }));

    await waitFor(() => {
      expect(mockResetDeadLetterConnections).toHaveBeenCalledWith(
        Array.from({ length: 11 }, (_value, index) => `conn_${index + 1}`),
        'Bulk replay for full incident cohort',
        'RESET_SELECTED_BULK'
      );
    });
  });

  it('resets dead-letter rows and shows audit outcome', async () => {
    mockGetOpsAlertStats.mockResolvedValue(createResponse());
    mockResetAllDeadLettered.mockResolvedValue({
      success: true,
      maxRetryAttempts: 6,
      requested: 2,
      resetConnectionIds: ['conn_1', 'conn_2'],
      auditId: 'audit_123',
      auditStatus: 'completed'
    });

    render(<BankingOpsAlertStatsCard />);
    await screen.findByText('Ops Alert Suppression (Admin)');
    mockGetOpsAlertStats.mockClear();

    fireEvent.click(screen.getByRole('button', { name: 'Reset Dead-Letter' }));
    fireEvent.change(screen.getByLabelText('Reason (required)'), {
      target: { value: 'Incident-145 queue replay after fix deployment' }
    });
    fireEvent.change(screen.getByLabelText('Confirm Token'), {
      target: { value: 'RESET_ALL_DEAD_LETTERED' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Confirm Reset' }));

    await waitFor(() => {
      expect(mockResetAllDeadLettered).toHaveBeenCalledWith(
        'RESET_ALL_DEAD_LETTERED',
        'Incident-145 queue replay after fix deployment',
        200
      );
    });
    await waitFor(() => {
      expect(mockGetOpsAlertStats).toHaveBeenCalledWith({
        eventType: undefined,
        minSuppressed: 1,
        limit: 10,
        onlyAboveThreshold: false
      });
    });
    expect(screen.getByText('Reset 2 dead-letter connection(s). Audit audit_123 is completed.')).toBeInTheDocument();
  });

  it('loads and displays dead-letter audit rows when audit panel opens', async () => {
    mockGetOpsAlertStats.mockResolvedValue(createResponse());
    mockGetDeadLetterAudit.mockResolvedValueOnce(createAuditResponse());

    render(<BankingOpsAlertStatsCard />);
    await screen.findByText('Ops Alert Suppression (Admin)');

    fireEvent.click(screen.getByRole('button', { name: 'Audit Log' }));

    await waitFor(() => {
      expect(mockGetDeadLetterAudit).toHaveBeenCalledWith({
        status: undefined,
        scope: undefined,
        action: 'reset_dead_letter',
        limit: 25
      });
    });

    expect(await screen.findByText('Dead-Letter Reset Audit')).toBeInTheDocument();
    expect(await screen.findByText('Requested Total')).toBeInTheDocument();
    expect(await screen.findByText('Support replay')).toBeInTheDocument();
  });

  it('deep-links directly into failed dead-letter audit view', async () => {
    mockGetOpsAlertStats.mockResolvedValue(createResponse());
    mockGetDeadLetterAudit.mockResolvedValueOnce(
      createAuditResponse({
        filters: {
          status: 'failed',
          scope: null,
          action: 'reset_dead_letter',
          adminClerkId: null,
          since: null,
          until: null,
          cursor: null,
          limit: 25
        },
        summary: {
          requestedTotal: 1,
          resetTotal: 0,
          pendingCount: 0,
          completedCount: 0,
          failedCount: 1
        },
        rows: [
          {
            id: 'audit_failed_1',
            adminUserId: 'user_admin_1',
            adminClerkId: 'clerk_admin_1',
            action: 'reset_dead_letter',
            scope: 'single',
            reason: 'Replay failed due provider outage',
            requestedCount: 1,
            resetCount: 0,
            maxRetryAttempts: 6,
            connectionIds: ['conn_failed_1'],
            metadata: {},
            status: 'failed',
            error: 'provider unavailable',
            createdAt: '2026-02-10T09:00:00.000Z',
            completedAt: '2026-02-10T09:00:30.000Z'
          }
        ]
      })
    );

    render(<BankingOpsAlertStatsCard initialShowAuditPanel initialAuditStatus="failed" />);
    await screen.findByText('Ops Alert Suppression (Admin)');

    await waitFor(() => {
      expect(mockGetDeadLetterAudit).toHaveBeenCalledWith({
        status: 'failed',
        scope: undefined,
        action: 'reset_dead_letter',
        limit: 25
      });
    });

    expect(await screen.findByText('Dead-Letter Reset Audit')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByLabelText('Audit Status')).toHaveValue('failed');
    });
    expect(await screen.findByText('Replay failed due provider outage')).toBeInTheDocument();
  });

  it('loads more dead-letter audit rows using cursor pagination', async () => {
    mockGetOpsAlertStats.mockResolvedValue(createResponse());
    mockGetDeadLetterAudit
      .mockResolvedValueOnce(
        createAuditResponse({
          page: {
            limit: 25,
            hasMore: true,
            nextCursor: 'cursor-next'
          }
        })
      )
      .mockResolvedValueOnce(
        createAuditResponse({
          count: 1,
          page: {
            limit: 25,
            hasMore: false,
            nextCursor: null
          },
          rows: [
            {
              id: 'audit_2',
              adminUserId: 'user_admin_1',
              adminClerkId: 'clerk_admin_1',
              action: 'reset_dead_letter',
              scope: 'single',
              reason: 'Second page row',
              requestedCount: 1,
              resetCount: 1,
              maxRetryAttempts: 6,
              connectionIds: ['conn_3'],
              metadata: {},
              status: 'completed',
              error: null,
              createdAt: '2026-02-10T10:00:00.000Z',
              completedAt: '2026-02-10T10:00:01.000Z'
            }
          ]
        })
      );

    render(<BankingOpsAlertStatsCard />);
    await screen.findByText('Ops Alert Suppression (Admin)');

    fireEvent.click(screen.getByRole('button', { name: 'Audit Log' }));
    await screen.findByRole('button', { name: 'Load More Audit Rows' });

    fireEvent.click(screen.getByRole('button', { name: 'Load More Audit Rows' }));

    await waitFor(() => {
      expect(mockGetDeadLetterAudit).toHaveBeenLastCalledWith({
        status: undefined,
        scope: undefined,
        action: 'reset_dead_letter',
        limit: 25,
        cursor: 'cursor-next'
      });
    });
    expect(await screen.findByText('Second page row')).toBeInTheDocument();
  });

  it('applies date range presets to audit filters and csv export', async () => {
    mockGetOpsAlertStats.mockResolvedValue(createResponse());
    mockGetDeadLetterAudit.mockResolvedValue(createAuditResponse());

    render(<BankingOpsAlertStatsCard />);
    await screen.findByText('Ops Alert Suppression (Admin)');

    fireEvent.click(screen.getByRole('button', { name: 'Audit Log' }));
    await screen.findByText('Dead-Letter Reset Audit');

    fireEvent.change(screen.getByLabelText('Date Range'), {
      target: { value: '7d' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Apply Audit Filters' }));

    await waitFor(() => {
      expect(mockGetDeadLetterAudit).toHaveBeenCalledTimes(2);
    });

    const latestAuditQuery = mockGetDeadLetterAudit.mock.calls[mockGetDeadLetterAudit.mock.calls.length - 1]?.[0] as
      | {
        action?: string;
        limit?: number;
        since?: string;
        until?: string;
      }
      | undefined;
    expect(latestAuditQuery?.action).toBe('reset_dead_letter');
    expect(latestAuditQuery?.limit).toBe(25);
    expect(typeof latestAuditQuery?.since).toBe('string');
    expect(typeof latestAuditQuery?.until).toBe('string');

    const sinceTimestamp = Date.parse(latestAuditQuery?.since ?? '');
    const untilTimestamp = Date.parse(latestAuditQuery?.until ?? '');
    const rangeDurationMs = untilTimestamp - sinceTimestamp;
    expect(Number.isNaN(sinceTimestamp)).toBe(false);
    expect(Number.isNaN(untilTimestamp)).toBe(false);
    expect(rangeDurationMs).toBeGreaterThanOrEqual((7 * 24 * 60 * 60 * 1000) - 5000);
    expect(rangeDurationMs).toBeLessThanOrEqual((7 * 24 * 60 * 60 * 1000) + 5000);

    fireEvent.click(screen.getByRole('button', { name: 'Export Audit CSV' }));

    await waitFor(() => {
      expect(mockExportDeadLetterAuditCsv).toHaveBeenCalledTimes(1);
    });
    const latestExportQuery = mockExportDeadLetterAuditCsv.mock.calls[
      mockExportDeadLetterAuditCsv.mock.calls.length - 1
    ]?.[0] as
      | {
        action?: string;
        limit?: number;
        since?: string;
        until?: string;
      }
      | undefined;
    expect(latestExportQuery?.action).toBe('reset_dead_letter');
    expect(latestExportQuery?.limit).toBe(1000);
    expect(typeof latestExportQuery?.since).toBe('string');
    expect(typeof latestExportQuery?.until).toBe('string');
  });

  it('persists audit panel filters into URL query params for shareable links', async () => {
    mockGetOpsAlertStats.mockResolvedValue(createResponse());
    mockGetDeadLetterAudit.mockResolvedValue(createAuditResponse());

    render(<BankingOpsAlertStatsCard />);
    await screen.findByText('Ops Alert Suppression (Admin)');

    fireEvent.click(screen.getByRole('button', { name: 'Audit Log' }));
    await screen.findByText('Dead-Letter Reset Audit');

    await waitFor(() => {
      const params = new URLSearchParams(window.location.search);
      expect(params.get('bankingAuditOpen')).toBe('1');
    });

    fireEvent.change(screen.getByLabelText('Audit Status'), {
      target: { value: 'failed' }
    });
    fireEvent.change(screen.getByLabelText('Audit Scope'), {
      target: { value: 'bulk' }
    });
    fireEvent.change(screen.getByLabelText('Date Range'), {
      target: { value: '24h' }
    });

    await waitFor(() => {
      const params = new URLSearchParams(window.location.search);
      expect(params.get('bankingAuditOpen')).toBe('1');
      expect(params.get('bankingAuditStatus')).toBe('failed');
      expect(params.get('bankingAuditScope')).toBe('bulk');
      expect(params.get('bankingAuditRange')).toBe('24h');
    });

    fireEvent.click(screen.getByRole('button', { name: 'Audit Log' }));

    await waitFor(() => {
      const params = new URLSearchParams(window.location.search);
      expect(params.get('bankingAuditOpen')).toBeNull();
      expect(params.get('bankingAuditStatus')).toBeNull();
      expect(params.get('bankingAuditScope')).toBeNull();
      expect(params.get('bankingAuditRange')).toBeNull();
    });
  });

  it('copies an incident link with current audit filter query params', async () => {
    mockGetOpsAlertStats.mockResolvedValue(createResponse());
    mockGetDeadLetterAudit.mockResolvedValue(createAuditResponse());
    const writeTextMock = vi.fn().mockResolvedValue(undefined);
    const originalClipboard = navigator.clipboard;
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: writeTextMock
      }
    });

    try {
      window.history.replaceState(window.history.state, '', '/settings/data?demo=true');

      render(<BankingOpsAlertStatsCard />);
      await screen.findByText('Ops Alert Suppression (Admin)');

      fireEvent.click(screen.getByRole('button', { name: 'Audit Log' }));
      await screen.findByText('Dead-Letter Reset Audit');

      fireEvent.change(screen.getByLabelText('Audit Status'), {
        target: { value: 'failed' }
      });
      fireEvent.change(screen.getByLabelText('Audit Scope'), {
        target: { value: 'bulk' }
      });
      fireEvent.change(screen.getByLabelText('Date Range'), {
        target: { value: '24h' }
      });

      fireEvent.click(screen.getByRole('button', { name: 'Copy Incident Link' }));

      await waitFor(() => {
        expect(writeTextMock).toHaveBeenCalledTimes(1);
      });
      const copiedLink = writeTextMock.mock.calls[0]?.[0] as string;
      const copiedUrl = new URL(copiedLink);
      const copiedParams = copiedUrl.searchParams;

      expect(copiedUrl.pathname).toBe('/settings/data');
      expect(copiedParams.get('demo')).toBe('true');
      expect(copiedParams.get('bankingAuditOpen')).toBe('1');
      expect(copiedParams.get('bankingAuditStatus')).toBe('failed');
      expect(copiedParams.get('bankingAuditScope')).toBe('bulk');
      expect(copiedParams.get('bankingAuditRange')).toBe('24h');
      expect(await screen.findByText('Incident link copied to clipboard.')).toBeInTheDocument();
    } finally {
      Object.defineProperty(navigator, 'clipboard', {
        configurable: true,
        value: originalClipboard
      });
    }
  });

  it('exports dead-letter audit rows as csv', async () => {
    mockGetOpsAlertStats.mockResolvedValue(createResponse());
    mockGetDeadLetterAudit.mockResolvedValueOnce(createAuditResponse());
    const originalCreateObjectUrl = URL.createObjectURL;
    const originalRevokeObjectUrl = URL.revokeObjectURL;
    const createObjectUrlMock = vi.fn(() => 'blob://audit');
    const revokeObjectUrlMock = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: createObjectUrlMock
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: revokeObjectUrlMock
    });
    const anchorClickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    try {
      render(<BankingOpsAlertStatsCard />);
      await screen.findByText('Ops Alert Suppression (Admin)');
      fireEvent.click(screen.getByRole('button', { name: 'Audit Log' }));
      await screen.findByText('Dead-Letter Reset Audit');

      fireEvent.click(screen.getByRole('button', { name: 'Export Audit CSV' }));

      await waitFor(() => {
        expect(mockExportDeadLetterAuditCsv).toHaveBeenCalledWith({
          status: undefined,
          scope: undefined,
          action: 'reset_dead_letter',
          limit: 1000
        });
      });
      expect(createObjectUrlMock).toHaveBeenCalledTimes(1);
      expect(revokeObjectUrlMock).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(URL, 'createObjectURL', {
        configurable: true,
        writable: true,
        value: originalCreateObjectUrl
      });
      Object.defineProperty(URL, 'revokeObjectURL', {
        configurable: true,
        writable: true,
        value: originalRevokeObjectUrl
      });
      anchorClickSpy.mockRestore();
    }
  });
});
