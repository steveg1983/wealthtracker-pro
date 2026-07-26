import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ShowTipsAgain from '../ShowTipsAgain';
import { pageTipStorageKey } from '../../../utils/pageTips';

describe('ShowTipsAgain', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('clears every dismissed page tip and says how many came back', () => {
    localStorage.setItem(pageTipStorageKey('dashboard-welcome-2'), 'true');
    localStorage.setItem(pageTipStorageKey('settings-intro-2'), 'true');
    localStorage.setItem('reportsPeriod', 'this-month');

    render(<ShowTipsAgain />);
    fireEvent.click(screen.getByRole('button', { name: 'Show tips again' }));

    expect(localStorage.getItem(pageTipStorageKey('dashboard-welcome-2'))).toBeNull();
    expect(localStorage.getItem(pageTipStorageKey('settings-intro-2'))).toBeNull();
    // Only tip dismissals — the rest of the user's preferences are untouched.
    expect(localStorage.getItem('reportsPeriod')).toBe('this-month');
    expect(screen.getByRole('status')).toHaveTextContent(
      '2 tips will show again the next time you open their pages.'
    );
  });

  it('says so plainly when there was nothing to bring back', () => {
    render(<ShowTipsAgain />);
    fireEvent.click(screen.getByRole('button', { name: 'Show tips again' }));
    expect(screen.getByRole('status')).toHaveTextContent(
      'No tips were hidden — every page tip already shows.'
    );
  });

  it('confirms nothing until it is pressed', () => {
    render(<ShowTipsAgain />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
