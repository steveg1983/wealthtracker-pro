import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../contexts/AppContextSupabase';
import { downloadCSV } from '../utils/csvExport';
import { logger } from '../services/loggingService';
import { 
  reportsPageService,
  type DateRange,
  type ActiveTab,
  type ReportData
} from '../services/reportsPageService';

export function useReportsPage() {
  const { transactions, accounts } = useApp();
  
  // State
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview');
  const [dateRange, setDateRange] = useState<DateRange>('month');
  const [selectedAccount, setSelectedAccount] = useState<string>('all');
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  
  // Refs for charts
  const chartRef1 = useRef<HTMLDivElement>(null);
  const chartRef2 = useRef<HTMLDivElement>(null);

  // Set loading to false when data is loaded
  useEffect(() => {
    if (transactions !== undefined && accounts !== undefined) {
      setIsLoading(false);
    }
  }, [transactions, accounts]);

  // Filter transactions based on date range and account
  const filteredTransactions = useMemo(() => {
    return reportsPageService.filterTransactions(
      transactions,
      dateRange,
      selectedAccount,
      customStartDate,
      customEndDate
    );
  }, [transactions, dateRange, selectedAccount, customStartDate, customEndDate]);

  // Calculate summary statistics
  const summary = useMemo(() => {
    return reportsPageService.calculateSummary(filteredTransactions);
  }, [filteredTransactions]);

  // Prepare data for category breakdown
  const categoryData = useMemo(() => {
    return reportsPageService.getCategoryData(filteredTransactions);
  }, [filteredTransactions]);

  // Prepare data for monthly trend
  const monthlyTrendData = useMemo(() => {
    return reportsPageService.getMonthlyTrendData(filteredTransactions);
  }, [filteredTransactions]);

  // Get top transactions
  const topTransactions = useMemo(() => {
    return reportsPageService.getTopTransactions(filteredTransactions, 10);
  }, [filteredTransactions]);

  // Handlers
  const handleTabChange = useCallback((tab: ActiveTab) => {
    setActiveTab(tab);
  }, []);

  const handleDateRangeChange = useCallback((range: DateRange) => {
    setDateRange(range);
  }, []);

  const handleAccountChange = useCallback((accountId: string) => {
    setSelectedAccount(accountId);
  }, []);

  const handleCustomStartDateChange = useCallback((date: string) => {
    setCustomStartDate(date);
  }, []);

  const handleCustomEndDateChange = useCallback((date: string) => {
    setCustomEndDate(date);
  }, []);

  const exportToCSV = useCallback(() => {
    const csv = reportsPageService.exportToCSV(filteredTransactions, accounts);
    const filename = `financial-report-${new Date().toISOString().split('T')[0]}.csv`;
    downloadCSV(csv, filename);
  }, [filteredTransactions, accounts]);

  const exportToPDF = useCallback(async (includeCharts: boolean = true) => {
    setIsGeneratingPDF(true);
    try {
      const categoryBreakdown = reportsPageService.getCategoryBreakdown(filteredTransactions);
      
      const reportData: ReportData = {
        title: 'Financial Report',
        dateRange: reportsPageService.formatDateRangeLabel(dateRange),
        summary,
        categoryBreakdown,
        topTransactions,
        chartElements: includeCharts && chartRef1.current && chartRef2.current
          ? [chartRef1.current, chartRef2.current]
          : undefined
      };

      await reportsPageService.exportToPDF(reportData, accounts, includeCharts);
    } catch (error) {
      logger.error('Error generating PDF:', error);
      alert('Failed to generate PDF report. Please try again.');
    } finally {
      setIsGeneratingPDF(false);
    }
  }, [filteredTransactions, dateRange, summary, topTransactions, accounts]);

  const handleBudgetExport = useCallback((data: any[]) => {
    const csvContent = reportsPageService.formatBudgetExportData(data);
    downloadCSV(csvContent, `budget-comparison-${new Date().toISOString().split('T')[0]}.csv`);
  }, []);

  // Utilities
  const formatCurrency = useCallback((amount: number) => {
    return reportsPageService.formatCurrency(amount);
  }, []);

  const getSavingsRateColor = useCallback((rate: number) => {
    return reportsPageService.getSavingsRateColor(rate);
  }, []);

  const getNetIncomeColor = useCallback((amount: number) => {
    return reportsPageService.getNetIncomeColor(amount);
  }, []);

  const getTransactionColor = useCallback((type: 'income' | 'expense') => {
    return reportsPageService.getTransactionColor(type);
  }, []);

  return {
    // State
    activeTab,
    dateRange,
    selectedAccount,
    isGeneratingPDF,
    customStartDate,
    customEndDate,
    isLoading,
    
    // Refs
    chartRef1,
    chartRef2,
    
    // Data
    transactions,
    accounts,
    filteredTransactions,
    summary,
    categoryData,
    monthlyTrendData,
    topTransactions,
    
    // Handlers
    handleTabChange,
    handleDateRangeChange,
    handleAccountChange,
    handleCustomStartDateChange,
    handleCustomEndDateChange,
    exportToCSV,
    exportToPDF,
    handleBudgetExport,
    
    // Utilities
    formatCurrency,
    getSavingsRateColor,
    getNetIncomeColor,
    getTransactionColor
  };
}