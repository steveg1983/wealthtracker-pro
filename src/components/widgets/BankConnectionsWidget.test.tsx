import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BankConnectionsWidget from './BankConnectionsWidget';
import { bankConnectionService, type BankConnection } from '../../services/bankConnectionService';
import { useNavigate } from 'react-router-dom';

// Mock services and hooks
vi.mock('../../services/bankConnectionService');
vi.mock('react-router-dom', () => ({
  useNavigate: vi.fn(),
}));

// Mock date-fns
vi.mock('date-fns', () => ({
  format: vi.fn((date, formatStr) => {
    const d = new Date(date);
    if (formatStr === 'MMM d') {
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      return `${months[d.getMonth()]} ${d.getDate()}`;
    }
    return d.toLocaleDateString();
  }),
}));

// Mock icons
vi.mock('../icons', () => ({
  Building2Icon: ({ size }: { size?: number }) => (
    <div data-testid="Building2Icon" data-size={size} />
  ),
  RefreshCwIcon: ({ size, className }: { size?: number; className?: string }) => (
    <div data-testid="RefreshCwIcon" data-size={size} className={className} />
  ),
  CheckCircleIcon: ({ size }: { size?: number }) => (
    <div data-testid="CheckCircleIcon" data-size={size} />
  ),
  AlertCircleIcon: ({ size }: { size?: number }) => (
    <div data-testid="AlertCircleIcon" data-size={size} />
  ),
  LinkIcon: ({ size }: { size?: number }) => (
    <div data-testid="LinkIcon" data-size={size} />
  ),
}));

const mockNavigate = vi.fn();
const mockBankConnectionService = bankConnectionService as {
  getConnections: Mock;
  needsReauth: Mock;
  syncAll: Mock;
};

// Mock data
const mockConnections: BankConnection[] = [
  {
    id: 'conn1',
    institutionName: 'Chase Bank',
    institutionId: 'chase',
    accessToken: 'token1',
    accounts: ['acc1', 'acc2'],
    lastSync: new Date('2024-01-20').toISOString(),
    status: 'connected',
    error: null,
  },
  {
    id: 'conn2',
    institutionName: 'Bank of America',
    institutionId: 'bofa',
    accessToken: 'token2',
    accounts: ['acc3'],
    lastSync: new Date('2024-01-19').toISOString(),
    status: 'error',
    error: 'Connection failed',
  },
  {
    id: 'conn3',
    institutionName: 'Wells Fargo',
    institutionId: 'wells',
    accessToken: 'token3',
    accounts: ['acc4', 'acc5', 'acc6'],
    lastSync: new Date('2024-01-18').toISOString(),
    status: 'reauth_required',
    error: 'Token expired',
  },
];

describe('BankConnectionsWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useNavigate as Mock).mockReturnValue(mockNavigate);
    mockBankConnectionService.getConnections.mockReturnValue([]);
    mockBankConnectionService.needsReauth.mockReturnValue([]);
    mockBankConnectionService.syncAll.mockResolvedValue(undefined);
  });

  describe('Empty State', () => {
    it('shows empty state when no connections', () => {
      render(<BankConnectionsWidget size="medium" settings={{}} />);
      
      expect(screen.getByText('No banks connected')).toBeInTheDocument();
      expect(screen.getByText('Connect a bank')).toBeInTheDocument();
      expect(screen.getByTestId('LinkIcon')).toBeInTheDocument();
    });

    it('navigates to settings when clicking connect bank', () => {
      render(<BankConnectionsWidget size="medium" settings={{}} />);
      
      fireEvent.click(screen.getByText('Connect a bank'));
      
      expect(mockNavigate).toHaveBeenCalledWith('/settings/data');
    });
  });

  describe('Small Size', () => {
    it('shows connection count in small size', () => {
      mockBankConnectionService.getConnections.mockReturnValue(mockConnections);
      
      render(<BankConnectionsWidget size="small" settings={{}} />);
      
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('Banks Connected')).toBeInTheDocument();
    });

    it('shows error count in small size', () => {
      mockBankConnectionService.getConnections.mockReturnValue(mockConnections);
      
      render(<BankConnectionsWidget size="small" settings={{}} />);
      
      expect(screen.getByText('2 need attention')).toBeInTheDocument();
    });

    it('does not show error message when all connected', () => {
      const connectedOnly = [mockConnections[0]];
      mockBankConnectionService.getConnections.mockReturnValue(connectedOnly);
      
      render(<BankConnectionsWidget size="small" settings={{}} />);
      
      expect(screen.queryByText('need attention')).not.toBeInTheDocument();
    });
  });

  describe('Connection List', () => {
    it('displays connections in medium size', () => {
      mockBankConnectionService.getConnections.mockReturnValue(mockConnections);
      
      render(<BankConnectionsWidget size="medium" settings={{}} />);
      
      expect(screen.getByText('Chase Bank')).toBeInTheDocument();
      expect(screen.getByText('Bank of America')).toBeInTheDocument();
      expect(screen.getByText('Wells Fargo')).toBeInTheDocument();
    });

    it('limits connections to 3 in medium size', () => {
      const manyConnections = [...mockConnections, ...mockConnections];
      mockBankConnectionService.getConnections.mockReturnValue(manyConnections);
      
      render(<BankConnectionsWidget size="medium" settings={{}} />);
      
      // Count connection items by looking for the account count text
      const accountTexts = screen.getAllByText(/\d+ accounts/);
      expect(accountTexts).toHaveLength(3);
      expect(screen.getByText('+3 more')).toBeInTheDocument();
    });

    it('shows up to 5 connections in large size', () => {
      const manyConnections = [...mockConnections, ...mockConnections];
      mockBankConnectionService.getConnections.mockReturnValue(manyConnections);
      
      render(<BankConnectionsWidget size="large" settings={{}} />);
      
      // Count connection items by looking for the account count text
      const accountTexts = screen.getAllByText(/\d+ accounts/);
      expect(accountTexts).toHaveLength(5);
      expect(screen.getByText('+1 more')).toBeInTheDocument();
    });

    it('displays account count for each connection', () => {
      mockBankConnectionService.getConnections.mockReturnValue(mockConnections);
      
      render(<BankConnectionsWidget size="medium" settings={{}} />);
      
      expect(screen.getByText(/2 accounts/)).toBeInTheDocument(); // Chase
      expect(screen.getByText(/1 accounts/)).toBeInTheDocument(); // BofA
      expect(screen.getByText(/3 accounts/)).toBeInTheDocument(); // Wells
    });

    it('displays last sync date', () => {
      mockBankConnectionService.getConnections.mockReturnValue(mockConnections);
      
      render(<BankConnectionsWidget size="medium" settings={{}} />);
      
      expect(screen.getByText(/Last sync Jan 20/)).toBeInTheDocument();
      expect(screen.getByText(/Last sync Jan 19/)).toBeInTheDocument();
      expect(screen.getByText(/Last sync Jan 18/)).toBeInTheDocument();
    });
  });

  describe('Status Indicators', () => {
    it('shows correct status icons', () => {
      mockBankConnectionService.getConnections.mockReturnValue(mockConnections);
      
      render(<BankConnectionsWidget size="medium" settings={{}} />);
      
      // Connected status shows check icon
      expect(screen.getAllByTestId('CheckCircleIcon')).toHaveLength(1);
      
      // Error and reauth_required show alert icon
      expect(screen.getAllByTestId('AlertCircleIcon')).toHaveLength(2);
    });

    it('applies correct status colors', () => {
      mockBankConnectionService.getConnections.mockReturnValue(mockConnections);
      
      render(<BankConnectionsWidget size="medium" settings={{}} />);
      
      // Check for status color classes
      const checkIcon = screen.getByTestId('CheckCircleIcon').parentElement;
      expect(checkIcon).toHaveClass('text-green-600');
      
      const alertIcons = screen.getAllByTestId('AlertCircleIcon');
      expect(alertIcons[0].parentElement).toHaveClass('text-red-600');
      expect(alertIcons[1].parentElement).toHaveClass('text-yellow-600');
    });
  });

  describe('Sync Functionality', () => {
    it('shows sync button when connections exist', () => {
      mockBankConnectionService.getConnections.mockReturnValue(mockConnections);
      
      render(<BankConnectionsWidget size="medium" settings={{}} />);
      
      const syncButton = screen.getByTitle('Sync all banks');
      expect(syncButton).toBeInTheDocument();
      expect(screen.getByTestId('RefreshCwIcon')).toBeInTheDocument();
    });

    it('disables sync button when no connections', () => {
      render(<BankConnectionsWidget size="medium" settings={{}} />);
      
      const syncButton = screen.getByTitle('Sync all banks');
      expect(syncButton).toBeDisabled();
    });

    it('handles sync all action', async () => {
      mockBankConnectionService.getConnections.mockReturnValue(mockConnections);
      
      render(<BankConnectionsWidget size="medium" settings={{}} />);
      
      const syncButton = screen.getByTitle('Sync all banks');
      fireEvent.click(syncButton);
      
      await waitFor(() => {
        expect(mockBankConnectionService.syncAll).toHaveBeenCalled();
      });
    });

    it('shows loading state during sync', async () => {
      mockBankConnectionService.getConnections.mockReturnValue(mockConnections);
      mockBankConnectionService.syncAll.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 100))
      );
      
      render(<BankConnectionsWidget size="medium" settings={{}} />);
      
      const syncButton = screen.getByTitle('Sync all banks');
      fireEvent.click(syncButton);
      
      // Should add animate-spin class during sync
      expect(screen.getByTestId('RefreshCwIcon')).toHaveClass('animate-spin');
      
      await waitFor(() => {
        expect(screen.getByTestId('RefreshCwIcon')).not.toHaveClass('animate-spin');
      });
    });

    it('reloads connections after sync', async () => {
      mockBankConnectionService.getConnections.mockReturnValue(mockConnections);
      
      render(<BankConnectionsWidget size="medium" settings={{}} />);
      
      const syncButton = screen.getByTitle('Sync all banks');
      fireEvent.click(syncButton);
      
      await waitFor(() => {
        // Should call getConnections again after sync
        expect(mockBankConnectionService.getConnections).toHaveBeenCalledTimes(2);
      });
    });
  });

  describe('Navigation', () => {
    it('shows manage connections link when connections exist', () => {
      mockBankConnectionService.getConnections.mockReturnValue(mockConnections);
      
      render(<BankConnectionsWidget size="medium" settings={{}} />);
      
      expect(screen.getByText('Manage connections →')).toBeInTheDocument();
    });

    it('navigates to settings when clicking manage connections', () => {
      mockBankConnectionService.getConnections.mockReturnValue(mockConnections);
      
      render(<BankConnectionsWidget size="medium" settings={{}} />);
      
      fireEvent.click(screen.getByText('Manage connections →'));
      
      expect(mockNavigate).toHaveBeenCalledWith('/settings/data');
    });

    it('does not show manage link when no connections', () => {
      render(<BankConnectionsWidget size="medium" settings={{}} />);
      
      expect(screen.queryByText('Manage connections →')).not.toBeInTheDocument();
    });
  });

  describe('Reauth Check', () => {
    it('checks for reauth needs on mount', () => {
      mockBankConnectionService.needsReauth.mockReturnValue(['conn3']);
      
      render(<BankConnectionsWidget size="medium" settings={{}} />);
      
      expect(mockBankConnectionService.needsReauth).toHaveBeenCalled();
    });
  });

  describe('Component Styling', () => {
    it('applies correct container styles', () => {
      const { container } = render(<BankConnectionsWidget size="medium" settings={{}} />);
      
      const rootDiv = container.firstChild as HTMLElement;
      expect(rootDiv).toHaveClass('h-full', 'flex', 'flex-col');
    });

    it('applies correct header styles', () => {
      mockBankConnectionService.getConnections.mockReturnValue(mockConnections);
      
      render(<BankConnectionsWidget size="medium" settings={{}} />);
      
      const header = screen.getByText('Bank Connections');
      expect(header).toHaveClass('font-semibold', 'text-gray-900', 'dark:text-white');
    });

    it('applies correct connection item styles', () => {
      mockBankConnectionService.getConnections.mockReturnValue(mockConnections);
      
      render(<BankConnectionsWidget size="medium" settings={{}} />);
      
      const connectionItem = screen.getByText('Chase Bank').closest('div.flex.items-center.gap-3');
      expect(connectionItem).toHaveClass('p-3', 'bg-gray-50', 'dark:bg-gray-700/50', 'rounded-lg');
    });
  });
});