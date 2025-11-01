import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CollaborationWidget from './CollaborationWidget';
import { collaborationService } from '../../services/collaborationService';
import { useNavigate } from 'react-router-dom';
import { toDecimal } from '../../utils/decimal';
import type { Household, ExpenseSplit, Settlement } from '../../services/collaborationService';

const testCurrencySymbols: Record<string, string> = {
  USD: '$',
  GBP: '£',
  EUR: '€',
  CHF: 'CHF',
};

const formatCurrencyMock = (value: any, currency: string = 'USD'): string => {
  const decimalValue = toDecimal(value);
  const isNegative = decimalValue.isNegative();
  const absolute = decimalValue.abs();
  const [integerPart, fractionalPart = ''] = absolute.toFixed(2).split('.');
  const groupedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const symbol = testCurrencySymbols[currency] ?? currency;
  const formatted = `${groupedInteger}.${fractionalPart.padEnd(2, '0')}`;

  if (currency === 'CHF') {
    return `${isNegative ? '-' : ''}${formatted} ${symbol}`;
  }

  return `${isNegative ? '-' : ''}${symbol}${formatted}`;
};

const mockUseCurrencyDecimal = vi.fn();

// Mock dependencies
vi.mock('../../services/collaborationService');
vi.mock('react-router-dom', () => ({
  useNavigate: vi.fn(),
}));
vi.mock('../../hooks/useCurrencyDecimal', () => ({
  useCurrencyDecimal: () => mockUseCurrencyDecimal(),
}));

// Mock icons
vi.mock('../icons', () => ({
  UsersIcon: ({ size, className }: { size?: number; className?: string }) => (
    <div data-testid="UsersIcon" data-size={size} className={className} />
  ),
  DollarSignIcon: ({ size, className }: { size?: number; className?: string }) => (
    <div data-testid="DollarSignIcon" data-size={size} className={className} />
  ),
  ArrowRightIcon: ({ size }: { size?: number }) => (
    <div data-testid="ArrowRightIcon" data-size={size} />
  ),
  AlertCircleIcon: ({ size, className }: { size?: number; className?: string }) => (
    <div data-testid="AlertCircleIcon" data-size={size} className={className} />
  ),
  CheckCircleIcon: ({ size, className }: { size?: number; className?: string }) => (
    <div data-testid="CheckCircleIcon" data-size={size} className={className} />
  ),
  CalendarIcon: ({ size, className }: { size?: number; className?: string }) => (
    <div data-testid="CalendarIcon" data-size={size} className={className} />
  ),
}));

const mockNavigate = vi.fn();
const mockCollaborationService = collaborationService as {
  getCurrentHousehold: Mock;
  getExpenseSplits: Mock;
  calculateSettlements: Mock;
};

// Mock data
const mockHousehold: Household = {
  id: 'h1',
  name: 'Smith Family',
  createdAt: new Date('2024-01-01'),
  ownerId: 'current-user',
  members: [
    {
      id: 'current-user',
      email: 'john@example.com',
      name: 'John Smith',
      role: 'owner',
      permissions: [],
      joinedAt: new Date('2024-01-01'),
      isActive: true,
    },
    {
      id: 'user2',
      email: 'jane@example.com',
      name: 'Jane Smith',
      role: 'admin',
      permissions: [],
      joinedAt: new Date('2024-01-02'),
      isActive: true,
    },
    {
      id: 'user3',
      email: 'kid@example.com',
      name: 'Kid Smith',
      role: 'member',
      permissions: [],
      joinedAt: new Date('2024-01-03'),
      isActive: false,
    },
  ],
  sharedAccounts: [],
  sharedBudgets: [],
  settings: {
    allowExpenseSplitting: true,
    defaultSplitMethod: 'equal',
    requireApprovalForExpenses: false,
    expenseApprovalThreshold: 100,
    currency: 'USD',
    timezone: 'America/New_York',
  },
};

const mockExpenseSplits: ExpenseSplit[] = [
  {
    id: 'split1',
    transactionId: 'tx1',
    totalAmount: toDecimal(120),
    currency: 'USD',
    description: 'Dinner at restaurant',
    createdBy: 'current-user',
    createdAt: new Date('2024-01-15'),
    splits: [
      {
        memberId: 'current-user',
        memberName: 'John Smith',
        amount: toDecimal(60),
        isPaid: true,
        paidAt: new Date('2024-01-15'),
      },
      {
        memberId: 'user2',
        memberName: 'Jane Smith',
        amount: toDecimal(60),
        isPaid: false,
      },
    ],
    status: 'pending',
  },
  {
    id: 'split2',
    transactionId: 'tx2',
    totalAmount: toDecimal(200),
    currency: 'USD',
    description: 'Grocery shopping',
    createdBy: 'user2',
    createdAt: new Date('2024-01-16'),
    splits: [
      {
        memberId: 'current-user',
        memberName: 'John Smith',
        amount: toDecimal(100),
        isPaid: false,
      },
      {
        memberId: 'user2',
        memberName: 'Jane Smith',
        amount: toDecimal(100),
        isPaid: true,
        paidAt: new Date('2024-01-16'),
      },
    ],
    status: 'pending',
  },
  {
    id: 'split3',
    transactionId: 'tx3',
    totalAmount: toDecimal(50),
    currency: 'USD',
    description: 'Movie tickets',
    createdBy: 'current-user',
    createdAt: new Date('2024-01-10'),
    splits: [],
    status: 'settled',
  },
];

const mockSettlements: Settlement[] = [
  {
    id: 'settle1',
    fromMemberId: 'current-user',
    toMemberId: 'user2',
    amount: toDecimal(40),
    currency: 'USD',
    description: 'Settlement for splits',
    relatedSplits: ['split1'],
    status: 'pending',
    createdAt: new Date('2024-01-17'),
  },
  {
    id: 'settle2',
    fromMemberId: 'user3',
    toMemberId: 'current-user',
    amount: toDecimal(25),
    currency: 'USD',
    description: 'Payment owed',
    relatedSplits: [],
    status: 'pending',
    createdAt: new Date('2024-01-18'),
  },
];

describe('CollaborationWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useNavigate as Mock).mockReturnValue(mockNavigate);
    mockUseCurrencyDecimal.mockReturnValue({
      formatCurrency: (value: any, currency?: string) => formatCurrencyMock(value, currency ?? 'USD'),
      displayCurrency: 'USD',
    });
    
    // Default mock values
    mockCollaborationService.getCurrentHousehold.mockReturnValue(mockHousehold);
    mockCollaborationService.getExpenseSplits.mockReturnValue(mockExpenseSplits);
    mockCollaborationService.calculateSettlements.mockReturnValue(mockSettlements);
  });

  describe('Small Size', () => {
    it('renders small size with member count', () => {
      render(<CollaborationWidget size="small" />);
      
      expect(screen.getByText('Household')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument(); // 2 active members
      expect(screen.getByText('Members')).toBeInTheDocument();
      expect(screen.getByTestId('UsersIcon')).toHaveAttribute('data-size', '20');
    });

    it('shows no household message when none exists', () => {
      mockCollaborationService.getCurrentHousehold.mockReturnValue(null);
      
      render(<CollaborationWidget size="small" />);
      
      expect(screen.getByText('No household')).toBeInTheDocument();
    });

    it('navigates to household page on click', () => {
      render(<CollaborationWidget size="small" />);
      
      const container = screen.getByText('Household').closest('.cursor-pointer');
      fireEvent.click(container!);
      
      expect(mockNavigate).toHaveBeenCalledWith('/household');
    });
  });

  describe('No Household State', () => {
    it('shows empty state when no household', () => {
      mockCollaborationService.getCurrentHousehold.mockReturnValue(null);
      mockCollaborationService.getExpenseSplits.mockReturnValue([]);
      mockCollaborationService.calculateSettlements.mockReturnValue([]);
      
      render(<CollaborationWidget />);
      
      expect(screen.getByText('No household setup')).toBeInTheDocument();
      expect(screen.getByText('Create household')).toBeInTheDocument();
    });

    it('navigates to create household', () => {
      mockCollaborationService.getCurrentHousehold.mockReturnValue(null);
      
      render(<CollaborationWidget />);
      
      fireEvent.click(screen.getByText('Create household'));
      expect(mockNavigate).toHaveBeenCalledWith('/household');
    });
  });

  describe('Household Information', () => {
    it('displays household name in header', () => {
      render(<CollaborationWidget />);
      
      expect(screen.getByText('Collaboration')).toBeInTheDocument();
      expect(screen.getByText('Smith Family')).toBeInTheDocument();
    });

    it('shows member and split counts', () => {
      render(<CollaborationWidget />);
      
      expect(screen.getByText('Members')).toBeInTheDocument();
      expect(screen.getByText('Active Splits')).toBeInTheDocument();
      
      // Both values are 2, so we need to get all and check they're both there
      const twoValues = screen.getAllByText('2');
      expect(twoValues).toHaveLength(2);
      expect(twoValues[0]).toBeInTheDocument(); // Members count
      expect(twoValues[1]).toBeInTheDocument(); // Active splits count
    });
  });

  describe('Balance Summary', () => {
    it('shows amount owed to others', () => {
      render(<CollaborationWidget />);
      
      expect(screen.getByText('You owe: $40.00')).toBeInTheDocument();
      expect(screen.getByTestId('AlertCircleIcon')).toBeInTheDocument();
    });

    it('shows amount owed to user', () => {
      render(<CollaborationWidget />);
      
      expect(screen.getByText('Owed to you: $25.00')).toBeInTheDocument();
      const checkIcons = screen.getAllByTestId('CheckCircleIcon');
      expect(checkIcons.length).toBeGreaterThan(0);
    });

    it('handles multiple settlements correctly', () => {
      const multipleSettlements: Settlement[] = [
        ...mockSettlements,
        {
          id: 'settle3',
          fromMemberId: 'current-user',
          toMemberId: 'user3',
          amount: toDecimal(30),
          currency: 'USD',
          description: 'Another payment',
          relatedSplits: [],
          status: 'pending',
          createdAt: new Date('2024-01-19'),
        },
      ];
      
      mockCollaborationService.calculateSettlements.mockReturnValue(multipleSettlements);
      
      render(<CollaborationWidget />);
      
      // Total owed: 40 + 30 = 70
      expect(screen.getByText('You owe: $70.00')).toBeInTheDocument();
    });

    it('does not show balance section when no settlements', () => {
      mockCollaborationService.calculateSettlements.mockReturnValue([]);
      
      render(<CollaborationWidget />);
      
      expect(screen.queryByText(/You owe:/)).not.toBeInTheDocument();
      expect(screen.queryByText(/Owed to you:/)).not.toBeInTheDocument();
    });
  });

  describe('Recent Activity', () => {
    it('shows pending expense splits', () => {
      render(<CollaborationWidget />);
      
      expect(screen.getByText('Recent Activity')).toBeInTheDocument();
      expect(screen.getByText('Dinner at restaurant')).toBeInTheDocument();
      expect(screen.getByText('$120.00')).toBeInTheDocument();
      expect(screen.getByText('Grocery shopping')).toBeInTheDocument();
      expect(screen.getByText('$200.00')).toBeInTheDocument();
    });

    it('limits display to 2 splits', () => {
      const manySplits = [
        ...mockExpenseSplits.filter(s => s.status === 'pending'),
        {
          ...mockExpenseSplits[0],
          id: 'split4',
          description: 'Extra split 1',
        },
        {
          ...mockExpenseSplits[0],
          id: 'split5',
          description: 'Extra split 2',
        },
      ];
      
      mockCollaborationService.getExpenseSplits.mockReturnValue(manySplits);
      
      render(<CollaborationWidget />);
      
      expect(screen.queryByText('Extra split 1')).not.toBeInTheDocument();
      expect(screen.queryByText('Extra split 2')).not.toBeInTheDocument();
      expect(screen.getByText('+2 more')).toBeInTheDocument();
    });

    it('shows no pending splits message', () => {
      mockCollaborationService.getExpenseSplits.mockReturnValue([
        { ...mockExpenseSplits[2] }, // Only settled split
      ]);
      
      render(<CollaborationWidget />);
      
      expect(screen.getByText('No pending splits')).toBeInTheDocument();
    });
  });

  describe('Navigation', () => {
    it('shows manage household button', () => {
      render(<CollaborationWidget />);
      
      const button = screen.getByText('Manage Household');
      expect(button).toBeInTheDocument();
      expect(screen.getByTestId('ArrowRightIcon')).toHaveAttribute('data-size', '14');
    });

    it('navigates to household page on button click', () => {
      render(<CollaborationWidget />);
      
      fireEvent.click(screen.getByText('Manage Household'));
      expect(mockNavigate).toHaveBeenCalledWith('/household');
    });
  });

  describe('Component Structure', () => {
    it('renders with correct header', () => {
      render(<CollaborationWidget />);
      
      expect(screen.getByText('Collaboration')).toBeInTheDocument();
      expect(screen.getByTestId('UsersIcon')).toHaveClass('text-blue-600');
    });

    it('applies correct container styles', () => {
      const { container } = render(<CollaborationWidget />);
      
      const rootDiv = container.firstChild as HTMLElement;
      expect(rootDiv).toHaveClass('h-full', 'flex', 'flex-col');
    });

    it('displays dollar sign icons for splits', () => {
      render(<CollaborationWidget />);
      
      const dollarIcons = screen.getAllByTestId('DollarSignIcon');
      expect(dollarIcons.length).toBe(2); // Two pending splits shown
      expect(dollarIcons[0]).toHaveAttribute('data-size', '12');
    });
  });

  describe('Data Calculation', () => {
    it('filters for pending splits only', () => {
      render(<CollaborationWidget />);
      
      // Should only show pending splits, not settled ones
      expect(screen.getByText('Dinner at restaurant')).toBeInTheDocument();
      expect(screen.getByText('Grocery shopping')).toBeInTheDocument();
      expect(screen.queryByText('Movie tickets')).not.toBeInTheDocument();
    });

    it('counts only active members', () => {
      render(<CollaborationWidget />);
      
      // Should show 2 (active members) not 3 (total members)
      const memberCounts = screen.getAllByText('2');
      expect(memberCounts[0]).toBeInTheDocument();
    });
  });
});
