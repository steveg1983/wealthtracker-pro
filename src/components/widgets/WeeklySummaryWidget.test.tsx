import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import WeeklySummaryWidget from './WeeklySummaryWidget';

// Mock the FinancialSummary component
vi.mock('../FinancialSummary', () => ({
  default: vi.fn(({ period }: { period: string }) => (
    <div data-testid="financial-summary" data-period={period}>
      Financial Summary Mock
    </div>
  )),
}));

describe('WeeklySummaryWidget', () => {
  describe('Component Structure', () => {
    it('renders with small size', () => {
      render(<WeeklySummaryWidget size="small" settings={{}} />);
      
      expect(screen.getByTestId('financial-summary')).toBeInTheDocument();
    });

    it('renders with medium size', () => {
      render(<WeeklySummaryWidget size="medium" settings={{}} />);
      
      expect(screen.getByTestId('financial-summary')).toBeInTheDocument();
    });

    it('renders with large size', () => {
      render(<WeeklySummaryWidget size="large" settings={{}} />);
      
      expect(screen.getByTestId('financial-summary')).toBeInTheDocument();
    });
  });

  describe('FinancialSummary Integration', () => {
    it('passes weekly period to FinancialSummary', () => {
      render(<WeeklySummaryWidget size="medium" settings={{}} />);
      
      const financialSummary = screen.getByTestId('financial-summary');
      expect(financialSummary).toHaveAttribute('data-period', 'weekly');
    });

    it('renders FinancialSummary component', () => {
      render(<WeeklySummaryWidget size="medium" settings={{}} />);
      
      expect(screen.getByText('Financial Summary Mock')).toBeInTheDocument();
    });
  });

  describe('Container Styling', () => {
    it('applies proper container classes', () => {
      const { container } = render(<WeeklySummaryWidget size="medium" settings={{}} />);
      
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('h-full', 'overflow-auto');
    });
  });

  describe('Props Handling', () => {
    it('accepts and ignores settings prop', () => {
      const settings = {
        customSetting: 'value',
        anotherSetting: 123,
        booleanSetting: true,
      };
      
      render(<WeeklySummaryWidget size="medium" settings={settings} />);
      
      expect(screen.getByTestId('financial-summary')).toBeInTheDocument();
    });

    it('handles empty settings object', () => {
      render(<WeeklySummaryWidget size="medium" settings={{}} />);
      
      expect(screen.getByTestId('financial-summary')).toBeInTheDocument();
    });

    it('renders consistently regardless of size prop', () => {
      const { rerender } = render(<WeeklySummaryWidget size="small" settings={{}} />);
      
      const smallSummary = screen.getByTestId('financial-summary');
      expect(smallSummary).toHaveAttribute('data-period', 'weekly');
      
      rerender(<WeeklySummaryWidget size="medium" settings={{}} />);
      expect(screen.getByTestId('financial-summary')).toHaveAttribute('data-period', 'weekly');
      
      rerender(<WeeklySummaryWidget size="large" settings={{}} />);
      expect(screen.getByTestId('financial-summary')).toHaveAttribute('data-period', 'weekly');
    });
  });

  describe('Return Type', () => {
    it('returns a React JSX element', () => {
      const result = WeeklySummaryWidget({ size: 'medium', settings: {} });
      
      expect(result).toBeDefined();
      expect(result.type).toBe('div');
      expect(result.props.className).toBe('h-full overflow-auto');
    });
  });
});