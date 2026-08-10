/**
 * A new page opens at its own heading — and the three navigations that must be
 * left alone.
 *
 * ─ WHAT JSDOM CAN AND CANNOT SAY ───────────────────────────────────────────
 * It does not lay anything out and it does not scroll, so `window.scrollY` is
 * always 0 and asserting an offset here would assert nothing. src/test/setup.ts
 * already replaces window.scrollTo with a no-op to keep jsdom quiet; these
 * tests watch that no-op instead. The REQUEST is the observable behaviour, and
 * the request is what the component is responsible for.
 *
 * The ordering test is the one that matters most, and it is real: it asserts
 * that the reset is asked for BEFORE the arriving page's callback ref brings
 * its row into view, using the order the two mocks were actually called in.
 * Move this component after <Routes> and that test fails, which is exactly the
 * regression it exists to catch — a reset that lands on top of a deep link is
 * worse than no reset at all.
 *
 * Every account id below is invented: this repo is public.
 */
import React from 'react';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import ScrollResetOnNavigate from '../ScrollResetOnNavigate';

const REGISTER_PATH = '/accounts/acc-synthetic';

/**
 * Every navigation the app actually performs, as buttons: a link to another
 * page, a redirect, a deep link consuming itself with a same-pathname replace,
 * a filter writing itself into the address bar, and Back.
 */
function Page({ name }: { name: string }): React.JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <div>
      <h1>{name}</h1>
      <span data-testid="where">{`${location.pathname}${location.search}`}</span>
      <button type="button" onClick={() => navigate(REGISTER_PATH)}>
        open the register
      </button>
      <button type="button" onClick={() => navigate('/reports', { replace: true })}>
        redirect to reports
      </button>
      <button
        type="button"
        onClick={() => navigate({ pathname: location.pathname, search: '' }, { replace: true })}
      >
        consume the parameter
      </button>
      <button
        type="button"
        onClick={() => navigate({ pathname: location.pathname, search: '?payee=synthetic' })}
      >
        filter in place
      </button>
      <button type="button" onClick={() => navigate(-1)}>
        back
      </button>
    </div>
  );
}

const renderAt = (entry: string): void => {
  render(
    <MemoryRouter initialEntries={[entry]}>
      <ScrollResetOnNavigate />
      <Routes>
        <Route path="/accounts" element={<Page name="Accounts" />} />
        <Route path={REGISTER_PATH} element={<Page name="Register" />} />
        <Route path="/reports" element={<Page name="Reports" />} />
      </Routes>
    </MemoryRouter>
  );
};

const where = (): string => screen.getByTestId('where').textContent ?? '';

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ScrollResetOnNavigate — going somewhere new', () => {
  it('lands at the top when a link opens another page', () => {
    renderAt('/accounts');
    const scrolls = vi.spyOn(window, 'scrollTo');

    fireEvent.click(screen.getByRole('button', { name: 'open the register' }));

    expect(where()).toBe(REGISTER_PATH);
    expect(scrolls).toHaveBeenCalledWith(0, 0);
  });

  it('lands at the top when a redirect replaces one page with another', () => {
    renderAt('/accounts');
    const scrolls = vi.spyOn(window, 'scrollTo');

    fireEvent.click(screen.getByRole('button', { name: 'redirect to reports' }));

    expect(where()).toBe('/reports');
    expect(scrolls).toHaveBeenCalledWith(0, 0);
  });

  it('leaves the opening page of a session where the browser put it', () => {
    const scrolls = vi.spyOn(window, 'scrollTo');

    renderAt('/accounts');

    expect(where()).toBe('/accounts');
    expect(scrolls).not.toHaveBeenCalled();
  });
});

describe('ScrollResetOnNavigate — the navigations it must not touch', () => {
  /**
   * Back is the browser's, and the browser restores the offset of the entry it
   * is returning to on its own. Forcing the top here would mean coming back to
   * a two-hundred-row list at row one, every time.
   */
  it('does not scroll on Back — native restoration is left to do its job', () => {
    renderAt('/accounts');
    fireEvent.click(screen.getByRole('button', { name: 'open the register' }));
    const scrolls = vi.spyOn(window, 'scrollTo');

    fireEvent.click(screen.getByRole('button', { name: 'back' }));

    expect(where()).toBe('/accounts');
    expect(scrolls).not.toHaveBeenCalled();
  });

  /**
   * The reports hub, the register's ?txn= link and the duplicate sweep all
   * consume their arrival parameters with a replace onto the SAME pathname.
   * That is not a navigation the reader made, and it must not move them.
   */
  it('does not scroll when a deep link consumes its own parameter in place', () => {
    renderAt('/reports?period=this-month&focus=synthetic');
    const scrolls = vi.spyOn(window, 'scrollTo');

    fireEvent.click(screen.getByRole('button', { name: 'consume the parameter' }));

    expect(where()).toBe('/reports');
    expect(scrolls).not.toHaveBeenCalled();
  });

  it('does not scroll when a filter writes itself into the address bar', () => {
    renderAt('/accounts');
    const scrolls = vi.spyOn(window, 'scrollTo');

    fireEvent.click(screen.getByRole('button', { name: 'filter in place' }));

    expect(where()).toBe('/accounts?payee=synthetic');
    expect(scrolls).not.toHaveBeenCalled();
  });
});

describe('ScrollResetOnNavigate — composing with the arrival scrolls', () => {
  /**
   * The register's ?txn= row, the accounts row you came back from, a drilled
   * report's point: each is delivered by a callback ref or a retry once the
   * page has mounted. The reset has to have happened FIRST, or it wipes out the
   * very thing the navigation was for.
   *
   * `invocationCallOrder` is a global counter across all vitest mocks, so
   * comparing the two is a genuine "which happened first" and not a proxy.
   */
  it('resets before the arriving page brings its row into view', () => {
    const arrived = vi.fn();

    /** The shape of every arrival in the app: a row that scrolls itself in. */
    function ArrivalPage(): React.JSX.Element {
      return (
        <div
          ref={(node) => {
            if (node !== null) arrived();
          }}
        >
          the row the link pointed at
        </div>
      );
    }

    const scrolls = vi.spyOn(window, 'scrollTo');
    render(
      <MemoryRouter initialEntries={['/accounts']}>
        <ScrollResetOnNavigate />
        <Routes>
          <Route path="/accounts" element={<Page name="Accounts" />} />
          <Route path={REGISTER_PATH} element={<ArrivalPage />} />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('button', { name: 'open the register' }));

    expect(scrolls).toHaveBeenCalledWith(0, 0);
    expect(arrived).toHaveBeenCalled();
    expect(scrolls.mock.invocationCallOrder[0]).toBeLessThan(arrived.mock.invocationCallOrder[0]);
  });
});
