/**
 * TWO SWITCHES, NOT A CHOICE — the owner's report, turned into assertions.
 *
 * In his words: "I cannot sort the reconciliation page by account type AND
 * Institution, its one or the other, unlike in Accounts where you can set them
 * both to 'ON'." This page held a hand-rolled `'type' | 'institution'` state
 * behind two buttons that looked exactly like the Accounts page's independent
 * pair — the same words, the same pill, different behaviour, which is the one
 * thing P7 (one control set) forbids outright.
 *
 * The fix was to delete the local rule and let `utils/accountGrouping` decide,
 * as it already does for Accounts. So the tests below walk all four
 * combinations, and the last of them pins the thing that makes the two pages
 * genuinely one control: they must not share a stored preference.
 *
 * Every name and figure here is invented; this repo is public.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { PreferencesProvider } from '../../contexts/PreferencesContext';
import { ToastProvider } from '../../contexts/ToastContext';
import { NotificationProvider } from '../../contexts/NotificationContext';
import Reconciliation from '../Reconciliation';
import { preferences } from '../../services/preferencesService';
import {
  RECONCILIATION_GROUPING_STORAGE_KEY,
  LEGACY_RECONCILIATION_GROUPING_STORAGE_KEY,
} from '../../components/reconciliation/reconciliationGrouping';
import { ACCOUNT_GROUPING_STORAGE_KEY } from '../../utils/accountGrouping';
import { __setAppContextValue, __resetAppContextValue } from '../../test/mocks/AppContextSupabase';
import type { Account } from '../../types';

const account = (
  id: string,
  name: string,
  type: Account['type'],
  institution?: string
): Account => ({
  id,
  name,
  type,
  balance: 0,
  currency: 'GBP',
  ...(institution === undefined ? {} : { institution }),
  lastUpdated: new Date('2026-08-01'),
  openingBalance: 0,
  isActive: true,
});

/**
 * Four accounts across two types and two institutions, plus one with no
 * institution at all — because "no institution" is a band of its own in the
 * shared module, and a nesting that quietly dropped those accounts would be
 * the bug this page had before (a type with no section rendered nowhere).
 */
const ACCOUNTS: Account[] = [
  account('a1', 'Everyday Invented', 'current', 'Invented Bank'),
  account('a2', 'Second Everyday', 'current', 'Rival Invented Bank'),
  account('a3', 'Rainy Day Invented', 'savings', 'Invented Bank'),
  account('a4', 'Unfiled Invented', 'savings'),
];

const renderList = () =>
  render(
    <MemoryRouter initialEntries={['/reconciliation']}>
      <PreferencesProvider>
        <ToastProvider>
          {/* The page mounts EditTransactionModal, which reads the
              notification context even while closed. */}
          <NotificationProvider>
            <Reconciliation />
          </NotificationProvider>
        </ToastProvider>
      </PreferencesProvider>
    </MemoryRouter>
  );

const switchFor = (name: 'Account Type' | 'Institution'): HTMLElement =>
  screen.getByRole('button', { name });

const isOn = (name: 'Account Type' | 'Institution'): boolean =>
  switchFor(name).getAttribute('aria-pressed') === 'true';

/** The section headings, top to bottom. */
const sections = (): string[] =>
  screen.queryAllByRole('heading', { level: 2 }).map(h => h.textContent ?? '');

/** The institution sub-bands, top to bottom, by the label they announce. */
const subBands = (): string[] =>
  screen.queryAllByRole('group').map(g => g.getAttribute('aria-label') ?? '');

beforeEach(() => {
  localStorage.clear();
  __setAppContextValue({ accounts: ACCOUNTS, transactions: [], isLoading: false });
});

afterEach(() => {
  __resetAppContextValue();
});

describe('Reconciliation — grouping is two independent switches', () => {
  it('HEADLINE: both can be ON at once, and the list nests', () => {
    renderList();

    // Account Type is the default, as it always was.
    expect(isOn('Account Type')).toBe(true);
    expect(isOn('Institution')).toBe(false);

    // The owner's move: turn Institution on as well.
    fireEvent.click(switchFor('Institution'));

    // Neither switch turned the other off. This is the whole bug.
    expect(isOn('Account Type')).toBe(true);
    expect(isOn('Institution')).toBe(true);

    // And the list nests, exactly as the Accounts page nests: type sections
    // outside, institution sub-bands within, unfiled last inside its section.
    expect(sections()).toEqual(['Current Accounts(2 accounts)', 'Savings Accounts(2 accounts)']);
    expect(subBands()).toEqual([
      'Invented Bank, 1 account',
      'Rival Invented Bank, 1 account',
      'Invented Bank, 1 account',
      'No institution recorded, 1 account',
    ]);

    // The rows really are inside their sub-bands, not siblings of them.
    const [firstBand] = screen.getAllByRole('group');
    expect(within(firstBand).getByRole('button', { name: /Everyday Invented/ })).toBeInTheDocument();
  });

  it('bands by type alone when only Account Type is on', () => {
    renderList();

    expect(sections()).toEqual(['Current Accounts(2 accounts)', 'Savings Accounts(2 accounts)']);
    // No sub-bands: one switch, one level.
    expect(subBands()).toEqual([]);
  });

  it('bands by institution alone when only Institution is on', () => {
    renderList();
    fireEvent.click(switchFor('Institution'));
    fireEvent.click(switchFor('Account Type'));

    expect(isOn('Account Type')).toBe(false);
    expect(isOn('Institution')).toBe(true);

    // Alphabetical, with the accounts that name no institution last — the
    // shared module's rule, so the two pages order them identically.
    expect(sections()).toEqual([
      'Invented Bank(2 accounts)',
      'Rival Invented Bank(1 account)',
      'No institution recorded(1 account)',
    ]);
    expect(subBands()).toEqual([]);
  });

  it('draws one flat list when NEITHER switch is on', () => {
    renderList();
    fireEvent.click(switchFor('Account Type'));

    expect(isOn('Account Type')).toBe(false);
    expect(isOn('Institution')).toBe(false);

    // What accountGrouping's `flat` mode means, and what the Accounts page
    // does with the same pair of switches off: no headings, no counts, no
    // bands — just the accounts.
    expect(sections()).toEqual([]);
    expect(subBands()).toEqual([]);
    ACCOUNTS.forEach(a => {
      expect(screen.getByRole('button', { name: new RegExp(a.name) })).toBeInTheDocument();
    });
  });

  it('keeps the filter and the sort working across the nested list', () => {
    renderList();
    fireEvent.click(switchFor('Institution'));
    fireEvent.click(screen.getByRole('button', { name: 'Name A–Z' }));

    // Sorting applies to the INNERMOST list — the rows a user reads down — so
    // the bands are unchanged and the rows inside each are alphabetical.
    expect(sections()).toEqual(['Current Accounts(2 accounts)', 'Savings Accounts(2 accounts)']);

    // "Needs attention only" drops ROWS. No account here has a bank balance or
    // an unreconciled transaction, so everything is done and the list empties
    // rather than showing empty bands.
    //
    // And what it draws then is the FILTERED-empty state, not the empty one:
    // the four accounts are still there, behind a switch, and the page says so
    // and offers the way back.
    fireEvent.click(screen.getByRole('button', { name: /Needs attention only/ }));
    expect(screen.getByText('Nothing needs attention right now')).toBeInTheDocument();
    expect(document.body.textContent).toContain('4 accounts are hidden by');
    expect(screen.queryByText('No accounts to reconcile')).not.toBeInTheDocument();
    expect(sections()).toEqual([]);

    // The way back works, and puts every account on screen again.
    fireEvent.click(screen.getByRole('button', { name: 'Show all accounts' }));
    expect(sections()).toEqual(['Current Accounts(2 accounts)', 'Savings Accounts(2 accounts)']);
  });
});

/**
 * THE CONTROL SAYS WHICH KIND IT IS.
 *
 * Both-on is a real, wanted state — but next to Sort's segmented single-choice,
 * two navy-filled pills read as a radio group with a bug, which is exactly how
 * a design pass filed it. The behaviour was right and the affordance was not,
 * so the tick is what changes: "this one too", rather than "this one instead".
 */
describe('Reconciliation — Group by looks like a multi-select', () => {
  const tickIn = (name: 'Account Type' | 'Institution'): Element | null =>
    switchFor(name).querySelector('svg');

  it('ticks the switches that are on, and only those', () => {
    renderList();

    // Account Type is the default-on switch; Institution starts off.
    expect(tickIn('Account Type')).not.toBeNull();
    expect(tickIn('Institution')).toBeNull();

    fireEvent.click(switchFor('Institution'));
    expect(tickIn('Account Type')).not.toBeNull();
    expect(tickIn('Institution')).not.toBeNull();

    fireEvent.click(switchFor('Account Type'));
    expect(tickIn('Account Type')).toBeNull();
    expect(tickIn('Institution')).not.toBeNull();
  });

  it('leaves Sort — a single choice — without ticks', () => {
    renderList();

    // The distinction is the whole point: if the segmented single-choice wore
    // the same glyph, the tick would stop meaning "and also".
    ['Default', 'Name A–Z'].forEach(label => {
      expect(screen.getByRole('button', { name: label }).querySelector('svg')).toBeNull();
    });
  });

  it('says it with aria-pressed, not with the glyph, and does not say it twice', () => {
    renderList();

    // The tick is decoration over a state the button already announces.
    expect(isOn('Account Type')).toBe(true);
    expect(switchFor('Account Type').querySelector('[aria-hidden="true"]')).not.toBeNull();
    // The accessible name is still just the words — the switches are found by
    // name all over this file, and a glyph that leaked into it would rename
    // the control every time it was pressed.
    expect(switchFor('Account Type')).toHaveAccessibleName('Account Type');
  });
});

describe('Reconciliation — the switches are remembered, and are this page\'s own', () => {
  it('remembers both switches across a remount', () => {
    const first = renderList();
    fireEvent.click(switchFor('Institution'));
    expect(preferences.getItem(RECONCILIATION_GROUPING_STORAGE_KEY))
      .toBe('{"byType":true,"byInstitution":true}');
    first.unmount();

    renderList();
    expect(isOn('Account Type')).toBe(true);
    expect(isOn('Institution')).toBe(true);
    expect(subBands()).toHaveLength(4);
  });

  it('does not touch the Accounts page\'s preference, or read from it', () => {
    // The two screens answer different questions — a portfolio read and a
    // worklist — and a user may reasonably want them banded differently.
    // Sharing one key would mean grouping the worklist silently re-banded the
    // portfolio, which is a page changing because a different page was touched.
    preferences.setItem(ACCOUNT_GROUPING_STORAGE_KEY, '{"byType":false,"byInstitution":true}');

    const first = renderList();
    // The Accounts page's institution-only view did not arrive here.
    expect(isOn('Account Type')).toBe(true);
    expect(isOn('Institution')).toBe(false);

    fireEvent.click(switchFor('Institution'));
    first.unmount();

    // …and this page's change did not go back the other way.
    expect(preferences.getItem(ACCOUNT_GROUPING_STORAGE_KEY))
      .toBe('{"byType":false,"byInstitution":true}');
  });

  it('carries the pre-toggle choice over rather than resetting the view', () => {
    // Someone whose reconciliation list was banded by institution yesterday —
    // under the single either/or key — must still see institution bands today,
    // not be silently moved back to the default.
    preferences.setItem(LEGACY_RECONCILIATION_GROUPING_STORAGE_KEY, 'institution');

    renderList();
    expect(isOn('Account Type')).toBe(false);
    expect(isOn('Institution')).toBe(true);
    expect(sections()).toEqual([
      'Invented Bank(2 accounts)',
      'Rival Invented Bank(1 account)',
      'No institution recorded(1 account)',
    ]);
  });
});
