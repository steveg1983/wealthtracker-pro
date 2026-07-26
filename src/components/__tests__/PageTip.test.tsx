import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PageTip from '../PageTip';
import { resetDismissedPageTips } from '../../utils/pageTips';

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

  // The `learnMoreUrl` prop was removed — none of the app's tips ever passed
  // one, so it was rendering-code nobody could reach. Replaces the old test
  // that asserted the "Learn more" link.
  it('renders no link, only the copy and the dismiss control', () => {
    render(
      <PageTip
        id="test-tip"
        title="Test Title"
        description="Test description"
      />
    );
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(screen.queryByText('Learn more')).not.toBeInTheDocument();
  });

  // Escapes the page-transition wrapper's transform, which would otherwise
  // make the tip's position:fixed resolve against the page CONTENT box.
  it('renders into document.body rather than in place', () => {
    const { container } = render(
      <PageTip id="test-tip" title="Test Title" description="Test description" />
    );
    expect(container).toBeEmptyDOMElement();
    expect(document.body).toContainElement(screen.getByText('Test Title'));
  });

  // Mobile: clear of the bottom nav (~78px) and its floating quick-action
  // button (to ~136px). Desktop placement is unchanged.
  it('sits above the mobile bottom navigation, unchanged on desktop', () => {
    render(<PageTip id="test-tip" title="Test Title" description="Test description" />);
    const panel = screen.getByText('Test Title').closest('div.fixed');
    expect(panel).not.toBeNull();
    expect(panel).toHaveClass('bottom-36');
    expect(panel).not.toHaveClass('bottom-0');
    expect(panel).toHaveClass('md:bottom-4', 'md:right-4');
  });

  // The id convention: bump the id when a tip's meaning changes and the
  // corrected tip is shown once more to someone who dismissed the old one.
  it('shows a corrected tip again once its id is bumped', () => {
    localStorage.setItem('pageTipDismissed_dashboard-welcome', 'true');
    render(
      <PageTip
        id="dashboard-welcome-2"
        title="Corrected Title"
        description="Corrected description"
      />
    );
    expect(screen.getByText('Corrected Title')).toBeInTheDocument();
  });

  it('shows a dismissed tip again after the Settings reset', () => {
    const { unmount } = render(
      <PageTip id="test-tip" title="Test Title" description="Test description" />
    );
    fireEvent.click(screen.getByLabelText('Dismiss tip'));
    unmount();

    expect(resetDismissedPageTips()).toBe(1);

    render(<PageTip id="test-tip" title="Test Title" description="Test description" />);
    expect(screen.getByText('Test Title')).toBeInTheDocument();
  });
});
