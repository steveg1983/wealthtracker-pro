import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import MobileBottomNav from '../MobileBottomNav';

/**
 * The bottom bar is the whole navigation on a phone, so what is in it and
 * where each slot points is a product decision worth pinning down. Every
 * destination here must be a real route in App.tsx.
 */
function renderAt(path: string): void {
  render(
    <MemoryRouter initialEntries={[path]}>
      <MobileBottomNav />
    </MemoryRouter>
  );
}

describe('MobileBottomNav', () => {
  it('offers the five phone destinations in order', () => {
    renderAt('/dashboard');

    const nav = screen.getByRole('navigation', { name: 'Mobile navigation' });
    const labels = Array.from(nav.querySelectorAll('a')).map(a => a.textContent?.trim());

    // Find, where the global Transactions list used to be: on a phone you
    // either open the account in front of you or you are hunting for one row.
    expect(labels).toEqual(['Home', 'Accounts', 'Find', 'Reconcile', 'Categorise']);
  });

  it('offers no slot for the retired global transactions list', () => {
    renderAt('/dashboard');

    const nav = screen.getByRole('navigation', { name: 'Mobile navigation' });
    const hrefs = Array.from(nav.querySelectorAll('a')).map(a => a.getAttribute('href'));

    expect(hrefs).not.toContain('/transactions');
    expect(hrefs).toContain('/find');
  });

  it('sends Home to the dashboard, not the public welcome page', () => {
    renderAt('/dashboard');

    // "/" renders <Welcome/>, the marketing landing page. A signed-in user
    // tapping Home wants their figures.
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute('href', '/dashboard');
  });

  it('points the two cleanup chores at their own pages', () => {
    renderAt('/dashboard');

    expect(screen.getByRole('link', { name: 'Reconcile' })).toHaveAttribute('href', '/reconciliation');
    expect(screen.getByRole('link', { name: 'Categorise' })).toHaveAttribute('href', '/categorisation');
  });

  it('marks only the current destination as the current page', () => {
    renderAt('/categorisation');

    expect(screen.getByRole('link', { name: 'Categorise' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
  });

  it('does not treat the dashboard as current while reconciling', () => {
    renderAt('/reconciliation');

    expect(screen.getByRole('link', { name: 'Reconcile' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
  });

  it('gives every slot a 48px touch target', () => {
    renderAt('/dashboard');

    const nav = screen.getByRole('navigation', { name: 'Mobile navigation' });
    for (const link of Array.from(nav.querySelectorAll('a'))) {
      expect(link.className).toContain('min-w-[48px]');
      expect(link.className).toContain('min-h-[48px]');
    }
  });
});

/**
 * The floating "+" is the phone's ONLY way to add without first navigating —
 * the desktop dashboard's four quick-action tiles have gone, and on a phone the
 * sidebar that names those destinations is behind a tap. So this button, and
 * the two things it offers, are load-bearing on mobile and are pinned here.
 */
describe('the phone quick-add', () => {
  it('offers a floating + that opens Add Transaction and Add Account', () => {
    renderAt('/dashboard');

    const fab = screen.getByRole('button', { name: 'Quick actions' });
    // Phone only, and clear of the bottom bar and the home indicator.
    expect(fab.className).toContain('md:hidden');
    expect(fab.className).toContain('fixed');

    fireEvent.click(fab);

    // Both point at pages that exist. The two parameters are deliberately
    // different words: `add` on /accounts already means "add an ACCOUNT" (the
    // Accounts page reads it), while the add-transaction modal is Layout's and
    // is opened by an app-wide parameter on whatever page it lands on.
    expect(screen.getByRole('link', { name: 'Add Transaction' }))
      .toHaveAttribute('href', '/accounts?action=add-transaction');
    expect(screen.getByRole('link', { name: 'Add Account' }))
      .toHaveAttribute('href', '/accounts?action=add');
  });

  it('keeps the menu shut until it is asked for', () => {
    renderAt('/dashboard');

    expect(screen.queryByRole('link', { name: 'Add Transaction' })).not.toBeInTheDocument();
  });
});
