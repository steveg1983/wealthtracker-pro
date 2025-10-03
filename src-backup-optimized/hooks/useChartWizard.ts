import { useState, useEffect, useCallback } from 'react';
import { ChartType, ChartOptions } from '../components/analytics/chartCatalog';
import { ChartDataGenerator, ChartData } from '../services/chartDataGenerator';
import type { PlotlyTrace, PlotlyLayout } from '../components/analytics/ChartPreview';

export interface ChartConfiguration {
  type: ChartType;
  dataSource?: string;
  xAxis?: string;
  yAxis?: string;
  series?: string[];
  aggregation?: string;
  timeRange?: string;
  filters?: Record<string, unknown>;
  options?: ChartOptions;
}

export function useChartWizard(initialData?: ChartData) {
  const [selectedChart, setSelectedChart] = useState<ChartType | null>(null);
  const [chartTitle, setChartTitle] = useState('');
  const [chartData, setChartData] = useState<PlotlyTrace[] | null>(null);
  const [chartLayout, setChartLayout] = useState<PlotlyLayout>({});
  const [chartConfig, setChartConfig] = useState<ChartConfiguration>({} as ChartConfiguration);
  const [chartOptions, setChartOptions] = useState<ChartOptions>({});
  const [previewMode, setPreviewMode] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  // Generate chart data whenever chart type or data changes
  useEffect(() => {
    if (selectedChart && initialData) {
      generateChartData();
    }
  }, [selectedChart, initialData, chartOptions, chartTitle]);

  const generateChartData = useCallback(() => {
    if (!selectedChart || !initialData) return;

    const { traces, layout } = ChartDataGenerator.generateChartData(
      selectedChart,
      initialData,
      chartTitle
    );

    setChartData(traces);
    setChartLayout(layout);
  }, [selectedChart, initialData, chartTitle]);

  const handleSelectChart = useCallback((type: ChartType) => {
    setSelectedChart(type);
    setChartConfig(prev => ({ ...prev, type }));
    setCurrentStep(2);
  }, []);

  const handleUpdateTitle = useCallback((title: string) => {
    setChartTitle(title);
  }, []);

  const handleUpdateOptions = useCallback((options: ChartOptions) => {
    setChartOptions(options);
    setChartConfig(prev => ({ ...prev, options }));
  }, []);

  const handleNextStep = useCallback(() => {
    setCurrentStep(prev => Math.min(prev + 1, 4));
  }, []);

  const handlePrevStep = useCallback(() => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  }, []);

  const handlePreviewToggle = useCallback(() => {
    setPreviewMode(prev => !prev);
  }, []);

  const getChartExportData = useCallback(() => {
    return {
      type: selectedChart,
      title: chartTitle,
      data: chartData,
      layout: chartLayout,
      options: chartOptions,
      config: chartConfig
    };
  }, [selectedChart, chartTitle, chartData, chartLayout, chartOptions, chartConfig]);

  const resetWizard = useCallback(() => {
    setSelectedChart(null);
    setChartTitle('');
    setChartData(null);
    setChartLayout({});
    setChartConfig({} as ChartConfiguration);
    setChartOptions({});
    setPreviewMode(false);
    setCurrentStep(1);
  }, []);

  return {
    // State
    selectedChart,
    chartTitle,
    chartData,
    chartLayout,
    chartOptions,
    previewMode,
    currentStep,
    
    // Actions
    handleSelectChart,
    handleUpdateTitle,
    handleUpdateOptions,
    handleNextStep,
    handlePrevStep,
    handlePreviewToggle,
    getChartExportData,
    resetWizard,
    generateChartData
  };
}