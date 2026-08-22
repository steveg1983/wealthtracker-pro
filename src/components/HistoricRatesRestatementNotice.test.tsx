import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import HistoricRatesRestatementNotice from './HistoricRatesRestatementNotice';
import { preferences } from '../services/preferencesService';

/**
 * The one-time restatement statement (the ruling, 22 Aug §6.4): historic
 * figures changed when per-day rates landed, and an app built on provability
 * says so once — dismissibly, and never to a reader it does not concern.
 */
describe('HistoricRatesRestatementNotice', () => {
  beforeEach(() => {
    preferences.setItem('money_management_fx_history_restatement_dismissed', '');
  });

  it('says the recalculation happened, and that the ledger did not move', () => {
    render(<HistoricRatesRestatementNotice visible={true} />);
    expect(screen.getByText(/Historic figures have been recalculated/)).toBeInTheDocument();
    // The sentence that matters most: valuation moved, agreement did not.
    expect(screen.getByText(/Your recorded transactions are unchanged/)).toBeInTheDocument();
  });

  it('renders nothing for a surface it does not concern', () => {
    const { container } = render(<HistoricRatesRestatementNotice visible={false} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('stays dismissed, as a preference rather than a tab', () => {
    const { unmount } = render(<HistoricRatesRestatementNotice visible={true} />);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss this notice' }));
    expect(screen.queryByText(/Historic figures/)).not.toBeInTheDocument();
    unmount();
    render(<HistoricRatesRestatementNotice visible={true} />);
    expect(screen.queryByText(/Historic figures/)).not.toBeInTheDocument();
  });
});
