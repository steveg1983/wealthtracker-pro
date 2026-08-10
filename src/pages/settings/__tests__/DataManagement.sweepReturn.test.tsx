/**
 * Coming back to Data Management from the register, with the duplicate sweep's
 * crumbs in hand.
 *
 * This is the far end of the round trip: the sweep sends the user out to look
 * at a row, the register offers "Back to Find duplicates", and the way back
 * lands here carrying what the dialog needs to reopen where it was. The page's
 * only job is to recognise the crumbs, open the dialog with them, and then
 * clear them off the history entry so a refresh is an ordinary visit.
 */
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { ToastProvider } from '../../../contexts/ToastContext';
import { __resetAppContextValue } from '../../../test/mocks/AppContextSupabase';

/** The dialog itself is covered in its own suite; here it is a receipt. */
vi.mock('../../../components/DuplicateSweepModal', () => ({
  default: ({ isOpen, resume }: { isOpen: boolean; resume?: unknown }) =>
    isOpen ? <div data-testid="sweep">{JSON.stringify(resume)}</div> : null,
}));

const { default: DataManagementSettings } = await import('../DataManagement');

const CRUMBS = {
  tool: 'find-duplicates',
  windowDays: 7,
  accountFilter: 'acc-1',
  sortKey: 'amount',
  sortDir: 1,
  pairKey: 'a|b',
  reviewing: true,
};

const renderPage = (state?: unknown) =>
  render(
    <MemoryRouter initialEntries={[{ pathname: '/settings/data', state }]}>
      <ToastProvider>
        <DataManagementSettings />
      </ToastProvider>
    </MemoryRouter>
  );

beforeEach(() => {
  localStorage.clear();
});

afterEach(() => {
  __resetAppContextValue();
});

describe('returning from the register to Find duplicates', () => {
  it('reopens the sweep where the user left it', async () => {
    renderPage({ resume: CRUMBS });

    await waitFor(() => expect(screen.getByTestId('sweep')).toBeInTheDocument());
    expect(JSON.parse(screen.getByTestId('sweep').textContent || 'null')).toEqual(CRUMBS);
  });

  it('opens nothing on an ordinary visit to the page', () => {
    renderPage();

    expect(screen.queryByTestId('sweep')).not.toBeInTheDocument();
  });

  it('opens nothing for crumbs belonging to some other tool', () => {
    renderPage({ resume: { ...CRUMBS, tool: 'match-transfers' } });

    expect(screen.queryByTestId('sweep')).not.toBeInTheDocument();
  });
});
