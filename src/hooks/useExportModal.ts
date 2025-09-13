/**
 * Export Modal Hook
 * Manages state and logic for export modal
 */

import { useState, useCallback, useMemo } from 'react';
import { exportModalService } from '../services/exportModalService';
import type { 
  ExportFormat, 
  DateRange, 
  GroupBy, 
  IncludeOptions 
} from '../services/exportModalService';
import type { Account, Transaction, Budget, Goal } from '../types';

export interface UseExportModalProps {
  accounts: Account[];
  transactions: Transaction[];
  budgets: Budget[];
  goals: Goal[];
  onClose: () => void;
}

export function useExportModal({
  accounts,
  transactions,
  budgets,
  goals,
  onClose
}: UseExportModalProps) {
  // Initial values
  const initialDateRange = exportModalService.getInitialDateRange();
  
  // State
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('csv');
  const [dateRange, setDateRange] = useState<DateRange>('month');
  const [startDate, setStartDate] = useState(initialDateRange.start);
  const [endDate, setEndDate] = useState(initialDateRange.end);
  const [includeOptions, setIncludeOptions] = useState<IncludeOptions>(
    exportModalService.getDefaultIncludeOptions()
  );
  const [groupBy, setGroupBy] = useState<GroupBy>('none');
  const [isExporting, setIsExporting] = useState(false);

  // Get format options
  const formatOptions = useMemo(() => 
    exportModalService.getFormatOptions(),
    []
  );

  // Handle date range change
  const handleDateRangeChange = useCallback((range: DateRange) => {
    setDateRange(range);
    if (range !== 'custom') {
      const dates = exportModalService.calculateDateRange(range);
      setStartDate(dates.start);
      setEndDate(dates.end);
    }
  }, []);

  // Filter transactions
  const filteredTransactions = useMemo(() => 
    exportModalService.filterTransactionsByDate(
      transactions,
      startDate,
      endDate,
      dateRange
    ),
    [transactions, startDate, endDate, dateRange]
  );

  // Validate export
  const isExportValid = useMemo(() => 
    exportModalService.validateExportOptions(includeOptions),
    [includeOptions]
  );

  // Handle export
  const handleExport = useCallback(async () => {
    setIsExporting(true);
    
    try {
      // Prepare export options
      const exportOptions = exportModalService.prepareExportOptions(
        selectedFormat,
        startDate,
        endDate,
        includeOptions,
        groupBy
      );
      
      // Prepare export data
      const exportData = exportModalService.prepareExportData(
        filteredTransactions,
        accounts,
        budgets,
        goals,
        includeOptions,
        startDate,
        endDate
      );
      
      // Perform export
      await exportModalService.performExport(exportData, exportOptions);
      
      // Close modal on success
      onClose();
    } catch (error) {
      // Error handling would be done here
      console.error('Export failed:', error);
    } finally {
      setIsExporting(false);
    }
  }, [
    selectedFormat,
    startDate,
    endDate,
    includeOptions,
    groupBy,
    filteredTransactions,
    accounts,
    budgets,
    goals,
    onClose
  ]);

  return {
    // State
    selectedFormat,
    dateRange,
    startDate,
    endDate,
    includeOptions,
    groupBy,
    isExporting,
    formatOptions,
    filteredTransactions,
    isExportValid,
    
    // Handlers
    setSelectedFormat,
    handleDateRangeChange,
    setStartDate,
    setEndDate,
    setIncludeOptions,
    setGroupBy,
    handleExport
  };
}