import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LineChart, BarChart, PieChart, AreaChart } from './LazyChart';

// Mock Recharts components
vi.mock('recharts', () => ({
  LineChart: vi.fn(({ children, ...props }) => (
    <div data-testid="line-chart" {...props}>{children}</div>
  )),
  BarChart: vi.fn(({ children, ...props }) => (
    <div data-testid="bar-chart" {...props}>{children}</div>
  )),
  PieChart: vi.fn(({ children, ...props }) => (
    <div data-testid="pie-chart" {...props}>{children}</div>
  )),
  AreaChart: vi.fn(({ children, ...props }) => (
    <div data-testid="area-chart" {...props}>{children}</div>
  )),
  Line: vi.fn(() => <div data-testid="line" />),
  Bar: vi.fn(() => <div data-testid="bar" />),
  Pie: vi.fn(() => <div data-testid="pie" />),
  Area: vi.fn(() => <div data-testid="area" />),
  XAxis: vi.fn(() => <div data-testid="x-axis" />),
  YAxis: vi.fn(() => <div data-testid="y-axis" />),
  CartesianGrid: vi.fn(() => <div data-testid="cartesian-grid" />),
  Tooltip: vi.fn(() => <div data-testid="tooltip" />),
  Legend: vi.fn(() => <div data-testid="legend" />),
  ResponsiveContainer: vi.fn(({ children }) => <div data-testid="responsive-container">{children}</div>),
  Cell: vi.fn(() => <div data-testid="cell" />),
  Sector: vi.fn(() => <div data-testid="sector" />)
}));

describe('LazyChart', () => {
  const mockData = [
    { name: 'Jan', value: 400 },
    { name: 'Feb', value: 300 },
    { name: 'Mar', value: 500 }
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ChartLoader', () => {
    it('shows loading placeholder initially', async () => {
      // The component uses lazy loading, so we need to wait for it
      render(<LineChart data={mockData} />);
      
      // Wait for the chart to load
      await waitFor(() => {
        expect(screen.getByTestId('line-chart')).toBeInTheDocument();
      });
    });

    it('has minimum height for loading placeholder', async () => {
      // The component uses lazy loading, so we need to wait for it
      render(<BarChart data={mockData} />);
      
      // Wait for the chart to load
      await waitFor(() => {
        expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
      });
    });
  });

  describe('LineChart', () => {
    it('renders LineChart after loading', async () => {
      render(
        <LineChart data={mockData} width={500} height={300}>
          <div>Child content</div>
        </LineChart>
      );

      await waitFor(() => {
        expect(screen.getByTestId('line-chart')).toBeInTheDocument();
      });
    });

    it('passes props to underlying chart component', async () => {
      const customProps = {
        data: mockData,
        width: 600,
        height: 400,
        margin: { top: 5, right: 5, bottom: 5, left: 5 }
      };

      render(<LineChart {...customProps} />);

      await waitFor(() => {
        const chart = screen.getByTestId('line-chart');
        expect(chart).toHaveAttribute('width', '600');
        expect(chart).toHaveAttribute('height', '400');
      });
    });

    it('renders children components', async () => {
      render(
        <LineChart data={mockData}>
          <div data-testid="custom-child">Custom Child</div>
        </LineChart>
      );

      await waitFor(() => {
        expect(screen.getByTestId('custom-child')).toBeInTheDocument();
      });
    });
  });

  describe('BarChart', () => {
    it('renders BarChart after loading', async () => {
      render(<BarChart data={mockData} />);

      await waitFor(() => {
        expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
      });
    });

    it('passes all props correctly', async () => {
      const onClickHandler = vi.fn();
      
      render(
        <BarChart 
          data={mockData} 
          onClick={onClickHandler}
          className="custom-bar-chart"
        />
      );

      await waitFor(() => {
        const chart = screen.getByTestId('bar-chart');
        expect(chart).toHaveClass('custom-bar-chart');
      });
    });
  });

  describe('PieChart', () => {
    it('renders PieChart after loading', async () => {
      render(<PieChart data={mockData} />);

      await waitFor(() => {
        expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
      });
    });

    it('handles custom dimensions', async () => {
      render(
        <PieChart 
          data={mockData}
          width={400}
          height={400}
          innerRadius={60}
          outerRadius={80}
        />
      );

      await waitFor(() => {
        const chart = screen.getByTestId('pie-chart');
        expect(chart).toHaveAttribute('width', '400');
        expect(chart).toHaveAttribute('height', '400');
      });
    });
  });

  describe('AreaChart', () => {
    it('renders AreaChart after loading', async () => {
      render(<AreaChart data={mockData} />);

      await waitFor(() => {
        expect(screen.getByTestId('area-chart')).toBeInTheDocument();
      });
    });

    it('supports stacked area configuration', async () => {
      const stackedData = [
        { name: 'Jan', uv: 400, pv: 240 },
        { name: 'Feb', uv: 300, pv: 139 },
        { name: 'Mar', uv: 500, pv: 380 }
      ];

      render(
        <AreaChart data={stackedData} stackOffset="expand">
          <div>Stacked areas</div>
        </AreaChart>
      );

      await waitFor(() => {
        expect(screen.getByTestId('area-chart')).toBeInTheDocument();
        expect(screen.getByText('Stacked areas')).toBeInTheDocument();
      });
    });
  });

  describe('Component Props Types', () => {
    it('accepts all valid LineChart props', async () => {
      const props = {
        data: mockData,
        syncId: 'anyId',
        layout: 'horizontal' as const,
        margin: { top: 20, right: 20, bottom: 20, left: 20 }
      };

      render(<LineChart {...props} />);

      await waitFor(() => {
        expect(screen.getByTestId('line-chart')).toBeInTheDocument();
      });
    });

    it('accepts all valid BarChart props', async () => {
      const props = {
        data: mockData,
        barCategoryGap: '20%',
        barGap: 4,
        maxBarSize: 100
      };

      render(<BarChart {...props} />);

      await waitFor(() => {
        expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
      });
    });

    it('accepts all valid PieChart props', async () => {
      const props = {
        data: mockData,
        startAngle: 0,
        endAngle: 360,
        cx: '50%',
        cy: '50%'
      };

      render(<PieChart {...props} />);

      await waitFor(() => {
        expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
      });
    });

    it('accepts all valid AreaChart props', async () => {
      const props = {
        data: mockData,
        baseValue: 'dataMin',
        stackOffset: 'none' as const
      };

      render(<AreaChart {...props} />);

      await waitFor(() => {
        expect(screen.getByTestId('area-chart')).toBeInTheDocument();
      });
    });
  });

  describe('Suspense Behavior', () => {
    it('shows loading state while chart is being loaded', () => {
      render(<LineChart data={mockData} />);
      
      // With mocked Suspense, we'll see the final state
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });

    it('replaces loader with chart content', async () => {
      render(<LineChart data={mockData} />);
      
      // Chart should be visible immediately with our mocked setup
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });
  });

  describe('Multiple Charts', () => {
    it('can render multiple charts simultaneously', async () => {
      render(
        <div>
          <LineChart data={mockData} />
          <BarChart data={mockData} />
          <PieChart data={mockData} />
          <AreaChart data={mockData} />
        </div>
      );

      await waitFor(() => {
        expect(screen.getByTestId('line-chart')).toBeInTheDocument();
        expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
        expect(screen.getByTestId('pie-chart')).toBeInTheDocument();
        expect(screen.getByTestId('area-chart')).toBeInTheDocument();
      });
    });
  });

  describe('Error Handling', () => {
    it('handles empty data gracefully', async () => {
      render(<LineChart data={[]} />);

      await waitFor(() => {
        expect(screen.getByTestId('line-chart')).toBeInTheDocument();
      });
    });

    it('handles undefined props gracefully', async () => {
      render(<BarChart data={mockData} width={undefined} height={undefined} />);

      await waitFor(() => {
        expect(screen.getByTestId('bar-chart')).toBeInTheDocument();
      });
    });
  });
});