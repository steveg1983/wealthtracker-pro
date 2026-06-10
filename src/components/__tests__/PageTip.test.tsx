import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PageTip from '../PageTip';

describe('PageTip', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('renders the tip with title and description', () => {
    render(
      <PageTip
        id="test-tip"
        title="Test Title"
        description="Test description text"
      />
    );
    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('Test description text')).toBeInTheDocument();
  });

  it('dismisses the tip when close button is clicked', () => {
    render(
      <PageTip
        id="test-tip"
        title="Test Title"
        description="Test description"
      />
    );
    const dismissButton = screen.getByLabelText('Dismiss tip');
    fireEvent.click(dismissButton);
    expect(screen.queryByText('Test Title')).not.toBeInTheDocument();
  });

  it('persists dismissal to localStorage', () => {
    render(
      <PageTip
        id="test-tip"
        title="Test Title"
        description="Test description"
      />
    );
    fireEvent.click(screen.getByLabelText('Dismiss tip'));
    expect(localStorage.getItem('pageTipDismissed_test-tip')).toBe('true');
  });

  it('does not render when previously dismissed', () => {
    localStorage.setItem('pageTipDismissed_test-tip', 'true');
    render(
      <PageTip
        id="test-tip"
        title="Test Title"
        description="Test description"
      />
    );
    expect(screen.queryByText('Test Title')).not.toBeInTheDocument();
  });

  it('renders learn more link when provided', () => {
    render(
      <PageTip
        id="test-tip"
        title="Test Title"
        description="Test description"
        learnMoreUrl="https://example.com/help"
      />
    );
    const link = screen.getByText('Learn more');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', 'https://example.com/help');
    expect(link).toHaveAttribute('target', '_blank');
  });
});
