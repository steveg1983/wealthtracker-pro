import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SankeyChart from './SankeyChart';
import type { Transaction, Account } from '../../types';

// Mock hooks and contexts
const mockCategories = [
  { id: 'cat1', name: 'Salary', type: 'income', level: 'category', color: '#10B981' },
  { id: 'cat2', name: 'Freelance', type: 'income', level: 'category', color: '#10B981' },
  { id: 'cat3', name: 'Food', type: 'expense', level: 'category', color: '#EF4444' },
  { id: 'cat4', name: 'Transport', type: 'expense', level: 'category', color: '#EF4444' },
  { id: 'cat5', name: 'Utilities', type: 'expense', level: 'category', color: '#EF4444' }
];

vi.mock('../../contexts/AppContext', () => ({
  useApp: () => ({
    categories: mockCategories
  })
}));

vi.mock('../../hooks/useCurrencyDecimal', () => ({
  useCurrencyDecimal: () => ({
    formatCurrency: (amount: number) => `$${amount.toFixed(2)}`
  })
}));

describe('SankeyChart', () => {
  const mockAccounts: Account[] = [
    {
      id: 'acc1',
      name: 'Checking Account',
      type: 'checking',
      balance: 5000,
      currency: 'USD',
      lastUpdated: new Date()
    },
    {
      id: 'acc2',
      name: 'Savings Account',
      type: 'savings',
      balance: 10000,
      currency: 'USD',
      lastUpdated: new Date()
    }
  ];

  const mockTransactions: Transaction[] = [
    // Income transactions
    {
      id: 'trans1',
      date: new Date('2024-01-01'),
      amount: 3000,
      description: 'Monthly Salary',
      category: 'cat1',
      accountId: 'acc1',
      type: 'income'
    },
    {
      id: 'trans2',
      date: new Date('2024-01-05'),
      amount: 500,
      description: 'Freelance Project',
      category: 'cat2',
      accountId: 'acc1',
      type: 'income'
    },
    // Expense transactions
    {
      id: 'trans3',
      date: new Date('2024-01-10'),
      amount: 800,
      description: 'Grocery Shopping',
      category: 'cat3',
      accountId: 'acc1',
      type: 'expense'
    },
    {
      id: 'trans4',
      date: new Date('2024-01-15'),
      amount: 200,
      description: 'Gas',
      category: 'cat4',
      accountId: 'acc1',
      type: 'expense'
    },
    {
      id: 'trans5',
      date: new Date('2024-01-20'),
      amount: 150,
      description: 'Electric Bill',
      category: 'cat5',
      accountId: 'acc1',
      type: 'expense'
    }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders SVG container', () => {
      render(<SankeyChart transactions={mockTransactions} accounts={mockAccounts} />);
      
      const svg = document.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(svg).toHaveAttribute('width', '800');
      expect(svg).toHaveAttribute('height', '600');
    });

    it('renders container with correct classes', () => {
      const { container } = render(
        <SankeyChart transactions={mockTransactions} accounts={mockAccounts} />
      );
      
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('h-full');
      expect(wrapper).toHaveClass('min-h-[300px]');
      expect(wrapper).toHaveClass('flex');
      expect(wrapper).toHaveClass('flex-col');
    });

    it('renders legend section', () => {
      render(<SankeyChart transactions={mockTransactions} accounts={mockAccounts} />);
      
      // Look for legend items specifically
      const legendSection = document.querySelector('.flex.flex-wrap.gap-4.mt-4.justify-center');
      expect(legendSection).toBeInTheDocument();
      
      // Check legend text
      const legendTexts = Array.from(legendSection?.querySelectorAll('.text-sm.text-gray-600') || [])
        .map(el => el.textContent);
      
      expect(legendTexts).toContain('Income');
      expect(legendTexts).toContain('Accounts');
      expect(legendTexts).toContain('Expenses');
    });

    it('renders legend with correct colors', () => {
      const { container } = render(
        <SankeyChart transactions={mockTransactions} accounts={mockAccounts} />
      );
      
      const incomeIndicator = container.querySelector('.bg-green-500');
      const accountsIndicator = container.querySelector('.bg-indigo-500');
      const expensesIndicator = container.querySelector('.bg-red-500');
      
      expect(incomeIndicator).toBeInTheDocument();
      expect(accountsIndicator).toBeInTheDocument();
      expect(expensesIndicator).toBeInTheDocument();
    });
  });

  describe('Data Processing', () => {
    it('processes income transactions correctly', () => {
      render(<SankeyChart transactions={mockTransactions} accounts={mockAccounts} />);
      
      // Check for income category nodes
      expect(screen.getByText('Salary')).toBeInTheDocument();
      expect(screen.getByText('Freelance')).toBeInTheDocument();
    });

    it('processes expense transactions correctly', () => {
      render(<SankeyChart transactions={mockTransactions} accounts={mockAccounts} />);
      
      // Check for expense category nodes
      expect(screen.getByText('Food')).toBeInTheDocument();
      expect(screen.getByText('Transport')).toBeInTheDocument();
      expect(screen.getByText('Utilities')).toBeInTheDocument();
    });

    it('creates central Accounts node', () => {
      render(<SankeyChart transactions={mockTransactions} accounts={mockAccounts} />);
      
      // Check for Accounts node in the SVG
      const accountsNodes = Array.from(document.querySelectorAll('text'))
        .filter(el => el.textContent === 'Accounts');
      expect(accountsNodes.length).toBeGreaterThan(0);
    });

    it('handles transactions without categories', () => {
      const transactionsWithoutCategory = [
        ...mockTransactions,
        {
          id: 'trans6',
          date: new Date('2024-01-25'),
          amount: 100,
          description: 'Unknown Income',
          category: 'unknown',
          accountId: 'acc1',
          type: 'income' as const
        },
        {
          id: 'trans7',
          date: new Date('2024-01-26'),
          amount: 50,
          description: 'Unknown Expense',
          category: 'unknown2',
          accountId: 'acc1',
          type: 'expense' as const
        }
      ];
      
      render(<SankeyChart transactions={transactionsWithoutCategory} accounts={mockAccounts} />);
      
      expect(screen.getByText('Other Income')).toBeInTheDocument();
      expect(screen.getByText('Other Expenses')).toBeInTheDocument();
    });

    it('aggregates amounts by category', () => {
      const multipleTransactions = [
        {
          id: 't1',
          date: new Date('2024-01-01'),
          amount: 100,
          description: 'Food 1',
          category: 'cat3',
          accountId: 'acc1',
          type: 'expense' as const
        },
        {
          id: 't2',
          date: new Date('2024-01-02'),
          amount: 200,
          description: 'Food 2',
          category: 'cat3',
          accountId: 'acc1',
          type: 'expense' as const
        }
      ];
      
      render(<SankeyChart transactions={multipleTransactions} accounts={mockAccounts} />);
      
      // Both transactions should be aggregated under Food category
      expect(screen.getByText('Food')).toBeInTheDocument();
    });
  });

  describe('SVG Elements', () => {
    it('renders links group', () => {
      render(<SankeyChart transactions={mockTransactions} accounts={mockAccounts} />);
      
      const linksGroup = document.querySelector('.links');
      expect(linksGroup).toBeInTheDocument();
    });

    it('renders nodes group', () => {
      render(<SankeyChart transactions={mockTransactions} accounts={mockAccounts} />);
      
      const nodesGroup = document.querySelector('.nodes');
      expect(nodesGroup).toBeInTheDocument();
    });

    it('renders paths for links', () => {
      render(<SankeyChart transactions={mockTransactions} accounts={mockAccounts} />);
      
      const paths = document.querySelectorAll('path');
      
      // Should have paths for income->accounts and accounts->expenses
      expect(paths.length).toBeGreaterThan(0);
    });

    it('renders rectangles for nodes', () => {
      render(<SankeyChart transactions={mockTransactions} accounts={mockAccounts} />);
      
      const rects = document.querySelectorAll('rect');
      
      // Should have rectangles for each node
      expect(rects.length).toBeGreaterThan(0);
    });

    it('applies correct colors to nodes', () => {
      render(<SankeyChart transactions={mockTransactions} accounts={mockAccounts} />);
      
      const rects = document.querySelectorAll('rect');
      
      // Check that some rectangles have the expected colors
      const colors = Array.from(rects).map(rect => rect.getAttribute('fill'));
      expect(colors).toContain('#10B981'); // Income color
      expect(colors).toContain('#6366F1'); // Accounts color
      expect(colors).toContain('#EF4444'); // Expense color
    });
  });

  describe('Tooltips', () => {
    it('renders tooltips on paths', () => {
      render(<SankeyChart transactions={mockTransactions} accounts={mockAccounts} />);
      
      const titles = document.querySelectorAll('title');
      
      expect(titles.length).toBeGreaterThan(0);
    });

    it('formats tooltip values correctly', () => {
      render(<SankeyChart transactions={mockTransactions} accounts={mockAccounts} />);
      
      const titles = document.querySelectorAll('title');
      
      // Check that tooltips contain formatted currency
      const tooltipTexts = Array.from(titles).map(t => t.textContent);
      expect(tooltipTexts.some(text => text?.includes('$'))).toBe(true);
    });
  });

  describe('Interaction', () => {
    it('applies hover styles to paths', () => {
      render(<SankeyChart transactions={mockTransactions} accounts={mockAccounts} />);
      
      const paths = document.querySelectorAll('path');
      
      paths.forEach(path => {
        expect(path).toHaveClass('hover:opacity-50');
        expect(path).toHaveClass('transition-opacity');
      });
    });

    it('applies hover styles to nodes', () => {
      render(<SankeyChart transactions={mockTransactions} accounts={mockAccounts} />);
      
      const rects = document.querySelectorAll('rect');
      
      rects.forEach(rect => {
        expect(rect).toHaveClass('hover:opacity-80');
        expect(rect).toHaveClass('transition-opacity');
      });
    });
  });

  describe('Edge Cases', () => {
    it('handles empty transactions', () => {
      render(<SankeyChart transactions={[]} accounts={mockAccounts} />);
      
      // Should still render the SVG and legend
      const svg = document.querySelector('svg');
      expect(svg).toBeInTheDocument();
      expect(screen.getByText('Income')).toBeInTheDocument();
    });

    it('handles transactions with zero amounts', () => {
      const zeroTransactions = [
        {
          id: 'zero1',
          date: new Date('2024-01-01'),
          amount: 0,
          description: 'Zero Income',
          category: 'cat1',
          accountId: 'acc1',
          type: 'income' as const
        }
      ];
      
      render(<SankeyChart transactions={zeroTransactions} accounts={mockAccounts} />);
      
      // Should handle zero amounts gracefully
      const svg = document.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('handles only income transactions', () => {
      const incomeOnly = mockTransactions.filter(t => t.type === 'income');
      
      render(<SankeyChart transactions={incomeOnly} accounts={mockAccounts} />);
      
      // Should show income nodes and accounts
      expect(screen.getByText('Salary')).toBeInTheDocument();
      expect(screen.getByText('Freelance')).toBeInTheDocument();
      
      // Check for Accounts node
      const accountsNodes = Array.from(document.querySelectorAll('text'))
        .filter(el => el.textContent === 'Accounts');
      expect(accountsNodes.length).toBeGreaterThan(0);
    });

    it('handles only expense transactions', () => {
      const expenseOnly = mockTransactions.filter(t => t.type === 'expense');
      
      render(<SankeyChart transactions={expenseOnly} accounts={mockAccounts} />);
      
      // Should show expense nodes and accounts
      expect(screen.getByText('Food')).toBeInTheDocument();
      expect(screen.getByText('Transport')).toBeInTheDocument();
      
      // Check for Accounts node
      const accountsNodes = Array.from(document.querySelectorAll('text'))
        .filter(el => el.textContent === 'Accounts');
      expect(accountsNodes.length).toBeGreaterThan(0);
    });

    it('handles very large amounts', () => {
      const largeTransactions = [
        {
          id: 'large1',
          date: new Date('2024-01-01'),
          amount: 1000000,
          description: 'Large Income',
          category: 'cat1',
          accountId: 'acc1',
          type: 'income' as const
        },
        {
          id: 'large2',
          date: new Date('2024-01-01'),
          amount: 999999,
          description: 'Large Expense',
          category: 'cat3',
          accountId: 'acc1',
          type: 'expense' as const
        }
      ];
      
      render(<SankeyChart transactions={largeTransactions} accounts={mockAccounts} />);
      
      // Should handle large amounts without breaking
      const svg = document.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('handles negative amounts', () => {
      const negativeTransactions = [
        {
          id: 'neg1',
          date: new Date('2024-01-01'),
          amount: -100,
          description: 'Refund',
          category: 'cat3',
          accountId: 'acc1',
          type: 'expense' as const
        }
      ];
      
      render(<SankeyChart transactions={negativeTransactions} accounts={mockAccounts} />);
      
      // Should handle negative amounts
      const svg = document.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });
  });

  describe('Responsiveness', () => {
    it('has scrollable container', () => {
      const { container } = render(
        <SankeyChart transactions={mockTransactions} accounts={mockAccounts} />
      );
      
      const scrollContainer = container.querySelector('.overflow-x-auto');
      expect(scrollContainer).toBeInTheDocument();
    });

    it('centers SVG with mx-auto', () => {
      render(<SankeyChart transactions={mockTransactions} accounts={mockAccounts} />);
      
      const svg = document.querySelector('svg');
      expect(svg).toHaveClass('mx-auto');
    });
  });
});
