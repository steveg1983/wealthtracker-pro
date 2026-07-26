import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
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

    expect(labels).toEqual(['Home', 'Accounts', 'Transactions', 'Reconcile', 'Review']);
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
    expect(screen.getByRole('link', { name: 'Review' })).toHaveAttribute('href', '/categorisation');
  });

  it('marks only the current destination as the current page', () => {
    renderAt('/categorisation');

    expect(screen.getByRole('link', { name: 'Review' })).toHaveAttribute('aria-current', 'page');
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
