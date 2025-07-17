import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import React from 'react';
import { AppProvider } from '../../contexts/AppContext';
import { PreferencesProvider } from '../../contexts/PreferencesContext';
import { createMockAccount, createMockTransaction } from '../factories';
import Dashboard from '../../pages/Dashboard';
import { formatCurrency, getCurrencySymbol } from '../../utils/currency';
import { toDecimal } from '../../utils/decimal';
import { useCurrencyDecimal } from '../../hooks/useCurrencyDecimal';

// Mock the router
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => vi.fn(),
    useParams: () => ({}),
    useLocation: () => ({ pathname: '/' }),
  };
});

// Mock currency conversion service
vi.mock('../../services/currencyService', () => ({
  convertCurrency: vi.fn((amount: number, from: string, to: string) => {
    // Mock exchange rates
    const rates: Record<string, Record<string, number>> = {
      'GBP': { 'USD': 1.25, 'EUR': 1.15, 'JPY': 150 },
      'USD': { 'GBP': 0.8, 'EUR': 0.92, 'JPY': 120 },
      'EUR': { 'GBP': 0.87, 'USD': 1.09, 'JPY': 130 },
      'JPY': { 'GBP': 0.0067, 'USD': 0.0083, 'EUR': 0.0077 },
    };
    
    if (from === to) return Promise.resolve(amount);
    return Promise.resolve(amount * (rates[from]?.[to] || 1));
  }),
}));

describe('Currency Integration Tests', () => {
  const renderWithProviders = (component: React.ReactElement, initialData = {}, preferences = {}) => {
    const mockData = {
      accounts: [],
      transactions: [],
      budgets: [],
      goals: [],
      ...initialData,
    };

    const defaultPreferences = {
      currency: 'GBP',
      theme: 'light',
      ...preferences,
    };

    // Mock localStorage
    const storage = new Map();
    Object.entries(mockData).forEach(([key, value]) => {
      storage.set(`wealthtracker_${key}`, JSON.stringify(value));
    });
    storage.set('wealthtracker_preferences', JSON.stringify(defaultPreferences));

    vi.mocked(localStorage.getItem).mockImplementation(key => storage.get(key) || null);
    vi.mocked(localStorage.setItem).mockImplementation((key, value) => {
      storage.set(key, value);
    });

    return render(
      <PreferencesProvider>
        <AppProvider>
          {component}
        </AppProvider>
      </PreferencesProvider>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Setup fresh localStorage mock
    const storage = new Map();
    vi.mocked(localStorage.getItem).mockImplementation(key => storage.get(key) || null);
    vi.mocked(localStorage.setItem).mockImplementation((key, value) => {
      storage.set(key, value);
    });
  });

  describe('Currency Formatting', () => {
    it('formats GBP currency correctly', () => {
      const amount = 1234.56;
      const formatted = formatCurrency(amount, 'GBP');
      expect(formatted).toBe('£1,234.56');
    });

    it('formats USD currency correctly', () => {
      const amount = 1234.56;
      const formatted = formatCurrency(amount, 'USD');
      expect(formatted).toBe('$1,234.56');
    });

    it('formats EUR currency correctly', () => {
      const amount = 1234.56;
      const formatted = formatCurrency(amount, 'EUR');
      expect(formatted).toBe('€1,234.56');
    });

    it('formats JPY currency correctly', () => {
      const amount = 123456;
      const formatted = formatCurrency(amount, 'JPY');
      expect(formatted).toBe('¥123,456');
    });

    it('formats negative amounts correctly', () => {
      expect(formatCurrency(-1234.56, 'GBP')).toBe('-£1,234.56');
      expect(formatCurrency(-1234.56, 'USD')).toBe('-$1,234.56');
      expect(formatCurrency(-1234.56, 'EUR')).toBe('-€1,234.56');
    });

    it('formats zero amounts correctly', () => {
      expect(formatCurrency(0, 'GBP')).toBe('£0.00');
      expect(formatCurrency(0, 'USD')).toBe('$0.00');
      expect(formatCurrency(0, 'EUR')).toBe('€0.00');
    });

    it('handles very large amounts', () => {
      const largeAmount = 1234567890.12;
      const formatted = formatCurrency(largeAmount, 'GBP');
      expect(formatted).toBe('£1,234,567,890.12');
    });

    it('handles very small amounts', () => {
      const smallAmount = 0.01;
      const formatted = formatCurrency(smallAmount, 'GBP');
      expect(formatted).toBe('£0.01');
    });
  });

  describe('Currency Symbols', () => {
    it('returns correct symbols for major currencies', () => {
      expect(getCurrencySymbol('GBP')).toBe('£');
      expect(getCurrencySymbol('USD')).toBe('$');
      expect(getCurrencySymbol('EUR')).toBe('€');
      expect(getCurrencySymbol('JPY')).toBe('¥');
    });

    it('returns currency code for unknown currencies', () => {
      expect(getCurrencySymbol('XYZ')).toBe('XYZ');
    });
  });

  describe('Multi-Currency Account Display', () => {
    it('displays accounts with different currencies correctly', async () => {
      const accounts = [
        createMockAccount({ id: '1', name: 'UK Checking', balance: 1000, currency: 'GBP' }),
        createMockAccount({ id: '2', name: 'US Savings', balance: 1500, currency: 'USD' }),
        createMockAccount({ id: '3', name: 'EU Investment', balance: 2000, currency: 'EUR' }),
        createMockAccount({ id: '4', name: 'JP Cash', balance: 50000, currency: 'JPY' }),
      ];

      renderWithProviders(<Dashboard />, { accounts }, { currency: 'GBP' });

      await waitFor(() => {
        // Should display all account names
        expect(screen.getByText('UK Checking')).toBeInTheDocument();
        expect(screen.getByText('US Savings')).toBeInTheDocument();
        expect(screen.getByText('EU Investment')).toBeInTheDocument();
        expect(screen.getByText('JP Cash')).toBeInTheDocument();
      });
    });

    it('shows original currency amounts alongside converted amounts', async () => {
      const accounts = [
        createMockAccount({ id: '1', name: 'USD Account', balance: 1000, currency: 'USD' }),
      ];

      renderWithProviders(<Dashboard />, { accounts }, { currency: 'GBP' });

      await waitFor(() => {
        // Should show both converted and original amounts
        expect(screen.getByText('USD Account')).toBeInTheDocument();
        // Would show £800 (converted) and $1,000 (original)
        expect(screen.getByText(/800/)).toBeInTheDocument();
      });
    });
  });

  describe('Currency Conversion Accuracy', () => {
    it('maintains decimal precision during conversion', () => {
      // Test precision with decimal amounts
      const amount = toDecimal('1234.56');
      const rate = toDecimal('1.25');
      const converted = amount.times(rate);
      
      expect(converted.toString()).toBe('1543.2');
    });

    it('handles rounding correctly for display currencies', () => {
      // JPY doesn't have decimal places
      const amount = toDecimal('100.456');
      const convertedJPY = amount.times(toDecimal('150')); // Convert to JPY
      const roundedJPY = convertedJPY.toDecimalPlaces(0);
      
      expect(roundedJPY.toString()).toBe('15068');
    });

    it('preserves precision in round-trip conversions', () => {
      const originalAmount = toDecimal('1000.00');
      const usdRate = toDecimal('1.25');
      const gbpRate = toDecimal('0.80');
      
      // Convert GBP -> USD -> GBP
      const toUSD = originalAmount.times(usdRate);
      const backToGBP = toUSD.times(gbpRate);
      
      expect(backToGBP.toString()).toBe('1000');
    });
  });

  describe('Currency Preference Changes', () => {
    it('updates all displayed amounts when currency preference changes', async () => {
      const accounts = [
        createMockAccount({ id: '1', name: 'Test Account', balance: 1000, currency: 'USD' }),
      ];

      const { rerender } = renderWithProviders(<Dashboard />, { accounts }, { currency: 'GBP' });

      await waitFor(() => {
        // Should show converted GBP amount (1000 * 0.8 = 800)
        expect(screen.getByText(/800/)).toBeInTheDocument();
      });

      // Change preference to USD
      rerender(
        <PreferencesProvider>
          <AppProvider>
            <Dashboard />
          </AppProvider>
        </PreferencesProvider>
      );

      await waitFor(() => {
        // Should now show original USD amount
        expect(screen.getByText(/1[,.]000/)).toBeInTheDocument();
      });
    });
  });

  describe('Multi-Currency Transactions', () => {
    it('handles transactions in different currencies', async () => {
      const accounts = [
        createMockAccount({ id: '1', name: 'GBP Account', balance: 1000, currency: 'GBP' }),
        createMockAccount({ id: '2', name: 'USD Account', balance: 1250, currency: 'USD' }),
      ];

      const transactions = [
        createMockTransaction({ 
          id: '1', 
          amount: 100, 
          type: 'expense', 
          accountId: '1', 
          description: 'GBP Transaction' 
        }),
        createMockTransaction({ 
          id: '2', 
          amount: 125, 
          type: 'expense', 
          accountId: '2', 
          description: 'USD Transaction' 
        }),
      ];

      renderWithProviders(<Dashboard />, { accounts, transactions }, { currency: 'GBP' });

      await waitFor(() => {
        expect(screen.getByText('GBP Transaction')).toBeInTheDocument();
        expect(screen.getByText('USD Transaction')).toBeInTheDocument();
      });
    });

    it('correctly calculates totals across multiple currencies', () => {
      const amounts = [
        { amount: toDecimal('1000'), currency: 'GBP' },
        { amount: toDecimal('1250'), currency: 'USD' }, // = 1000 GBP
        { amount: toDecimal('1150'), currency: 'EUR' }, // = 1000 GBP
      ];

      // Convert all to GBP
      const rates = {
        'GBP': toDecimal('1'),
        'USD': toDecimal('0.8'),
        'EUR': toDecimal('0.87'),
      };

      const totalInGBP = amounts.reduce((sum, item) => {
        const rate = rates[item.currency as keyof typeof rates];
        const convertedAmount = item.amount.times(rate);
        return sum.plus(convertedAmount);
      }, toDecimal('0'));

      expect(totalInGBP.toString()).toBe('3000.5');
    });
  });

  describe('Currency-Specific Number Formatting', () => {
    it('formats Japanese Yen without decimal places', () => {
      const amount = 123456.789;
      const formatted = formatCurrency(amount, 'JPY');
      expect(formatted).toBe('¥123,457'); // Should round to whole number
    });

    it('formats currencies with appropriate decimal places', () => {
      const amount = 123.456789;
      
      // Most currencies use 2 decimal places
      expect(formatCurrency(amount, 'GBP')).toBe('£123.46');
      expect(formatCurrency(amount, 'USD')).toBe('$123.46');
      expect(formatCurrency(amount, 'EUR')).toBe('€123.46');
      
      // JPY uses 0 decimal places
      expect(formatCurrency(amount, 'JPY')).toBe('¥123');
    });

    it('handles thousand separators correctly for different locales', () => {
      const amount = 1234567.89;
      
      // English-style formatting (comma thousands separator)
      expect(formatCurrency(amount, 'GBP')).toBe('£1,234,567.89');
      expect(formatCurrency(amount, 'USD')).toBe('$1,234,567.89');
      expect(formatCurrency(amount, 'EUR')).toBe('€1,234,567.89');
    });
  });

  describe('Currency Conversion Edge Cases', () => {
    it('handles conversion when source and target currencies are the same', () => {
      const amount = toDecimal('1000');
      const converted = amount.times(toDecimal('1')); // Same currency rate
      
      expect(converted.toString()).toBe('1000');
    });

    it('handles very small exchange rates', () => {
      // Example: 1 GBP = 0.0001 BTC (hypothetical)
      const amount = toDecimal('1000');
      const smallRate = toDecimal('0.0001');
      const converted = amount.times(smallRate);
      
      expect(converted.toString()).toBe('0.1');
    });

    it('handles very large exchange rates', () => {
      // Example: 1 USD = 1000000 VND (hypothetical)
      const amount = toDecimal('1');
      const largeRate = toDecimal('1000000');
      const converted = amount.times(largeRate);
      
      expect(converted.toString()).toBe('1000000');
    });

    it('maintains precision with complex exchange rate calculations', () => {
      // Test chain conversions: GBP -> USD -> EUR -> GBP
      const original = toDecimal('1000');
      const gbpToUsd = toDecimal('1.25');
      const usdToEur = toDecimal('0.92');
      const eurToGbp = toDecimal('0.87');
      
      const toUsd = original.times(gbpToUsd);
      const toEur = toUsd.times(usdToEur);
      const backToGbp = toEur.times(eurToGbp);
      
      // Should be close to original with small rounding difference
      expect(backToGbp.toDecimalPlaces(2).toString()).toBe('1000.50');
    });
  });

  describe('Currency Display in Different Contexts', () => {
    it('displays currency correctly in account summaries', async () => {
      const accounts = [
        createMockAccount({ id: '1', name: 'Multi-Currency Account', balance: 1000, currency: 'USD' }),
      ];

      renderWithProviders(<Dashboard />, { accounts }, { currency: 'GBP' });

      await waitFor(() => {
        expect(screen.getByText('Multi-Currency Account')).toBeInTheDocument();
        // Should show converted amount in GBP
        expect(screen.getByText(/£/)).toBeInTheDocument();
      });
    });

    it('shows appropriate currency symbols in transaction lists', async () => {
      const accounts = [
        createMockAccount({ id: '1', name: 'Account', balance: 1000, currency: 'EUR' }),
      ];

      const transactions = [
        createMockTransaction({ 
          id: '1', 
          amount: 100, 
          type: 'expense', 
          accountId: '1', 
          description: 'EUR Transaction' 
        }),
      ];

      renderWithProviders(<Dashboard />, { accounts, transactions }, { currency: 'EUR' });

      await waitFor(() => {
        expect(screen.getByText('EUR Transaction')).toBeInTheDocument();
        // Should show EUR symbol
        expect(screen.getByText(/€/)).toBeInTheDocument();
      });
    });
  });

  describe('Currency Hook Integration', () => {
    // Test component that uses the currency hook
    const CurrencyTestComponent = () => {
      const { formatCurrency, displayCurrency, getCurrencySymbol } = useCurrencyDecimal();
      
      return (
        <div>
          <div data-testid="display-currency">{displayCurrency}</div>
          <div data-testid="currency-symbol">{getCurrencySymbol(displayCurrency)}</div>
          <div data-testid="formatted-amount">{formatCurrency(1234.56)}</div>
        </div>
      );
    };

    it('provides correct currency information through hook', () => {
      renderWithProviders(<CurrencyTestComponent />, {}, { currency: 'USD' });

      expect(screen.getByTestId('display-currency')).toHaveTextContent('USD');
      expect(screen.getByTestId('currency-symbol')).toHaveTextContent('$');
      expect(screen.getByTestId('formatted-amount')).toHaveTextContent('$1,234.56');
    });

    it('updates when currency preference changes', () => {
      const { rerender } = renderWithProviders(<CurrencyTestComponent />, {}, { currency: 'GBP' });

      expect(screen.getByTestId('display-currency')).toHaveTextContent('GBP');
      expect(screen.getByTestId('currency-symbol')).toHaveTextContent('£');

      // Mock preference change
      const storage = new Map();
      storage.set('wealthtracker_preferences', JSON.stringify({ currency: 'EUR' }));
      vi.mocked(localStorage.getItem).mockImplementation(key => storage.get(key) || null);

      rerender(
        <PreferencesProvider>
          <AppProvider>
            <CurrencyTestComponent />
          </AppProvider>
        </PreferencesProvider>
      );

      expect(screen.getByTestId('display-currency')).toHaveTextContent('EUR');
      expect(screen.getByTestId('currency-symbol')).toHaveTextContent('€');
    });
  });
});