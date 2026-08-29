import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Welcome from '../Welcome';

/**
 * A SIGNED-OUT PAGE CARRIES ITS OWN HEADER, AND NOTHING ELSE'S.
 *
 * The sign-in shell used to render inside the app's Layout, which put nine
 * controls — Dashboard, Accounts, Plan, Reports, Manage, Settings, search, a
 * bell, help — in front of a visitor who could use none of them (design
 * handover 29 Aug, §5.1: "Signed-out gets wordmark plus Sign in and nothing
 * else"). The route moved outside Layout; what this file holds in place is
 * that the page brings its own minimal header and never grows app chrome of
 * its own.
 */

vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ isSignedIn: false }),
  SignInButton: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SignUpButton: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

const renderWelcome = (): void => {
  render(
    <MemoryRouter initialEntries={['/']}>
      <Welcome />
    </MemoryRouter>
  );
};

describe('the signed-out front door', () => {
  it('offers the wordmark and the two account actions', () => {
    renderWelcome();
    expect(screen.getAllByText('WealthTracker').length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: 'Sign in' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'Create an account' })).toBeInTheDocument();
  });

  it('renders none of the app chrome a visitor cannot use', () => {
    renderWelcome();
    // The nine controls the old shell showed. None may return.
    for (const label of ['Dashboard', 'Reports', 'Manage', 'Settings']) {
      expect(screen.queryByRole('link', { name: new RegExp(label, 'i') })).not.toBeInTheDocument();
    }
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /notifications/i })).not.toBeInTheDocument();
  });

  it('is a full page — it paints its own ground rather than borrowing chrome', () => {
    renderWelcome();
    // The wrapper carries min-h-screen: outside Layout there is nothing
    // behind this page, so it must cover the viewport itself.
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.closest('.min-h-screen')).not.toBeNull();
  });
});
