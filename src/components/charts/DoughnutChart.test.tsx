import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import DoughnutChart from './DoughnutChart';

// Mock Chart.js
vi.mock('chart.js', () => ({
  Chart: {
    register: vi.fn()
  },
  ArcElement: vi.fn(),
  Tooltip: vi.fn(),
  Legend: vi.fn()
}));

// Mock react-chartjs-2
vi.mock('react-chartjs-2', () => ({
  Doughnut: vi.fn(({ data, options, height }) => (
    <div 
      data-testid="chart-js-doughnut"
      data-chart-data={JSON.stringify(data)}
      data-chart-options={JSON.stringify(options)}
      style={{ height }}
    >
      Doughnut Chart
    </div>
  ))
}));

describe('DoughnutChart', () => {
  const mockData = {
    labels: ['Housing', 'Food', 'Transport', 'Entertainment', 'Utilities'],
    datasets: [
      {
        label: 'Monthly Expenses',
        data: [1200, 600, 400, 300, 200],
        backgroundColor: [
          'rgba(255, 99, 132, 0.8)',
          'rgba(54, 162, 235, 0.8)',
          'rgba(255, 206, 86, 0.8)',
          'rgba(75, 192, 192, 0.8)',
          'rgba(153, 102, 255, 0.8)'
        ],
        borderColor: [
          'rgba(255, 99, 132, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(255, 206, 86, 1)',
          'rgba(75, 192, 192, 1)',
          'rgba(153, 102, 255, 1)'
        ],
        borderWidth: 1
      }
    ]
  };

  const mockOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right' as const,
        labels: {
          padding: 15,
          font: {
            size: 12
          }
        }
      },
      tooltip: {
        callbacks: {
          label: function(context: any) {
            const label = context.label || '';
            const value = context.parsed || 0;
            const total = context.dataset.data.reduce((a: number, b: number) => a + b, 0);
            const percentage = ((value / total) * 100).toFixed(1);
            return `${label}: $${value} (${percentage}%)`;
          }
        }
      }
    },
    cutout: '60%'
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders Doughnut component from react-chartjs-2', () => {
      render(<DoughnutChart data={mockData} />);
      
      expect(screen.getByTestId('chart-js-doughnut')).toBeInTheDocument();
      expect(screen.getByText('Doughnut Chart')).toBeInTheDocument();
    });

    it('passes data prop correctly', () => {
      render(<DoughnutChart data={mockData} />);
      
      const chart = screen.getByTestId('chart-js-doughnut');
      const chartData = JSON.parse(chart.getAttribute('data-chart-data') || '{}');
      
      expect(chartData.labels).toEqual(mockData.labels);
      expect(chartData.datasets).toHaveLength(1);
      expect(chartData.datasets[0].label).toBe('Monthly Expenses');
      expect(chartData.datasets[0].data).toEqual([1200, 600, 400, 300, 200]);
    });

    it('passes options prop correctly', () => {
      render(<DoughnutChart data={mockData} options={mockOptions} />);
      
      const chart = screen.getByTestId('chart-js-doughnut');
      const chartOptions = JSON.parse(chart.getAttribute('data-chart-options') || '{}');
      
      expect(chartOptions.responsive).toBe(true);
      expect(chartOptions.maintainAspectRatio).toBe(false);
      expect(chartOptions.plugins.legend.position).toBe('right');
      expect(chartOptions.cutout).toBe('60%');
    });

    it('handles height prop', () => {
      render(<DoughnutChart data={mockData} height={300} />);
      
      const chart = screen.getByTestId('chart-js-doughnut');
      expect(chart).toHaveStyle({ height: '300px' });
    });
  });

  describe('Props Handling', () => {
    it('renders without options', () => {
      render(<DoughnutChart data={mockData} />);
      
      const chart = screen.getByTestId('chart-js-doughnut');
      const chartOptions = chart.getAttribute('data-chart-options');
      
      expect(chartOptions).toBe(null);
    });

    it('renders without height', () => {
      render(<DoughnutChart data={mockData} options={mockOptions} />);
      
      const chart = screen.getByTestId('chart-js-doughnut');
      expect(chart.style.height).toBe('');
    });

    it('handles empty data', () => {
      const emptyData = {
        labels: [],
        datasets: []
      };
      
      render(<DoughnutChart data={emptyData} />);
      
      const chart = screen.getByTestId('chart-js-doughnut');
      const chartData = JSON.parse(chart.getAttribute('data-chart-data') || '{}');
      
      expect(chartData.labels).toEqual([]);
      expect(chartData.datasets).toEqual([]);
    });

    it('handles single data point', () => {
      const singleData = {
        labels: ['Total'],
        datasets: [
          {
            data: [100],
            backgroundColor: ['rgba(75, 192, 192, 0.8)']
          }
        ]
      };
      
      render(<DoughnutChart data={singleData} />);
      
      const chart = screen.getByTestId('chart-js-doughnut');
      const chartData = JSON.parse(chart.getAttribute('data-chart-data') || '{}');
      
      expect(chartData.datasets[0].data).toEqual([100]);
    });
  });

  describe('Chart Configurations', () => {
    it('handles pie chart configuration (no cutout)', () => {
      const pieOptions = {
        ...mockOptions,
        cutout: 0
      };
      
      render(<DoughnutChart data={mockData} options={pieOptions} />);
      
      const chart = screen.getByTestId('chart-js-doughnut');
      const chartOptions = JSON.parse(chart.getAttribute('data-chart-options') || '{}');
      
      expect(chartOptions.cutout).toBe(0);
    });

    it('handles custom cutout percentages', () => {
      const customOptions = {
        cutout: '75%'
      };
      
      render(<DoughnutChart data={mockData} options={customOptions} />);
      
      const chart = screen.getByTestId('chart-js-doughnut');
      const chartOptions = JSON.parse(chart.getAttribute('data-chart-options') || '{}');
      
      expect(chartOptions.cutout).toBe('75%');
    });

    it('handles rotation and circumference options', () => {
      const rotationOptions = {
        rotation: -90,
        circumference: 180
      };
      
      render(<DoughnutChart data={mockData} options={rotationOptions} />);
      
      const chart = screen.getByTestId('chart-js-doughnut');
      const chartOptions = JSON.parse(chart.getAttribute('data-chart-options') || '{}');
      
      expect(chartOptions.rotation).toBe(-90);
      expect(chartOptions.circumference).toBe(180);
    });
  });

  describe('Data Formats', () => {
    it('handles data with custom styling per segment', () => {
      const styledData = {
        labels: ['Category A', 'Category B', 'Category C'],
        datasets: [
          {
            data: [30, 50, 20],
            backgroundColor: ['#FF6384', '#36A2EB', '#FFCE56'],
            hoverBackgroundColor: ['#FF6384', '#36A2EB', '#FFCE56'],
            borderWidth: [1, 2, 3],
            borderColor: ['#000', '#fff', '#ccc'],
            hoverOffset: 4
          }
        ]
      };
      
      render(<DoughnutChart data={styledData} />);
      
      const chart = screen.getByTestId('chart-js-doughnut');
      const chartData = JSON.parse(chart.getAttribute('data-chart-data') || '{}');
      
      expect(chartData.datasets[0].borderWidth).toEqual([1, 2, 3]);
      expect(chartData.datasets[0].hoverOffset).toBe(4);
    });

    it('handles percentage-based data', () => {
      const percentageData = {
        labels: ['Q1', 'Q2', 'Q3', 'Q4'],
        datasets: [
          {
            label: 'Quarterly Distribution',
            data: [25, 25, 25, 25],
            backgroundColor: [
              'rgba(255, 0, 0, 0.5)',
              'rgba(0, 255, 0, 0.5)',
              'rgba(0, 0, 255, 0.5)',
              'rgba(255, 255, 0, 0.5)'
            ]
          }
        ]
      };
      
      render(<DoughnutChart data={percentageData} />);
      
      const chart = screen.getByTestId('chart-js-doughnut');
      const chartData = JSON.parse(chart.getAttribute('data-chart-data') || '{}');
      
      expect(chartData.datasets[0].data.every((d: number) => d === 25)).toBe(true);
    });

    it('handles nested/hierarchical data structure', () => {
      const hierarchicalData = {
        labels: ['Group 1', 'Group 2', 'Group 3'],
        datasets: [
          {
            label: 'Outer Ring',
            data: [60, 30, 10],
            backgroundColor: ['red', 'blue', 'green']
          },
          {
            label: 'Inner Ring',
            data: [30, 20, 50],
            backgroundColor: ['darkred', 'darkblue', 'darkgreen']
          }
        ]
      };
      
      render(<DoughnutChart data={hierarchicalData} />);
      
      const chart = screen.getByTestId('chart-js-doughnut');
      const chartData = JSON.parse(chart.getAttribute('data-chart-data') || '{}');
      
      expect(chartData.datasets).toHaveLength(2);
      expect(chartData.datasets[0].label).toBe('Outer Ring');
      expect(chartData.datasets[1].label).toBe('Inner Ring');
    });
  });

  describe('Integration', () => {
    it('works with typical expense breakdown data', () => {
      const expenseData = {
        labels: [
          'Rent/Mortgage',
          'Groceries',
          'Transportation',
          'Utilities',
          'Entertainment',
          'Healthcare',
          'Other'
        ],
        datasets: [
          {
            label: 'Monthly Budget',
            data: [1500, 400, 200, 150, 100, 75, 75],
            backgroundColor: [
              '#FF6B6B',
              '#4ECDC4',
              '#45B7D1',
              '#FFA07A',
              '#98D8C8',
              '#FFE66D',
              '#95A5A6'
            ],
            borderWidth: 2,
            borderColor: '#fff'
          }
        ]
      };

      const expenseOptions = {
        responsive: true,
        plugins: {
          legend: {
            position: 'bottom' as const,
            labels: {
              padding: 20,
              usePointStyle: true,
              font: {
                size: 11
              }
            }
          },
          tooltip: {
            callbacks: {
              label: function(context: any) {
                const label = context.label || '';
                const value = context.parsed || 0;
                return `${label}: $${value.toLocaleString()}`;
              }
            }
          },
          title: {
            display: true,
            text: 'Monthly Expense Breakdown',
            font: {
              size: 16
            }
          }
        },
        cutout: '50%'
      };
      
      render(<DoughnutChart data={expenseData} options={expenseOptions} height={400} />);
      
      const chart = screen.getByTestId('chart-js-doughnut');
      expect(chart).toBeInTheDocument();
      
      const chartData = JSON.parse(chart.getAttribute('data-chart-data') || '{}');
      expect(chartData.labels).toHaveLength(7);
      expect(chartData.datasets[0].data.reduce((a: number, b: number) => a + b, 0)).toBe(2500);
    });

    it('works with portfolio allocation data', () => {
      const portfolioData = {
        labels: ['Stocks', 'Bonds', 'Real Estate', 'Cash', 'Commodities'],
        datasets: [
          {
            label: 'Asset Allocation',
            data: [45, 30, 15, 7, 3],
            backgroundColor: [
              'rgba(54, 162, 235, 0.8)',
              'rgba(75, 192, 192, 0.8)',
              'rgba(153, 102, 255, 0.8)',
              'rgba(255, 206, 86, 0.8)',
              'rgba(255, 99, 132, 0.8)'
            ]
          }
        ]
      };
      
      render(<DoughnutChart data={portfolioData} />);
      
      const chart = screen.getByTestId('chart-js-doughnut');
      const chartData = JSON.parse(chart.getAttribute('data-chart-data') || '{}');
      
      // Verify portfolio percentages add up to 100
      const total = chartData.datasets[0].data.reduce((a: number, b: number) => a + b, 0);
      expect(total).toBe(100);
    });
  });
});