import React from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend
} from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

// Register ChartJS components
ChartJS.register(
  ArcElement,
  Tooltip,
  Legend
);

interface DoughnutChartProps {
  data: any;
  options?: any;
  height?: number;
}

export default function DoughnutChart({ data, options, height }: DoughnutChartProps) {
  return <Doughnut data={data} options={options} height={height} />;
}