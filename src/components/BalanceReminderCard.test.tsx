/**
 * The reminder card, through the UI: appears only when the schedule says so,
 * and each of its three answers does exactly what its word says. The
 * arithmetic itself is pinned in utils/balanceReminders.test.ts — what is
 * pinned here is the wiring and the honesty of the buttons.
 *
 * Every date is invented; this repo is public.
 */

import React from 'react';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import BalanceReminderCard from './BalanceReminderCard';
import { preferences } from '../services/preferencesService';
import {
  loadReminderState,
  saveReminderPrefs,
  saveReminderState,
  DEFAULT_REMINDER_PREFS,
} from '../utils/balanceReminders';

const renderCard = (): void => {
  render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route path="/dashboard" element={<BalanceReminderCard />} />
        <Route path="/accounts" element={<div>Accounts page</div>} />
      </Routes>
    </MemoryRouter>
  );
};

/** A daily midnight schedule whose moment has passed, unacknowledged. */
const makeDue = (): void => {
  saveReminderPrefs({ ...DEFAULT_REMINDER_PREFS, schedule: 'daily', time: '00:00' }, new Date());
  saveReminderState({ lastAcknowledged: new Date(2020, 0, 1), snoozedUntil: null });
};

beforeEach(() => {
  preferences.removeItem('balanceReminders.prefs.v1');
  preferences.removeItem('balanceReminders.state.v1');
});

afterEach(cleanup);

describe('BalanceReminderCard', () => {
  it('renders nothing at all while the schedule is off', () => {
    renderCard();
    expect(screen.queryByRole('status', { name: 'Balance reminder' })).toBeNull();
  });

  it('appears when a scheduled moment has passed unacknowledged', () => {
    makeDue();
    renderCard();
    expect(screen.getByRole('status', { name: 'Balance reminder' })).toBeInTheDocument();
    expect(screen.getByText('Time to update your account balances')).toBeInTheDocument();
  });

  it('Done settles the job — gone now, and acknowledged for every device', () => {
    makeDue();
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));

    expect(screen.queryByRole('status', { name: 'Balance reminder' })).toBeNull();
    const state = loadReminderState();
    expect(state.lastAcknowledged).not.toBeNull();
    expect(state.snoozedUntil).toBeNull();
  });

  it('Tomorrow means literally tomorrow at the scheduled time', () => {
    makeDue();
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Tomorrow' }));

    expect(screen.queryByRole('status', { name: 'Balance reminder' })).toBeNull();
    const snoozed = loadReminderState().snoozedUntil;
    expect(snoozed).not.toBeNull();
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    expect(snoozed?.getDate()).toBe(tomorrow.getDate());
    expect(snoozed?.getHours()).toBe(0);
    expect(snoozed?.getMinutes()).toBe(0);
  });

  it('Update balances goes to Accounts and takes the job as being done there', () => {
    makeDue();
    renderCard();
    fireEvent.click(screen.getByRole('button', { name: 'Update balances' }));

    expect(screen.getByText('Accounts page')).toBeInTheDocument();
    expect(loadReminderState().lastAcknowledged).not.toBeNull();
  });
});
