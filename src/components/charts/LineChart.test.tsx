import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LineChart from './LineChart';

// Mock Chart.js
vi.mock('chart.js', () => ({
  Chart: {
    register: vi.fn()
  },
  CategoryScale: vi.fn(),
  LinearScale: vi.fn(),
  PointElement: vi.fn(),
  LineElement: vi.fn(),
  Title: vi.fn(),
  Tooltip: vi.fn(),
  Legend: vi.fn()
}));

// Mock react-chartjs-2
vi.mock('react-chartjs-2', () => ({
  Line: vi.fn(({ data, options, height }) => (
    <div 
      data-testid="chart-js-line"
      data-chart-data={JSON.stringify(data)}
      data-chart-options={JSON.stringify(options)}
      style={{ height }}
    >
      Line Chart
    </div>
  ))
}));

describe('LineChart', () => {
  const mockData = {
    labels: ['January', 'February', 'March', 'April', 'May'],
    datasets: [
      {
        label: 'Revenue',
        data: [12000, 19000, 15000, 25000, 22000],
        borderColor: 'rgb(75, 192, 192)',
        backgroundColor: 'rgba(75, 192, 192, 0.2)',
      },
      {
        label: 'Expenses',
        data: [8000, 12000, 10000, 14000, 16000],
        borderColor: 'rgb(255, 99, 132)',
        backgroundColor: 'rgba(255, 99, 132, 0.2)',
      }
    ]
  };

  const mockOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Monthly Financial Overview'
      }
    },
    scales: {
      y: {
        beginAtZero: true
      }
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders Line component from react-chartjs-2', () => {
      render(<LineChart data={mockData} />);
      
      expect(screen.getByTestId('chart-js-line')).toBeInTheDocument();
      expect(screen.getByText('Line Chart')).toBeInTheDocument();
    });

    it('passes data prop correctly', () => {
      render(<LineChart data={mockData} />);
      
      const chart = screen.getByTestId('chart-js-line');
      const chartData = JSON.parse(chart.getAttribute('data-chart-data') || '{}');
      
      expect(chartData.labels).toEqual(mockData.labels);
      expect(chartData.datasets).toHaveLength(2);
      expect(chartData.datasets[0].label).toBe('Revenue');
      expect(chartData.datasets[1].label).toBe('Expenses');
    });

    it('passes options prop correctly', () => {
      render(<LineChart data={mockData} options={mockOptions} />);
      
      const chart = screen.getByTestId('chart-js-line');
      const chartOptions = JSON.parse(chart.getAttribute('data-chart-options') || '{}');
      
      expect(chartOptions.responsive).toBe(true);
      expect(chartOptions.plugins.legend.position).toBe('top');
      expect(chartOptions.plugins.title.text).toBe('Monthly Financial Overview');
    });

    it('handles height prop', () => {
      render(<LineChart data={mockData} height={400} />);
      
      const chart = screen.getByTestId('chart-js-line');
      expect(chart).toHaveStyle({ height: '400px' });
    });
  });

  describe('Props Handling', () => {
    it('renders without options', () => {
      render(<LineChart data={mockData} />);
      
      const chart = screen.getByTestId('chart-js-line');
      const chartOptions = chart.getAttribute('data-chart-options');
      
      expect(chartOptions).toBe(null);
    });

    it('renders without height', () => {
      render(<LineChart data={mockData} options={mockOptions} />);
      
      const chart = screen.getByTestId('chart-js-line');
      expect(chart.style.height).toBe('');
    });

    it('handles empty data', () => {
      const emptyData = {
        labels: [],
        datasets: []
      };
      
      render(<LineChart data={emptyData} />);
      
      const chart = screen.getByTestId('chart-js-line');
      const chartData = JSON.parse(chart.getAttribute('data-chart-data') || '{}');
      
      expect(chartData.labels).toEqual([]);
      expect(chartData.datasets).toEqual([]);
    });

    it('handles complex options', () => {
      const complexOptions = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: {
          mode: 'index' as const,
          intersect: false,
        },
        plugins: {
          legend: {
            position: 'bottom' as const,
            labels: {
              padding: 20,
              font: {
                size: 14
              }
            }
          },
          tooltip: {
            mode: 'index' as const,
            intersect: false,
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            titleFont: {
              size: 16
            }
          }
        },
        scales: {
          x: {
            display: true,
            title: {
              display: true,
              text: 'Month'
            }
          },
          y: {
            display: true,
            title: {
              display: true,
              text: 'Value'
            },
            ticks: {
              callback: function(value: any) {
                return '$' + value;
              }
            }
          }
        }
      };
      
      render(<LineChart data={mockData} options={complexOptions} />);
      
      const chart = screen.getByTestId('chart-js-line');
      const chartOptions = JSON.parse(chart.getAttribute('data-chart-options') || '{}');
      
      expect(chartOptions.maintainAspectRatio).toBe(false);
      expect(chartOptions.interaction.mode).toBe('index');
      expect(chartOptions.plugins.tooltip.backgroundColor).toBe('rgba(0, 0, 0, 0.8)');
    });
  });

  describe('Data Formats', () => {
    it('handles single dataset', () => {
      const singleDataset = {
        labels: ['Q1', 'Q2', 'Q3', 'Q4'],
        datasets: [
          {
            label: 'Quarterly Sales',
            data: [50000, 60000, 55000, 70000],
            borderColor: 'rgb(54, 162, 235)',
          }
        ]
      };
      
      render(<LineChart data={singleDataset} />);
      
      const chart = screen.getByTestId('chart-js-line');
      const chartData = JSON.parse(chart.getAttribute('data-chart-data') || '{}');
      
      expect(chartData.datasets).toHaveLength(1);
      expect(chartData.datasets[0].label).toBe('Quarterly Sales');
    });

    it('handles multiple datasets with different properties', () => {
      const multipleDatasets = {
        labels: ['Jan', 'Feb', 'Mar'],
        datasets: [
          {
            label: 'Dataset 1',
            data: [10, 20, 30],
            borderColor: 'red',
            fill: false,
            tension: 0.1
          },
          {
            label: 'Dataset 2',
            data: [15, 25, 35],
            borderColor: 'blue',
            borderDash: [5, 5],
            pointRadius: 5
          },
          {
            label: 'Dataset 3',
            data: [5, 15, 25],
            borderColor: 'green',
            backgroundColor: 'rgba(0, 255, 0, 0.1)',
            fill: true
          }
        ]
      };
      
      render(<LineChart data={multipleDatasets} />);
      
      const chart = screen.getByTestId('chart-js-line');
      const chartData = JSON.parse(chart.getAttribute('data-chart-data') || '{}');
      
      expect(chartData.datasets).toHaveLength(3);
      expect(chartData.datasets[0].tension).toBe(0.1);
      expect(chartData.datasets[1].borderDash).toEqual([5, 5]);
      expect(chartData.datasets[2].fill).toBe(true);
    });

    it('handles time series data', () => {
      const timeSeriesData = {
        labels: ['2024-01-01', '2024-02-01', '2024-03-01', '2024-04-01'],
        datasets: [
          {
            label: 'Stock Price',
            data: [
              { x: '2024-01-01', y: 100 },
              { x: '2024-02-01', y: 110 },
              { x: '2024-03-01', y: 105 },
              { x: '2024-04-01', y: 120 }
            ],
            borderColor: 'purple'
          }
        ]
      };
      
      render(<LineChart data={timeSeriesData} />);
      
      const chart = screen.getByTestId('chart-js-line');
      const chartData = JSON.parse(chart.getAttribute('data-chart-data') || '{}');
      
      expect(chartData.datasets[0].data[0]).toEqual({ x: '2024-01-01', y: 100 });
    });
  });

  describe('Integration', () => {
    it('works with typical financial data', () => {
      const financialData = {
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
        datasets: [
          {
            label: 'Income',
            data: [5000, 5500, 6000, 5800, 6200, 6500],
            borderColor: 'rgb(75, 192, 192)',
            backgroundColor: 'rgba(75, 192, 192, 0.2)',
            tension: 0.4
          },
          {
            label: 'Expenses',
            data: [3000, 3200, 3100, 3300, 3400, 3500],
            borderColor: 'rgb(255, 99, 132)',
            backgroundColor: 'rgba(255, 99, 132, 0.2)',
            tension: 0.4
          },
          {
            label: 'Net',
            data: [2000, 2300, 2900, 2500, 2800, 3000],
            borderColor: 'rgb(54, 162, 235)',
            backgroundColor: 'rgba(54, 162, 235, 0.2)',
            tension: 0.4
          }
        ]
      };

      const financialOptions = {
        responsive: true,
        plugins: {
          title: {
            display: true,
            text: 'Monthly Financial Summary'
          },
          legend: {
            display: true,
            position: 'bottom' as const
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(value: any) {
                return '$' + value.toLocaleString();
              }
            }
          }
        }
      };
      
      render(<LineChart data={financialData} options={financialOptions} height={300} />);
      
      const chart = screen.getByTestId('chart-js-line');
      expect(chart).toBeInTheDocument();
      
      const chartData = JSON.parse(chart.getAttribute('data-chart-data') || '{}');
      expect(chartData.datasets).toHaveLength(3);
      expect(chartData.datasets.map((d: any) => d.label)).toEqual(['Income', 'Expenses', 'Net']);
    });
  });
});