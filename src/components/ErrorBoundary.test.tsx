/**
 * ErrorBoundary Tests
 * A failed chunk download is a deploy race, not a crash, and the boundary has
 * to say so — the generic card's "Try Again" cannot fix it (React caches a
 * failed lazy import and re-throws it on every later render).
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import ErrorBoundary from './ErrorBoundary';

function Exploding({ error }: { error: Error }): React.JSX.Element {
  throw error;
}

function setOnline(value: boolean): void {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    get: () => value,
  });
}

describe('ErrorBoundary', () => {
  afterEach(() => {
    setOnline(true);
  });

  describe('stale chunk after a deploy', () => {
    it('offers the update and a reload rather than the crash copy', () => {
      render(
        <ErrorBoundary>
          <Exploding error={new TypeError('Importing a module script failed.')} />
        </ErrorBoundary>
      );

      expect(screen.getByText('WealthTracker has been updated')).toBeInTheDocument();
      expect(screen.getByText(/still running the older version/)).toBeInTheDocument();
      expect(screen.getByText(/nothing you've saved is affected/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Reload' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Try Again' })).not.toBeInTheDocument();
      expect(screen.queryByText('Oops! Something went wrong')).not.toBeInTheDocument();
    });

    it('recognises the Chrome wording too', () => {
      render(
        <ErrorBoundary>
          <Exploding error={new TypeError('Failed to fetch dynamically imported module: /assets/Transactions-8f3a1c.js')} />
        </ErrorBoundary>
      );

      expect(screen.getByText('WealthTracker has been updated')).toBeInTheDocument();
    });

    it('says the honest thing when the tab is offline', () => {
      setOnline(false);

      render(
        <ErrorBoundary>
          <Exploding error={new TypeError('Importing a module script failed.')} />
        </ErrorBoundary>
      );

      expect(screen.getByText("You're offline")).toBeInTheDocument();
      expect(screen.getByText(/Reconnect and reload/)).toBeInTheDocument();
      expect(screen.queryByText('WealthTracker has been updated')).not.toBeInTheDocument();
    });
  });

  describe('genuine crash', () => {
    it('keeps the generic copy and the Try Again action', () => {
      render(
        <ErrorBoundary>
          <Exploding error={new TypeError("Cannot read properties of undefined (reading 'balance')")} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument();
      expect(screen.getByText("Cannot read properties of undefined (reading 'balance')")).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
      expect(screen.queryByText('WealthTracker has been updated')).not.toBeInTheDocument();
    });

    it('does not mistake a failed API call for a stale chunk', () => {
      render(
        <ErrorBoundary>
          <Exploding error={new TypeError('Failed to fetch')} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument();
      expect(screen.queryByText('WealthTracker has been updated')).not.toBeInTheDocument();
    });
  });

  it('renders its children when nothing has thrown', () => {
    render(
      <ErrorBoundary>
        <p>Register</p>
      </ErrorBoundary>
    );

    expect(screen.getByText('Register')).toBeInTheDocument();
  });
});
