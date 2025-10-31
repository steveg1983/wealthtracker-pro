import React from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  type ChartData,
  type ChartOptions
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

// Register ChartJS components
ChartJS.register(
  ArcElement,
  Tooltip,
  Legend
);

interface DoughnutChartProps {
  data: ChartData<'doughnut'>;
  options?: ChartOptions<'doughnut'>;
  height?: number;
}

export default function DoughnutChart({ data, options, height }: DoughnutChartProps) {
  return <Doughnut data={data} options={options} height={height} />;
}
