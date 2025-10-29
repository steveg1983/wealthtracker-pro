import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import MonthlySummaryWidget from './MonthlySummaryWidget';

// Mock the FinancialSummary component
vi.mock('../FinancialSummary', () => ({
  default: vi.fn(({ period }: { period: string }) => (
    <div data-testid="financial-summary" data-period={period}>
      Financial Summary Mock
    </div>
  )),
}));

describe('MonthlySummaryWidget', () => {
  describe('Component Structure', () => {
    it('renders with small size', () => {
      render(<MonthlySummaryWidget size="small" settings={{}} />);
      
      expect(screen.getByTestId('financial-summary')).toBeInTheDocument();
    });

    it('renders with medium size', () => {
      render(<MonthlySummaryWidget size="medium" settings={{}} />);
      
      expect(screen.getByTestId('financial-summary')).toBeInTheDocument();
    });

    it('renders with large size', () => {
      render(<MonthlySummaryWidget size="large" settings={{}} />);
      
      expect(screen.getByTestId('financial-summary')).toBeInTheDocument();
    });
  });

  describe('FinancialSummary Integration', () => {
    it('passes monthly period to FinancialSummary', () => {
      render(<MonthlySummaryWidget size="medium" settings={{}} />);
      
      const financialSummary = screen.getByTestId('financial-summary');
      expect(financialSummary).toHaveAttribute('data-period', 'monthly');
    });

    it('renders FinancialSummary component', () => {
      render(<MonthlySummaryWidget size="medium" settings={{}} />);
      
      expect(screen.getByText('Financial Summary Mock')).toBeInTheDocument();
    });
  });

  describe('Container Styling', () => {
    it('applies proper container classes', () => {
      const { container } = render(<MonthlySummaryWidget size="medium" settings={{}} />);
      
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
      
      render(<MonthlySummaryWidget size="medium" settings={settings} />);
      
      expect(screen.getByTestId('financial-summary')).toBeInTheDocument();
    });

    it('handles empty settings object', () => {
      render(<MonthlySummaryWidget size="medium" settings={{}} />);
      
      expect(screen.getByTestId('financial-summary')).toBeInTheDocument();
    });

    it('renders consistently regardless of size prop', () => {
      const { rerender } = render(<MonthlySummaryWidget size="small" settings={{}} />);
      
      const smallSummary = screen.getByTestId('financial-summary');
      expect(smallSummary).toHaveAttribute('data-period', 'monthly');
      
      rerender(<MonthlySummaryWidget size="medium" settings={{}} />);
      expect(screen.getByTestId('financial-summary')).toHaveAttribute('data-period', 'monthly');
      
      rerender(<MonthlySummaryWidget size="large" settings={{}} />);
      expect(screen.getByTestId('financial-summary')).toHaveAttribute('data-period', 'monthly');
    });
  });
});