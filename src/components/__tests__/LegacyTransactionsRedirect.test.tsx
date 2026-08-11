/**
 * `/transactions`, after the global transactions page was retired.
 *
 * The address is in the wild — stored notification links written by older
 * builds, bookmarks, home-screen shortcuts — so it has to land somewhere
 * sensible rather than on "there is nothing at that address". These are the
 * rules, one test each.
 *
 * Every id and name below is invented: this repo is public.
 */

import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import LegacyTransactionsRedirect from '../LegacyTransactionsRedirect';
import { legacyTransactionsDestination } from '../legacyTransactionsDestination';

/** Whatever the router settled on, printed so a test can read it back. */
function WhereAmI(): React.JSX.Element {
  const location = useLocation();
  return <div data-testid="landed">{`${location.pathname}${location.search}`}</div>;
}

const landOn = (entry: string): string => {
  render(
    <MemoryRouter initialEntries={[entry]}>
      <Routes>
        <Route path="/transactions" element={<LegacyTransactionsRedirect />} />
        <Route path="/accounts" element={<WhereAmI />} />
        <Route path="/accounts/:accountId" element={<WhereAmI />} />
      </Routes>
    </MemoryRouter>
  );
  return screen.getByTestId('landed').textContent ?? '';
};

describe('the retired /transactions address', () => {
  it('sends a bare visit to the list of accounts', () => {
    expect(landOn('/transactions')).toBe('/accounts');
  });

  it('sends ?account= to that account\'s register', () => {
    // The only deep link the old page ever honoured — and the register is
    // where it was always trying to get to.
    expect(landOn('/transactions?account=acc-savings')).toBe('/accounts/acc-savings');
  });

  it('keeps every other parameter on the way through', () => {
    // ?demo=true is the load-bearing one: dropped mid-navigation it bounces a
    // demo session out to the landing page.
    expect(landOn('/transactions?demo=true')).toBe('/accounts?demo=true');
  });

  it('keeps them while also honouring the account', () => {
    expect(landOn('/transactions?account=acc-current&demo=true'))
      .toBe('/accounts/acc-current?demo=true');
  });

  it('spends the account parameter rather than dragging it along', () => {
    // It has chosen the destination. Left on, it would sit in the address bar
    // of a register that does not read one.
    expect(landOn('/transactions?account=acc-current')).not.toContain('account=');
  });
});

describe('the one parameter that is translated', () => {
  it('turns the old add link into the app-wide one', () => {
    // `?action=add` on /transactions meant "add a TRANSACTION". On /accounts
    // those same three letters already mean "add an ACCOUNT", so carrying the
    // word through unchanged would hand the user the wrong dialog. Preserving
    // a parameter's text while destroying its meaning is not preservation.
    expect(landOn('/transactions?action=add')).toBe('/accounts?action=add-transaction');
  });

  it('leaves an action it does not know alone', () => {
    expect(legacyTransactionsDestination('?action=export'))
      .toEqual({ pathname: '/accounts', search: 'action=export' });
  });
});
