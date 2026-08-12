/**
 * THE AUDIT TRAIL'S TWO KINDS OF NOTHING (DESIGN_PASS §4).
 *
 * An audit trail that looks empty is a worse lie than a register that does:
 * the entire value of one is that it is COMPLETE, so a filter that hides every
 * entry must say it is a filter doing it. "Try adjusting your filters to see
 * more results" — the sentence that used to be here — states neither how much
 * is being held back nor which filter is holding it, and reads identically to
 * a trail that has been wiped.
 *
 * Every user id, action and resource below is invented: this repo is public.
 */

import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PreferencesProvider } from '../../contexts/PreferencesContext';
import { securityService, type AuditLog } from '../../services/securityService';
import AuditLogs from './AuditLogs';

const LOGS: AuditLog[] = [
  {
    id: 'log-1', timestamp: new Date('2026-05-01T09:00:00Z'), userId: 'user_testonly_0001',
    action: 'create', resourceType: 'transaction', resourceId: 'txn-quenchless',
  },
  {
    id: 'log-2', timestamp: new Date('2026-05-02T09:00:00Z'), userId: 'user_testonly_0001',
    action: 'update', resourceType: 'account', resourceId: 'acc-halberd',
  },
];

const renderAuditLogs = (logs: AuditLog[]): void => {
  vi.spyOn(securityService, 'getAuditLogs').mockReturnValue(logs);
  render(
    <MemoryRouter initialEntries={['/settings/audit-logs']}>
      <PreferencesProvider>
        <AuditLogs />
      </PreferencesProvider>
    </MemoryRouter>
  );
};

const searchFor = (term: string): void => {
  fireEvent.change(screen.getByPlaceholderText(/Search/i), { target: { value: term } });
};

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('an audit trail with nothing in it', () => {
  it('says what is absent and what will fill it, without inventing a control', () => {
    renderAuditLogs([]);

    expect(
      screen.getByRole('heading', { level: 3, name: 'No activity has been logged yet' })
    ).toBeInTheDocument();
    // The consequence: what a trail with nothing in it means.
    expect(screen.getByText(/Until something is changed there is nothing to audit/)).toBeInTheDocument();
    // NO REMEDY BUTTON, deliberately. The trail is written by the app as the
    // user works; a control here would be a button that fabricates an audit
    // entry, which is the one thing an audit trail must never offer.
    expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
  });
});

describe('an audit trail emptied by a filter is not an empty audit trail', () => {
  it('names how many entries are hidden and which filter is hiding them', () => {
    renderAuditLogs(LOGS);

    searchFor('quenchless ironmongery');

    expect(
      screen.getByRole('heading', { level: 3, name: 'No activity matches these filters' })
    ).toBeInTheDocument();
    // THE COUNT IS THE POINT: the trail is intact, this filter is over it.
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText(/logged activities are hidden by/)).toBeInTheDocument();
    expect(screen.getByText('Search: quenchless ironmongery')).toBeInTheDocument();
  });

  it('is distinguishable from the empty trail by every word that matters', () => {
    renderAuditLogs(LOGS);

    searchFor('quenchless ironmongery');

    expect(
      screen.queryByRole('heading', { name: 'No activity has been logged yet' })
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/Until something is changed there is nothing to audit/)).not.toBeInTheDocument();
  });

  it('offers one control that gives them back, and it gives them back', () => {
    renderAuditLogs(LOGS);

    searchFor('quenchless ironmongery');
    fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(screen.queryByRole('heading', { name: 'No activity matches these filters' })).not.toBeInTheDocument();
    expect(screen.getByText(/Showing 2 of 2 logs/)).toBeInTheDocument();
  });
});
