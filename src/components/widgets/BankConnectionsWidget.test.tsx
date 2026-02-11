import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { BankConnection } from '../../services/bankConnectionService';
import BankConnectionsWidget from './BankConnectionsWidget';

const {
  mockNavigate,
  mockGetToken,
  mockBankConnectionService
} = vi.hoisted(() => ({
  mockNavigate: vi.fn(),
  mockGetToken: vi.fn(async () => 'test-token'),
  mockBankConnectionService: {
    setAuthTokenProvider: vi.fn(),
    refreshConnections: vi.fn(),
    getConnections: vi.fn(),
    needsReauth: vi.fn(),
    syncAll: vi.fn()
  }
}));

vi.mock('../../services/bankConnectionService', () => ({
  bankConnectionService: mockBankConnectionService
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate
}));

vi.mock('@clerk/clerk-react', () => ({
  useAuth: () => ({ getToken: mockGetToken })
}));

vi.mock('date-fns', () => ({
  format: vi.fn((date: Date | string, formatStr: string) => {
    const parsed = new Date(date);
    if (formatStr === 'MMM d') {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${months[parsed.getMonth()]} ${parsed.getDate()}`;
    }
    return parsed.toISOString();
  })
}));

vi.mock('../icons', () => ({
  Building2Icon: ({ size }: { size?: number }) => <div data-testid="Building2Icon" data-size={size} />,
  RefreshCwIcon: ({ size, className }: { size?: number; className?: string }) => (
    <div data-testid="RefreshCwIcon" data-size={size} className={className} />
  ),
  CheckCircleIcon: ({ size }: { size?: number }) => <div data-testid="CheckCircleIcon" data-size={size} />,
  AlertCircleIcon: ({ size }: { size?: number }) => <div data-testid="AlertCircleIcon" data-size={size} />,
  LinkIcon: ({ size }: { size?: number }) => <div data-testid="LinkIcon" data-size={size} />
}));

const mockConnections: BankConnection[] = [
  {
    id: 'conn_1',
    provider: 'truelayer',
    institutionId: 'chase',
    institutionName: 'Chase Bank',
    status: 'connected',
    accounts: ['acc_1', 'acc_2'],
    accountsCount: 2,
    lastSync: new Date('2024-01-20T00:00:00.000Z')
  },
  {
    id: 'conn_2',
    provider: 'truelayer',
    institutionId: 'bofa',
    institutionName: 'Bank of America',
    status: 'error',
    accounts: ['acc_3'],
    accountsCount: 1,
    lastSync: new Date('2024-01-19T00:00:00.000Z'),
    error: 'Connection failed'
  },
  {
    id: 'conn_3',
    provider: 'truelayer',
    institutionId: 'wells',
    institutionName: 'Wells Fargo',
    status: 'reauth_required',
    accounts: ['acc_4', 'acc_5', 'acc_6'],
    accountsCount: 3,
    lastSync: new Date('2024-01-18T00:00:00.000Z'),
    error: 'Token expired'
  }
];

const rowMetaMatcher = (value: string) => (_content: string, element: Element | null): boolean =>
  element?.tagName.toLowerCase() === 'p' && Boolean(element.textContent?.includes(value));

describe('BankConnectionsWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockBankConnectionService.setAuthTokenProvider.mockImplementation(() => {});
    mockBankConnectionService.refreshConnections.mockResolvedValue([]);
    mockBankConnectionService.getConnections.mockReturnValue([]);
    mockBankConnectionService.needsReauth.mockReturnValue([]);
    mockBankConnectionService.syncAll.mockResolvedValue(new Map());
  });

  it('shows empty state when there are no connections', async () => {
    render(<BankConnectionsWidget size="medium" settings={{}} />);

    expect(await screen.findByText('No banks connected')).toBeInTheDocument();
    expect(screen.getByText('Connect a bank')).toBeInTheDocument();
    expect(screen.getByTestId('LinkIcon')).toBeInTheDocument();
  });

  it('navigates to settings when clicking connect bank in empty state', async () => {
    render(<BankConnectionsWidget size="medium" settings={{}} />);

    fireEvent.click(await screen.findByText('Connect a bank'));
    expect(mockNavigate).toHaveBeenCalledWith('/settings/data');
  });

  it('shows connection and error counts in small size', async () => {
    mockBankConnectionService.getConnections.mockReturnValue(mockConnections);
    render(<BankConnectionsWidget size="small" settings={{}} />);

    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument();
    });
    expect(screen.getByText('Banks Connected')).toBeInTheDocument();
    expect(screen.getByText('2 need attention')).toBeInTheDocument();
  });

  it('renders a medium connection list with a max of 3 rows', async () => {
    const manyConnections = [...mockConnections, ...mockConnections];
    mockBankConnectionService.getConnections.mockReturnValue(manyConnections);
    render(<BankConnectionsWidget size="medium" settings={{}} />);

    expect(await screen.findByText('Chase Bank')).toBeInTheDocument();
    expect(screen.getAllByTestId('Building2Icon')).toHaveLength(3);
    expect(screen.getByText('+3 more')).toBeInTheDocument();
  });

  it('renders a large connection list with a max of 5 rows', async () => {
    const manyConnections = [...mockConnections, ...mockConnections];
    mockBankConnectionService.getConnections.mockReturnValue(manyConnections);
    render(<BankConnectionsWidget size="large" settings={{}} />);

    await waitFor(() => {
      expect(screen.getAllByTestId('Building2Icon')).toHaveLength(5);
    });
    expect(screen.getByText('+1 more')).toBeInTheDocument();
  });

  it('shows status icons and status color classes', async () => {
    mockBankConnectionService.getConnections.mockReturnValue(mockConnections);
    render(<BankConnectionsWidget size="medium" settings={{}} />);

    expect(await screen.findByText('Chase Bank')).toBeInTheDocument();
    expect(screen.getAllByTestId('CheckCircleIcon')).toHaveLength(1);
    expect(screen.getAllByTestId('AlertCircleIcon')).toHaveLength(2);

    const checkIconContainer = screen.getByTestId('CheckCircleIcon').parentElement;
    const alertIcons = screen.getAllByTestId('AlertCircleIcon');
    expect(checkIconContainer).toHaveClass('text-green-600');
    expect(alertIcons[0]?.parentElement).toHaveClass('text-red-600');
    expect(alertIcons[1]?.parentElement).toHaveClass('text-yellow-600');
  });

  it('renders account counts and last sync labels for loaded connections', async () => {
    mockBankConnectionService.getConnections.mockReturnValue(mockConnections);
    render(<BankConnectionsWidget size="medium" settings={{}} />);

    expect(await screen.findByText(rowMetaMatcher('2 accounts'))).toBeInTheDocument();
    expect(screen.getByText(rowMetaMatcher('1 accounts'))).toBeInTheDocument();
    expect(screen.getByText(rowMetaMatcher('3 accounts'))).toBeInTheDocument();
    expect(screen.getByText(rowMetaMatcher('Last sync Jan 20'))).toBeInTheDocument();
    expect(screen.getByText(rowMetaMatcher('Last sync Jan 19'))).toBeInTheDocument();
    expect(screen.getByText(rowMetaMatcher('Last sync Jan 18'))).toBeInTheDocument();
  });

  it('disables sync button when there are no connections', async () => {
    render(<BankConnectionsWidget size="medium" settings={{}} />);
    expect(await screen.findByTitle('Sync all banks')).toBeDisabled();
  });

  it('enables sync button when connections are present', async () => {
    mockBankConnectionService.getConnections.mockReturnValue(mockConnections);
    render(<BankConnectionsWidget size="medium" settings={{}} />);
    await screen.findByRole('button', { name: 'Manage connections →' });
    expect(screen.getByTitle('Sync all banks')).not.toBeDisabled();
  });

  it('calls syncAll and reloads connections when syncing', async () => {
    mockBankConnectionService.getConnections.mockReturnValue(mockConnections);
    render(<BankConnectionsWidget size="medium" settings={{}} />);

    fireEvent.click(await screen.findByTitle('Sync all banks'));

    await waitFor(() => {
      expect(mockBankConnectionService.syncAll).toHaveBeenCalledTimes(1);
      expect(mockBankConnectionService.refreshConnections).toHaveBeenCalledTimes(2);
    });
  });

  it('shows spinner class while sync is in progress', async () => {
    mockBankConnectionService.getConnections.mockReturnValue(mockConnections);
    let resolveSync: (() => void) | null = null;
    mockBankConnectionService.syncAll.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveSync = resolve;
        })
    );
    render(<BankConnectionsWidget size="medium" settings={{}} />);

    fireEvent.click(await screen.findByTitle('Sync all banks'));
    expect(screen.getByTestId('RefreshCwIcon')).toHaveClass('animate-spin');

    resolveSync?.();
    await waitFor(() => {
      expect(screen.getByTestId('RefreshCwIcon')).not.toHaveClass('animate-spin');
    });
  });

  it('shows and handles manage connections navigation when connections exist', async () => {
    mockBankConnectionService.getConnections.mockReturnValue(mockConnections);
    render(<BankConnectionsWidget size="medium" settings={{}} />);

    const manageButton = await screen.findByRole('button', { name: 'Manage connections →' });
    fireEvent.click(manageButton);
    expect(mockNavigate).toHaveBeenCalledWith('/settings/data');
  });

  it('sets auth token provider and checks reauth requirements during mount', async () => {
    mockBankConnectionService.getConnections.mockReturnValue(mockConnections);
    mockBankConnectionService.needsReauth.mockReturnValue([mockConnections[2]]);
    render(<BankConnectionsWidget size="medium" settings={{}} />);

    await screen.findByText('Chase Bank');
    expect(mockBankConnectionService.setAuthTokenProvider).toHaveBeenCalledTimes(1);
    expect(mockBankConnectionService.needsReauth).toHaveBeenCalledTimes(1);
  });
});
