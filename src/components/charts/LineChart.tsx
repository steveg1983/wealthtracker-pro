import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  type ChartData,
  type ChartOptions
} from 'chart.js';
import { Line } from 'react-chartjs-2';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface LineChartProps {
  data: ChartData<'line'>;
  options?: ChartOptions<'line'>;
  height?: number;
}

export default function LineChart({ data, options, height }: LineChartProps) {
  return <Line data={data} options={options} height={height} />;
}
