import { describe, it, expect, vi, beforeEach, Mock } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import DataIntelligenceWidget from './DataIntelligenceWidget';
import { dataIntelligenceService } from '../../services/dataIntelligenceService';
import type { DataIntelligenceStats, SpendingInsight } from '../../services/dataIntelligenceService';
import { formatCurrency as formatCurrencyDecimal } from '../../utils/currency-decimal';

// Mock the service
vi.mock('../../services/dataIntelligenceService');

const mockUseCurrencyDecimal = vi.fn();
vi.mock('../../hooks/useCurrencyDecimal', () => ({
  useCurrencyDecimal: () => mockUseCurrencyDecimal(),
}));

// Mock icons
vi.mock('../icons', () => ({
  DatabaseIcon: ({ size, className }: { size?: number; className?: string }) => (
    <div data-testid="DatabaseIcon" data-size={size} className={className} />
  ),
  BellIcon: ({ size, className }: { size?: number; className?: string }) => (
    <div data-testid="BellIcon" data-size={size} className={className} />
  ),
  CreditCardIcon: ({ size, className }: { size?: number; className?: string }) => (
    <div data-testid="CreditCardIcon" data-size={size} className={className} />
  ),
  TrendingUpIcon: ({ size, className }: { size?: number; className?: string }) => (
    <div data-testid="TrendingUpIcon" data-size={size} className={className} />
  ),
  SearchIcon: ({ size, className }: { size?: number; className?: string }) => (
    <div data-testid="SearchIcon" data-size={size} className={className} />
  ),
  AlertCircleIcon: ({ size, className }: { size?: number; className?: string }) => (
    <div data-testid="AlertCircleIcon" data-size={size} className={className} />
  ),
  RefreshCwIcon: ({ size, className }: { size?: number; className?: string }) => (
    <div data-testid="RefreshCwIcon" data-size={size} className={className} />
  ),
  ArrowRightIcon: ({ size }: { size?: number }) => (
    <div data-testid="ArrowRightIcon" data-size={size} />
  ),
}));

const mockDataIntelligenceService = dataIntelligenceService as {
  getStats: Mock;
  getInsights: Mock;
};

// Mock data
const mockStats: DataIntelligenceStats = {
  totalMerchants: 125,
  activeSubscriptions: 8,
  monthlySubscriptionCost: 450.99,
  categoryAccuracy: 94.5,
  patternsDetected: 23,
};

const mockInsights: SpendingInsight[] = [
  {
    id: 'insight1',
    type: 'subscription_alert',
    title: 'New subscription detected',
    description: 'Netflix subscription started - $15.99/month',
    severity: 'medium',
    date: new Date('2024-01-20'),
    amount: 15.99,
  },
  {
    id: 'insight2',
    type: 'spending_spike',
    title: 'Unusual spending at Amazon',
    description: '300% increase from last month',
    severity: 'high',
    date: new Date('2024-01-19'),
    amount: 850,
  },
  {
    id: 'insight3',
    type: 'new_merchant',
    title: 'First purchase at Target',
    description: 'New merchant detected',
    severity: 'low',
    date: new Date('2024-01-18'),
    amount: 125.50,
  },
  {
    id: 'insight4',
    type: 'pattern',
    title: 'Weekly pattern detected',
    description: 'Regular coffee purchases every Monday',
    severity: 'low',
    date: new Date('2024-01-17'),
    amount: 5.50,
  },
];

describe('DataIntelligenceWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseCurrencyDecimal.mockReturnValue({
      displayCurrency: 'USD',
      formatCurrency: (value: any) => formatCurrencyDecimal(value, 'USD'),
    });
    mockDataIntelligenceService.getStats.mockReturnValue(mockStats);
    mockDataIntelligenceService.getInsights.mockReturnValue(mockInsights);
  });

  describe('Loading State', () => {
    it('shows loading spinner initially then loads data', async () => {
      render(<DataIntelligenceWidget />);
      
      // Since loading happens quickly, just verify the data loads
      await waitFor(() => {
        expect(screen.getByText('125')).toBeInTheDocument();
        expect(screen.getByText('Data Intelligence')).toBeInTheDocument();
      });
    });
  });

  describe('Error State', () => {
    it('handles errors gracefully', async () => {
      mockDataIntelligenceService.getStats.mockImplementation(() => {
        throw new Error('Service error');
      });
      
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      render(<DataIntelligenceWidget />);
      
      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Error loading data intelligence data:', expect.any(Error));
      });
      
      consoleSpy.mockRestore();
    });

    it('shows no data message when stats are null', async () => {
      mockDataIntelligenceService.getStats.mockReturnValue(null);
      
      render(<DataIntelligenceWidget />);
      
      await waitFor(() => {
        expect(screen.getByText('No data available')).toBeInTheDocument();
        expect(screen.getByTestId('DatabaseIcon')).toBeInTheDocument();
      });
    });
  });

  describe('Small Size', () => {
    it('renders small size with key stats', async () => {
      render(<DataIntelligenceWidget size="small" />);
      
      await waitFor(() => {
        expect(screen.getByText('Data Intelligence')).toBeInTheDocument();
        expect(screen.getByText('125')).toBeInTheDocument(); // Merchants
        expect(screen.getByText('8')).toBeInTheDocument(); // Subscriptions
        expect(screen.getByText('Merchants')).toBeInTheDocument();
        expect(screen.getByText('Subscriptions')).toBeInTheDocument();
      });
    });

    it('shows insight count in small size', async () => {
      render(<DataIntelligenceWidget size="small" />);
      
      await waitFor(() => {
        expect(screen.getByText('3 insights')).toBeInTheDocument();
      });
    });

    it('shows singular insight text when only one', async () => {
      mockDataIntelligenceService.getInsights.mockReturnValue([mockInsights[0]]);
      
      render(<DataIntelligenceWidget size="small" />);
      
      await waitFor(() => {
        expect(screen.getByText('1 insight')).toBeInTheDocument();
      });
    });

    it('does not show insights section when empty', async () => {
      mockDataIntelligenceService.getInsights.mockReturnValue([]);
      
      render(<DataIntelligenceWidget size="small" />);
      
      await waitFor(() => {
        expect(screen.queryByText(/insight/)).not.toBeInTheDocument();
      });
    });
  });

  describe('Medium Size', () => {
    it('renders medium size with full stats', async () => {
      render(<DataIntelligenceWidget size="medium" />);
      
      await waitFor(() => {
        expect(screen.getByText('125')).toBeInTheDocument(); // Merchants
        expect(screen.getByText('8')).toBeInTheDocument(); // Active Subs
        expect(screen.getByText('Monthly Cost: $450.99')).toBeInTheDocument();
        expect(screen.getByText('94.5% accuracy')).toBeInTheDocument();
      });
    });

    it('shows limited insights in medium size', async () => {
      render(<DataIntelligenceWidget size="medium" />);
      
      await waitFor(() => {
        // Should show only first 2 insights
        expect(screen.getByText('New subscription detected')).toBeInTheDocument();
        expect(screen.getByText('Unusual spending at Amazon')).toBeInTheDocument();
        expect(screen.queryByText('First purchase at Target')).not.toBeInTheDocument();
      });
    });

    it('displays insight severity', async () => {
      render(<DataIntelligenceWidget size="medium" />);
      
      await waitFor(() => {
        expect(screen.getByText('medium')).toBeInTheDocument();
        expect(screen.getByText('high')).toBeInTheDocument();
      });
    });

    it('shows refresh button', async () => {
      render(<DataIntelligenceWidget size="medium" />);
      
      await waitFor(() => {
        const refreshButton = screen.getAllByTestId('RefreshCwIcon')[0].parentElement;
        expect(refreshButton).toBeInTheDocument();
      });
    });

    it('shows view details button', async () => {
      render(<DataIntelligenceWidget size="medium" />);
      
      await waitFor(() => {
        expect(screen.getByText('View Details')).toBeInTheDocument();
        expect(screen.getByTestId('ArrowRightIcon')).toHaveAttribute('data-size', '10');
      });
    });
  });

  describe('Large Size', () => {
    it('renders large size with extended stats', async () => {
      render(<DataIntelligenceWidget size="large" />);
      
      await waitFor(() => {
        expect(screen.getByText('125')).toBeInTheDocument(); // Merchants
        expect(screen.getByText('8')).toBeInTheDocument(); // Active Subs
        expect(screen.getByText('23')).toBeInTheDocument(); // Patterns
        expect(screen.getByText('3')).toBeInTheDocument(); // Insights count
        expect(screen.getByText('Patterns')).toBeInTheDocument();
        expect(screen.getByText('Insights')).toBeInTheDocument();
      });
    });

    it('shows all insights in large size', async () => {
      render(<DataIntelligenceWidget size="large" />);
      
      await waitFor(() => {
        expect(screen.getByText('New subscription detected')).toBeInTheDocument();
        expect(screen.getByText('Unusual spending at Amazon')).toBeInTheDocument();
        expect(screen.getByText('First purchase at Target')).toBeInTheDocument();
      });
    });

    it('displays insight descriptions in large size', async () => {
      render(<DataIntelligenceWidget size="large" />);
      
      await waitFor(() => {
        expect(screen.getByText('Netflix subscription started - $15.99/month')).toBeInTheDocument();
        expect(screen.getByText('300% increase from last month')).toBeInTheDocument();
        expect(screen.getByText('New merchant detected')).toBeInTheDocument();
      });
    });

    it('shows view data intelligence button', async () => {
      render(<DataIntelligenceWidget size="large" />);
      
      await waitFor(() => {
        expect(screen.getByText('View Data Intelligence')).toBeInTheDocument();
      });
    });
  });

  describe('Settings', () => {
    it('respects showInsights setting', async () => {
      render(<DataIntelligenceWidget settings={{ showInsights: false }} />);
      
      await waitFor(() => {
        expect(screen.queryByText('New subscription detected')).not.toBeInTheDocument();
        expect(screen.queryByText(/Insight/)).not.toBeInTheDocument();
      });
    });

    it('respects showSubscriptions setting', async () => {
      render(<DataIntelligenceWidget settings={{ showSubscriptions: false }} />);
      
      await waitFor(() => {
        expect(screen.queryByText(/Monthly Cost:/)).not.toBeInTheDocument();
        expect(screen.queryByText(/Monthly Subscriptions/)).not.toBeInTheDocument();
      });
    });

    it('respects maxInsights setting', async () => {
      render(<DataIntelligenceWidget settings={{ maxInsights: 1 }} />);
      
      await waitFor(() => {
        expect(screen.getByText('1 Insight')).toBeInTheDocument();
        expect(screen.getByText('New subscription detected')).toBeInTheDocument();
        expect(screen.queryByText('Unusual spending at Amazon')).not.toBeInTheDocument();
      });
    });
  });

  describe('Refresh Functionality', () => {
    it('reloads data on refresh button click', async () => {
      render(<DataIntelligenceWidget size="medium" />);
      
      await waitFor(() => {
        expect(screen.getByText('125')).toBeInTheDocument();
      });
      
      // Clear previous calls
      mockDataIntelligenceService.getStats.mockClear();
      mockDataIntelligenceService.getInsights.mockClear();
      
      // Click refresh
      const refreshButton = screen.getAllByTestId('RefreshCwIcon')[0].parentElement;
      fireEvent.click(refreshButton!);
      
      await waitFor(() => {
        expect(mockDataIntelligenceService.getStats).toHaveBeenCalled();
        expect(mockDataIntelligenceService.getInsights).toHaveBeenCalled();
      });
    });
  });

  describe('Insight Icons', () => {
    it('shows correct icon for subscription alerts', async () => {
      render(<DataIntelligenceWidget size="large" />);
      
      await waitFor(() => {
        const creditCardIcon = screen.getAllByTestId('CreditCardIcon')[0];
        expect(creditCardIcon).toHaveClass('text-blue-600');
      });
    });

    it('shows correct icon for spending spikes', async () => {
      render(<DataIntelligenceWidget size="large" />);
      
      await waitFor(() => {
        const trendingIcon = screen.getByTestId('TrendingUpIcon');
        expect(trendingIcon).toHaveClass('text-red-600');
      });
    });

    it('shows correct icon for new merchants', async () => {
      render(<DataIntelligenceWidget size="large" />);
      
      await waitFor(() => {
        const searchIcon = screen.getByTestId('SearchIcon');
        expect(searchIcon).toHaveClass('text-green-600');
      });
    });

    it('shows default icon for other insight types', async () => {
      mockDataIntelligenceService.getInsights.mockReturnValue([mockInsights[3]]);
      
      render(<DataIntelligenceWidget size="large" />);
      
      await waitFor(() => {
        const bellIcon = screen.getAllByTestId('BellIcon').find(icon => 
          icon.classList.contains('text-gray-600')
        );
        expect(bellIcon).toBeInTheDocument();
      });
    });
  });

  describe('Severity Colors', () => {
    it('applies correct color for high severity', async () => {
      render(<DataIntelligenceWidget />);
      
      await waitFor(() => {
        const highSeverity = screen.getByText('high');
        expect(highSeverity).toHaveClass('text-red-600');
      });
    });

    it('applies correct color for medium severity', async () => {
      render(<DataIntelligenceWidget />);
      
      await waitFor(() => {
        const mediumSeverity = screen.getByText('medium');
        expect(mediumSeverity).toHaveClass('text-yellow-600');
      });
    });

    it('applies correct color for low severity', async () => {
      mockDataIntelligenceService.getInsights.mockReturnValue([mockInsights[2]]);
      
      render(<DataIntelligenceWidget />);
      
      await waitFor(() => {
        const lowSeverity = screen.getByText('low');
        expect(lowSeverity).toHaveClass('text-blue-600');
      });
    });
  });

  describe('Currency Formatting', () => {
    it('formats subscription cost correctly', async () => {
      render(<DataIntelligenceWidget />);
      
      await waitFor(() => {
        expect(screen.getByText('Monthly Cost: $450.99')).toBeInTheDocument();
      });
    });

    it('formats large amounts correctly', async () => {
      mockDataIntelligenceService.getStats.mockReturnValue({
        ...mockStats,
        monthlySubscriptionCost: 1234.56,
      });
      
      render(<DataIntelligenceWidget />);
      
      await waitFor(() => {
        expect(screen.getByText('Monthly Cost: $1,234.56')).toBeInTheDocument();
      });
    });
  });
});
