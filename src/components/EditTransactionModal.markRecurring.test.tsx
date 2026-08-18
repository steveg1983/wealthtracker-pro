/**
 * "This is a recurring payment" — teaching the app by example.
 *
 * The owner's ask, 18 Aug: "the user can pick a transaction and label it
 * 'recurring' and the system then smartly detects past payments of the same
 * amount on a similar date the previous months with the same / similar payee
 * name from the same account". This is that control, and the properties it
 * has to hold are:
 *
 *  - it writes a verdict about the PATTERN, never a change to the row (the
 *    detector reads the register and must stay the only thing that does);
 *  - the key it writes is the key "What I'm committed to" and the calendar
 *    read, so marking one payment and confirming a detection are one act;
 *  - marking withdraws a standing "not recurring", so the stored state can
 *    never hold both verdicts;
 *  - it is absent on a transfer, matching the detector's own rule that a
 *    standing order between your own accounts is not a commitment to anyone.
 *
 * Every name and figure below is invented: this repo is public.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import EditTransactionModal from './EditTransactionModal';
import { recurringAnswerKey } from '../utils/suggestionDismissals';
import { normalisePayeeKey } from '../utils/recurringDetection';
import type { Account, SuggestionDismissal, Transaction } from '../types';

const mocks = vi.hoisted(() => ({
  app: {
    accounts: [] as Account[],
    transactions: [] as Transaction[],
    categories: [] as unknown[],
    getSubCategories: () => [],
    getDetailCategories: () => [],
    updateTransaction: vi.fn(async () => {}),
    deleteTransaction: vi.fn(),
    getTransactionSplits: vi.fn(async () => []),
    setTransactionSplits: vi.fn(async () => ({ isSplit: false, splitCount: 0, amount: 0 })),
    linkTransferPair: vi.fn(async () => ({ a: {}, b: {} })),
    createTransferCounterpart: vi.fn(async () => ({ source: {}, counterpart: {} })),
    suggestionDismissals: [] as SuggestionDismissal[],
    suggestionDismissalsStatus: 'ready' as 'idle' | 'ready' | 'loading',
    refreshSuggestionDismissals: vi.fn(async () => {}),
    dismissSuggestion: vi.fn(async () => {}),
    restoreSuggestion: vi.fn(async () => {}),
  },
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: '/find', search: '', hash: '', state: null, key: 'test' }),
  };
});

vi.mock('../contexts/AppContextSupabase', () => ({ useApp: () => mocks.app }));

vi.mock('../contexts/ToastContext', () => ({
  useToast: () => ({
    showToast: vi.fn(),
    showSuccess: vi.fn(),
    showError: vi.fn(),
    showWarning: vi.fn(),
    showInfo: vi.fn(),
    dismissToast: vi.fn(),
  }),
}));

vi.mock('../hooks/useTransactionNotifications', () => ({
  useTransactionNotifications: () => ({ addTransaction: vi.fn(async () => {}) }),
}));

vi.mock('../hooks/usePayeeMemory', () => ({
  usePayeeMemory: () => ({ propagateCategory: vi.fn(async () => {}) }),
}));

vi.mock('./common/Modal', () => ({
  Modal: ({ isOpen, children, title }: { isOpen: boolean; children: ReactNode; title: string }) =>
    isOpen ? <div role="dialog" aria-label={title}>{children}</div> : null,
  ModalBody: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ModalFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));

vi.mock('./TagSelector', () => ({ default: () => <div data-testid="tag-selector" /> }));
vi.mock('./MarkdownEditor', () => ({ default: () => <div data-testid="markdown-editor" /> }));
vi.mock('./DocumentManager', () => ({ default: () => <div data-testid="document-manager" /> }));
vi.mock('./CategoryCreationModal', () => ({ default: () => null }));

const ACCOUNT_ID = '11111111-1111-4111-8111-111111111111';
const TRANSACTION_ID = '22222222-2222-4222-8222-222222222222';

const ACCOUNT: Account = {
  id: ACCOUNT_ID,
  name: 'Synthetic Current',
  type: 'current',
  balance: 500,
  currency: 'GBP',
  lastUpdated: new Date('2026-04-01'),
  isActive: true,
};

const row = (over: Partial<Transaction> = {}): Transaction => ({
  id: TRANSACTION_ID,
  date: new Date('2026-04-02'),
  description: 'ACME MAINTENANCE',
  amount: -250,
  type: 'expense',
  category: 'det-maintenance',
  accountId: ACCOUNT_ID,
  cleared: false,
  ...over,
});

/** The key the detector will compute for this row's pattern. */
const PATTERN_KEY = recurringAnswerKey(
  ACCOUNT_ID, 'out', normalisePayeeKey('ACME MAINTENANCE')
);

const verdict = (kind: 'recurring-confirmed' | 'recurring-not'): SuggestionDismissal => ({
  id: `dis-${kind}`,
  kind,
  subjectKey: PATTERN_KEY,
  subjectIds: [],
  dismissedAt: new Date(),
});

const tick = (): HTMLInputElement =>
  screen.getByLabelText(/This is a recurring payment/) as HTMLInputElement;

describe('EditTransactionModal — mark a payment as recurring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.app.accounts = [ACCOUNT];
    mocks.app.transactions = [];
    mocks.app.suggestionDismissals = [];
    mocks.app.suggestionDismissalsStatus = 'ready';
  });

  it('records the verdict against the PATTERN and changes nothing about the row', async () => {
    render(<EditTransactionModal isOpen onClose={vi.fn()} transaction={row()} />);

    expect(tick().checked).toBe(false);
    fireEvent.click(tick());

    await waitFor(() => {
      expect(mocks.app.dismissSuggestion).toHaveBeenCalledWith(
        'recurring-confirmed', PATTERN_KEY, []
      );
    });
    // The register is read by the detector, never written by it — and this
    // control is on the detector's side of that line.
    expect(mocks.app.updateTransaction).not.toHaveBeenCalled();
    // The key is the one the report and the calendar compute, so one act is
    // recorded in one place: an account segment a restore can remap, then the
    // pattern segment.
    expect(PATTERN_KEY).toMatch(/^account:.+\|recurring:out:/);
  });

  it('shows as marked when the pattern already carries the verdict, and unticking withdraws it', async () => {
    mocks.app.suggestionDismissals = [verdict('recurring-confirmed')];
    render(<EditTransactionModal isOpen onClose={vi.fn()} transaction={row()} />);

    expect(tick().checked).toBe(true);
    fireEvent.click(tick());

    await waitFor(() => {
      expect(mocks.app.restoreSuggestion).toHaveBeenCalledWith(
        'recurring-confirmed', PATTERN_KEY
      );
    });
    expect(mocks.app.dismissSuggestion).not.toHaveBeenCalled();
  });

  it('marking withdraws a standing "not recurring" first — never both verdicts at once', async () => {
    mocks.app.suggestionDismissals = [verdict('recurring-not')];
    render(<EditTransactionModal isOpen onClose={vi.fn()} transaction={row()} />);

    expect(tick().checked).toBe(false);
    fireEvent.click(tick());

    await waitFor(() => {
      expect(mocks.app.dismissSuggestion).toHaveBeenCalledWith(
        'recurring-confirmed', PATTERN_KEY, []
      );
    });
    expect(mocks.app.restoreSuggestion).toHaveBeenCalledWith('recurring-not', PATTERN_KEY);
  });

  it('says what ticking it will do, and then what it did', async () => {
    render(<EditTransactionModal isOpen onClose={vi.fn()} transaction={row()} />);

    // Consequence before the act…
    expect(screen.getByText(/looks back over this payee’s payments/)).toBeInTheDocument();

    mocks.app.suggestionDismissals = [verdict('recurring-confirmed')];
    render(<EditTransactionModal isOpen onClose={vi.fn()} transaction={row()} />);

    // …and after it, because "what did that do?" is the question a tick raises.
    expect(screen.getAllByText(/even when the amount varies/).length).toBeGreaterThan(0);
  });

  it('is absent on a transfer — a standing order to your own savings is not a commitment', () => {
    render(
      <EditTransactionModal
        isOpen
        onClose={vi.fn()}
        transaction={row({ type: 'transfer', category: 'transfer' })}
      />
    );

    expect(screen.queryByLabelText(/This is a recurring payment/)).not.toBeInTheDocument();
  });

  it('waits for the verdicts to load rather than showing an empty tick', () => {
    mocks.app.suggestionDismissalsStatus = 'loading';
    render(<EditTransactionModal isOpen onClose={vi.fn()} transaction={row()} />);

    // An unticked box while the answer is still loading would be a lie about
    // what the user has already said.
    expect(screen.queryByLabelText(/This is a recurring payment/)).not.toBeInTheDocument();
  });

  it('ASKS for the verdicts when they have never been loaded — the tick cannot appear otherwise', async () => {
    // The regression that shipped: the tick gated on status 'ready', the
    // verdicts are lazy-loaded, and nothing in this modal requested them —
    // so in production the control never existed. 'idle' is the state a
    // fresh session actually opens in.
    mocks.app.suggestionDismissalsStatus = 'idle';
    render(<EditTransactionModal isOpen onClose={vi.fn()} transaction={row()} />);

    await waitFor(() => {
      expect(mocks.app.refreshSuggestionDismissals).toHaveBeenCalled();
    });
  });
});
