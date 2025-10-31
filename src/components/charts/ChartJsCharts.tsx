/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Bar, Pie, Line } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Bar Chart Component
export function BarChart({ data, children, ...props }: any) {
  const chartData = {
    labels: data?.map((item: any) => item[props.dataKey || 'month']) || [],
    datasets: [{
      label: props.label || 'Value',
      data: data?.map((item: any) => item[props.dataKey || 'netWorth']) || [],
      backgroundColor: props.fill || '#8B5CF6',
      borderRadius: 4
    }]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: props.contentStyle?.backgroundColor || 'rgba(255, 255, 255, 0.95)',
        titleColor: props.contentStyle?.color || '#111827',
        bodyColor: props.contentStyle?.color || '#111827',
        borderColor: props.contentStyle?.border?.split(' ')[2] || '#E5E7EB',
        borderWidth: 1,
        callbacks: {
          label: (context: any) => {
            if (props.formatter) {
              return props.formatter(context.parsed.y)[0];
            }
            return context.parsed.y;
          }
        }
      }
    },
    scales: {
      x: {
        grid: {
          display: props.showGrid !== false,
          color: 'rgba(55, 65, 81, 0.3)'
        },
        ticks: {
          color: '#6B7280',
          font: { size: 12 }
        }
      },
      y: {
        grid: {
          display: props.showGrid !== false,
          color: 'rgba(55, 65, 81, 0.3)'
        },
        ticks: {
          color: '#6B7280',
          font: { size: 12 },
          callback: (value: any) => {
            if (props.tickFormatter) {
              return props.tickFormatter(value);
            }
            if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
            if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
            return value.toString();
          }
        }
      }
    }
  };

  return <Bar data={chartData} options={options} />;
}

// Pie Chart Component
export function PieChart({ data, children, onClick, ...props }: any) {
  const chartData = {
    labels: data?.map((item: any) => item.name) || [],
    datasets: [{
      data: data?.map((item: any) => item.value) || [],
      backgroundColor: props.colors || ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8'],
      borderWidth: 0
    }]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: props.contentStyle?.backgroundColor || 'rgba(255, 255, 255, 0.95)',
        titleColor: props.contentStyle?.color || '#111827',
        bodyColor: props.contentStyle?.color || '#111827',
        borderColor: props.contentStyle?.border?.split(' ')[2] || '#E5E7EB',
        borderWidth: 1,
        callbacks: {
          label: (context: any) => {
            if (props.formatter) {
              return props.formatter(context.parsed);
            }
            return `${context.label}: ${context.parsed}`;
          }
        }
      }
    },
    onClick: (event: any, elements: any) => {
      if (elements.length > 0 && onClick) {
        const index = elements[0].index;
        onClick(data[index]);
      }
    },
    cutout: props.innerRadius ? '60%' : undefined
  };

  return <Pie data={chartData} options={options} />;
}

// Line Chart Component for compatibility
export function LineChart({ data, children, ...props }: any) {
  const chartData = {
    labels: data?.map((item: any) => item[props.dataKey || 'month']) || [],
    datasets: [{
      label: props.label || 'Value',
      data: data?.map((item: any) => item[props.dataKey || 'value']) || [],
      borderColor: props.stroke || '#8B5CF6',
      backgroundColor: props.fill || 'rgba(139, 92, 246, 0.1)',
      tension: 0.4
    }]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      }
    },
    scales: {
      x: {
        grid: {
          display: false
        }
      },
      y: {
        grid: {
          color: 'rgba(55, 65, 81, 0.3)'
        }
      }
    }
  };

  return <Line data={chartData} options={options} />;
}

// Export placeholder components for recharts compatibility
export function ResponsiveContainer({ children, width, height }: { children: React.ReactNode; width?: string | number; height?: string | number }) {
  return <div style={{ width: width || '100%', height: height || '100%' }}>{children}</div>;
}

export function XAxis() { return null; }
export function YAxis() { return null; }
export function CartesianGrid() { return null; }
export function RechartsTooltip() { return null; }
export { RechartsTooltip as Tooltip };
export function Cell() { return null; }
export function RechartsBar() { return null; }
export { RechartsBar as Bar };
export function RechartsPie() { return null; }
export { RechartsPie as Pie };
export function Area() { return null; }
export function RechartsLine(props: any) { return null; }
export { RechartsLine as Line };
export function Treemap() { return null; }
