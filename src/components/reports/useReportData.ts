import { useState, useMemo, useCallback } from 'react';
import type { Transaction, Account } from '../../types';
import type { ReportSettings } from './ReportSettings';
import type { CategoryData, MonthData } from './ReportTable';

interface Category {
  id: string;
  name: string;
  type: 'income' | 'expense' | 'both';
  level: 'type' | 'sub' | 'detail';
  parentId?: string;
  color?: string;
  icon?: string;
  isSystem?: boolean;
  isHeader?: boolean;
}

export function useReportData(
  transactions: Transaction[],
  categories: Category[],
  settings: ReportSettings
) {
  const [transactionModalData, setTransactionModalData] = useState<{
    isOpen: boolean;
    transactions: Transaction[];
    title: string;
  }>({
    isOpen: false,
    transactions: [],
    title: ''
  });

  // Get descendant category IDs
  const getDescendantIds = useCallback((categoryId: string): string[] => {
    const descendants = [categoryId];
    const children = categories.filter(c => c.parentId === categoryId);
    children.forEach(child => {
      descendants.push(...getDescendantIds(child.id));
    });
    return descendants;
  }, [categories]);

  // Handle cell click for transaction details
  const handleCellClick = useCallback((
    categoryData: CategoryData,
    monthData: { income: number; expenditure: number },
    month: MonthData
  ) => {
    if (!transactions.length || !monthData || (monthData.income === 0 && monthData.expenditure === 0)) return;
    
    const categoryIds = getDescendantIds(categoryData.category.id);
    
    // Filter transactions for this category and month
    const filteredTransactions = transactions.filter(t => {
      const transactionDate = new Date(t.date);
      const matchesCategory = categoryIds.includes(t.category);
      const matchesMonth = 
        transactionDate >= month.startDate && 
        transactionDate <= month.endDate;
      const matchesType = monthData.income > 0 ? t.type === 'income' : t.type === 'expense';
      
      return matchesCategory && matchesMonth && matchesType;
    });

    setTransactionModalData({
      isOpen: true,
      transactions: filteredTransactions,
      title: `${categoryData.category.name} - ${month.label}`
    });
  }, [transactions, getDescendantIds]);

  // Close transaction modal
  const closeTransactionModal = useCallback(() => {
    setTransactionModalData({
      isOpen: false,
      transactions: [],
      title: ''
    });
  }, []);

  // Generate months based on settings
  const generateMonths = useCallback((): MonthData[] => {
    const months: MonthData[] = [];
    const now = new Date();
    
    let monthCount = 1;
    if (settings.timePeriod === '12months') monthCount = 12;
    if (settings.timePeriod === '24months') monthCount = 24;
    
    if (settings.timePeriod === 'custom') {
      // Handle custom date range
      const start = new Date(settings.customStartDate);
      const end = new Date(settings.customEndDate);
      
      const current = new Date(start.getFullYear(), start.getMonth(), 1);
      while (current <= end) {
        const monthStart = new Date(current);
        const monthEnd = new Date(current.getFullYear(), current.getMonth() + 1, 0);
        
        months.push({
          key: `${current.getFullYear()}-${(current.getMonth() + 1).toString().padStart(2, '0')}`,
          startDate: monthStart,
          endDate: monthEnd,
          label: monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
        });
        
        current.setMonth(current.getMonth() + 1);
      }
    } else {
      // Generate standard month ranges
      for (let i = monthCount - 1; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0);
        
        months.push({
          key: `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`,
          startDate: date,
          endDate: monthEnd,
          label: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
        });
      }
    }
    
    return months;
  }, [settings]);

  // Filter categories based on level and exclusions
  const getFilteredCategories = useCallback((): Category[] => {
    let filtered = categories.filter(c => !settings.excludedCategories.includes(c.id));
    
    if (settings.categoryLevel === 'type') {
      filtered = filtered.filter(c => c.level === 'type');
    } else if (settings.categoryLevel === 'sub') {
      filtered = filtered.filter(c => c.level === 'type' || c.level === 'sub');
    }
    
    return filtered;
  }, [categories, settings]);

  // Calculate category data
  const calculateCategoryData = useCallback((
    category: Category,
    months: MonthData[]
  ): CategoryData => {
    const categoryIds = getDescendantIds(category.id);
    const monthlyData = months.map(month => {
      const monthTransactions = transactions.filter(t => {
        const tDate = new Date(t.date);
        return categoryIds.includes(t.category) &&
               tDate >= month.startDate &&
               tDate <= month.endDate;
      });
      
      const income = monthTransactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);
      
      const expenditure = monthTransactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);
      
      return {
        month: month.key,
        income,
        expenditure,
        net: income - expenditure
      };
    });
    
    const totalIncome = monthlyData.reduce((sum, m) => sum + m.income, 0);
    const totalExpenditure = monthlyData.reduce((sum, m) => sum + m.expenditure, 0);
    
    return {
      category,
      monthlyData,
      totalIncome,
      totalExpenditure,
      totalNet: totalIncome - totalExpenditure,
      isIndented: category.level === 'sub',
      isDoubleIndented: category.level === 'detail'
    };
  }, [transactions, getDescendantIds]);

  return {
    transactionModalData,
    handleCellClick,
    closeTransactionModal,
    generateMonths,
    getFilteredCategories,
    calculateCategoryData
  };
}