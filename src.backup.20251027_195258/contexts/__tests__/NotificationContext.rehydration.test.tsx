import React from 'react';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { NotificationProvider, useNotifications } from '../NotificationContext';
import type { ConflictAnalysis } from '../../types/sync-types';
import { analyticsEngine } from '../../services/analyticsEngine';

const showToast = vi.fn(() => 'toast-1');
const dismissToast = vi.fn();

vi.mock('../ToastContext', () => ({
  useToast: () => ({
    showToast,
    showSuccess: vi.fn(),
    showError: vi.fn(),
    showWarning: vi.fn(),
    showInfo: vi.fn(),
    dismissToast,
  }),
}));

const TestComponent = () => {
  const { notifications } = useNotifications();
  return <div data-testid="status" data-notifications={notifications.length}>ready</div>;
};

describe('NotificationProvider conflict rehydration', () => {
  let trackSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    cleanup();
    showToast.mockClear();
    dismissToast.mockClear();
    localStorage.clear();
    trackSpy = vi.spyOn(analyticsEngine, 'track').mockImplementation(() => undefined);

    const analysis: ConflictAnalysis<'account'> = {
      hasConflict: true,
      conflictingFields: ['name'],
      nonConflictingFields: [],
      canAutoResolve: false,
      suggestedResolution: 'manual',
      confidence: 0.5,
    };

    localStorage.setItem(
      'auto_sync_conflicts',
      JSON.stringify({
        'conflict-1': {
          conflict: {
            id: 'conflict-1',
            entity: 'account',
          },
          analysis,
          updatedAt: new Date().toISOString(),
        },
      }),
    );
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    trackSpy.mockRestore();
  });

  it('rehydrates stored conflicts into the toast system on mount', () => {
    const { getByTestId } = render(
      <NotificationProvider>
        <TestComponent />
      </NotificationProvider>,
    );

    expect(showToast).toHaveBeenCalledTimes(1);
    expect(showToast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining('Sync conflict detected'),
        action: expect.objectContaining({
          label: 'View details',
        }),
        duration: 0,
      }),
    );

    expect(getByTestId('status').dataset.notifications).toBe('0');
  });

  it('dismisses hydrated conflict toasts on conflict-resolved events', () => {
    const { getByTestId } = render(
      <NotificationProvider>
        <TestComponent />
      </NotificationProvider>,
    );

    window.dispatchEvent(new CustomEvent('conflict-resolved', { detail: { id: 'conflict-1', resolution: 'merge' } }));
    expect(dismissToast).toHaveBeenCalledWith('toast-1');
    expect(trackSpy).toHaveBeenCalledWith(
      'conflict_resolved_manual',
      expect.objectContaining({
        conflictId: 'conflict-1',
        entity: 'account',
        resolution: 'merge',
      }),
    );

    expect(getByTestId('status').dataset.notifications).toBe('0');
  });
});
